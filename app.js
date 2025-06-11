// NODE_TLS_REJECT_UNAUTHORIZED = '0';
import express from "express";
import mongoose from 'mongoose';
// import dotenv from 'dotenv';
import fs from "fs";
import https from "https";
import onboardingRoute from "./src/route/onboarding_routes.js";
import afterOnboading from "./src/route/afterOnboarding_routes.js"
import cors from 'cors';
import morgan from 'morgan';
// import session from 'express-session';
// import fileUpload from "express-fileupload";
import rateLimit from 'express-rate-limit'; 
import logger from "./logger.js";
import dbo from "./src/db/conn.js";

// dotenv.config();

const app = express();
const port =  3001;

// Reading the key and certificate for HTTPS
const options = {
    key: fs.readFileSync("key.pem"),
    // cert: fs.readFileSync("certificate.crt"),
    cert: fs.readFileSync("cert.pem"),
};

// Middleware setup
app.use(express.json())
app.use(express.static('./public'));
app.use(cors());

app.use((err, req, res, next) => {
    logger.error(err.stack)
    console.error(err.stack);
    return res.status(500).send('Something went wrong!');
  });
// Rate limiting
const limiter = rateLimit({
    windowMs: 3 * 60 * 1000, // 3 minutes
    max: 200, // Max 200 requests per IP in this window
    message: 'Too many requests from this IP, please try again later.',
    headers: true,
});
app.use(limiter);

// File upload configuration
// app.use(fileUpload({
//     useTempFiles: true,
//     tempFileDir: '/tmp/'
// }));

// Session configuration
// app.use(session({
//     secret: 'SECRET_KEY',
//     resave: false,
//     saveUninitialized: true,
//     cookie: { maxAge: 60000 },
// }));

// Logging configuration with Morgan
morgan.token('statusCode', (req, res) => res.statusCode);
app.use(morgan('tiny', {
    stream: {
        write: (message) => logger.info(message.trim()),
    },
}));

// Middleware to allow cross-origin requests
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});

// Routes
app.use('/api/v1/onboard', onboardingRoute);
app.use('/api/v1/afterOnboard', afterOnboading);

// MongoDB connection
const connectToDb = async () => {
    try {
        await dbo?.connectToServer("", "", function (err) {
            if (err) console.error("error in db", err);
        });
    } catch (err) {
        console.error('Error connecting to database:', err);
    }
};

// Start the server after DB connection
const startServer = async() => {
    const server = https.createServer(options, app);
    // await dbo?.connectToServer("", "", function (err) {
    //     if (err) console.error("error in db", err);
    // });
    server.listen(port,"0.0.0.0" ,() => {
        console.log(`HTTPS server running on ${port}`);
    });
};

// Initiate the MongoDB connection and then start the server
connectToDb().then(() => startServer()).catch((err) => {
    console.error('Error starting server:', err);
});
