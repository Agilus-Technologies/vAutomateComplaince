import winston from 'winston';
const { addColors, createLogger, format, transports } = winston;
const { combine, timestamp, printf } = format;
import fs from "fs";
import path from "path";
const __dirname = path.resolve();

const myFormat = printf(({ level, message, timestamp }) => {
  if (typeof message == "object") {
    return `[${level}] ${timestamp}:{msg :-${message.msg},status:-${message?.status}}`;
  } else {
    return `[${level}] ${timestamp}:${message}`;
  }
});

if (!fs.existsSync(path.join(__dirname, "logFolder"))) {
  fs.mkdirSync(path.join(__dirname, "logFolder"));
}

let today = new Date();
let currentYear = today.getFullYear();
let currentMonth = today.toLocaleString("default", { month: "long" });
let currentDate = today.getDate().toString().padStart(2, "0");
let file = `logFolder/${currentYear}-${currentMonth}-${currentDate}-logFile.txt`;

//for delete log file, only current 6 days log file avalibale in system. 
let filenames = fs.readdirSync("logFolder")
if (filenames && filenames.length > 5){
  let fileNameLength = filenames.shift()
  // let fileNameLength = filenames.slice(1)
  if (fileNameLength.length > 0) {
      fs.unlink(`logFolder/${fileNameLength}`, (err) => {
        if (err) {
          logger.error(`Error removing file: ${err}`);
        }
      })
  }
}

let options = {
  console: {
    handleExceptions: true,
    level: 'info',
    format: combine(format.colorize(), myFormat)
  },
  verbose: {
    filename: file,
    level: 'info',
    format: combine(myFormat)
  },
}
const logger = createLogger({
  level: 'info',
  format: combine(
    // format.colorize(),
    format.errors({ stack: true }),
    // winston.format.json(),
    winston.format.simple(),
    timestamp({ format: "DD-MM-YYYY HH:mm:ss" }),
    myFormat
  ),
  transports: [
    new transports.Console(options.console),
    new transports.File(options.verbose),
    // new transports.File({ filename: file, level: 'info' }),
  ],
});

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.File(options.verbose),
    new transports.Console(options.console
      // format: winston.format.simple(),

      // new transports.Console({
      //   // format: winston.format.simple(),
      //   format: combine(
      //     format.colorize(),
      //     winston.format.json(),
      //     //    format.simple(),   
      //     timestamp({ format: "DD-MM-YYYY HH:mm:ss" }),
      //     myFormat
      //   ),
    ));

}
addColors({
  debug: 'white',
  error: 'red',
  info: 'green',
  warn: 'yellow',
});
export default logger




