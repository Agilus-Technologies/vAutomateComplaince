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

// Create log folder if it doesn't exist
if (!fs.existsSync(path.join(__dirname, "logFolder"))) {
  fs.mkdirSync(path.join(__dirname, "logFolder"));
}

// Get current date and create log file name
let today = new Date();
let currentYear = today.getFullYear();
// Always use English month names for log file naming and parsing
let currentMonth = today.toLocaleString("en-US", { month: "long" });
let currentDate = today.getDate().toString().padStart(2, "0");
let infoFile = `logFolder/${currentYear}-${currentMonth}-${currentDate}-dnac-info.log`;
let errorFile = `logFolder/${currentYear}-${currentMonth}-${currentDate}-dnac-error.log`;
let file = `logFolder/${currentYear}-${currentMonth}-${currentDate}-logFile.txt`;

// Delete log files older than 6 months (never delete today's log file)
{
  const logDir = path.join(__dirname, 'logFolder');
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  const logFiles = fs.readdirSync(logDir);

  logFiles.forEach(fileName => {
    // Expecting filename format: YYYY-MMMM-DD-logFile.txt (English month)
    const match = fileName.match(/(\d{4})-([A-Za-z]+)-(\d{2})-logFile\.txt/);
    if (match) {
      const [_, year, monthStr, day] = match;
      // Always use English for month parsing
      const month = new Date(`${monthStr} 1, 2000`).getMonth();
      const fileDate = new Date(Number(year), month, Number(day));
      // Never delete today's log file
      const isToday = (Number(year) === currentYear && month === today.getMonth() && Number(day) === today.getDate());
      if (!isToday && fileDate < sixMonthsAgo) {
        try {
          fs.unlinkSync(path.join(logDir, fileName));
        } catch (err) {
          // Use console.error here because logger may not be ready yet
          console.error(`Error removing old log file: ${fileName} - ${err}`);
        }
      }
    }
  });
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
    new transports.File({ filename: infoFile, level: 'info', format: combine(timestamp({ format: "DD-MM-YYYY HH:mm:ss" }), myFormat) }),
    new transports.File({ filename: errorFile, level: 'error', format: combine(timestamp({ format: "DD-MM-YYYY HH:mm:ss" }), myFormat) })
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




