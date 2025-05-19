// const nodemailer = require('nodemailer');
import nodemailer from "nodemailer"
// const configurations = require('../models/configurations');
// const decryptPassword = require('../models/configurations');
import dbo from "../db/conn.js";
const sendEmail = async ({ to, subject, data }) => {
    const db_connect = dbo && dbo.getDb();
    let setUpDetails = await db_connect.collection('tbl_Package').find({}).project({ "email": 1, "_id": 0 }).toArray();
//   const credential = await configurations.findOne({category:'email'});
  const decryptedPassword = credential.decryptPassword();
  
console.log(credential,"______________________________",decryptedPassword);

  const transporter = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
      user: credential.email,
      pass: decryptedPassword,
    }
  });

  try {
    const info = await transporter.sendMail({
      from: credential.email,
      to,
      subject,
      html: data.html
    });

    console.log('Message sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = sendEmail;
