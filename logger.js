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
// Removed logFile.txt creation as per new requirements.

// Delete log files older than 10 days (never delete today's log file)
{
  const logDir = path.join(__dirname, 'logFolder');
  const now = new Date();
  const tenDaysAgo = new Date(now);
  tenDaysAgo.setDate(now.getDate() - 9); // 9 days before today, so keep 10 days including today
  const logFiles = fs.readdirSync(logDir);

  logFiles.forEach(fileName => {
    // Expecting filename format: YYYY-MMMM-DD-dnac-info.log or YYYY-MMMM-DD-dnac-error.log (English month)
    const matchInfo = fileName.match(/(\d{4})-([A-Za-z]+)-(\d{2})-dnac-info\.log/);
    const matchError = fileName.match(/(\d{4})-([A-Za-z]+)-(\d{2})-dnac-error\.log/);
    let match = matchInfo || matchError;
    if (match) {
      const [_, year, monthStr, day] = match;
      const month = new Date(`${monthStr} 1, 2000`).getMonth();
      const fileDate = new Date(Number(year), month, Number(day));
      // Never delete today's log file
      const isToday = (Number(year) === currentYear && month === today.getMonth() && Number(day) === today.getDate());
      if (!isToday && fileDate < tenDaysAgo) {
        try {
          fs.unlinkSync(path.join(logDir, fileName));
        } catch (err) {
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
  }
};
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
    new transports.File({ filename: infoFile, level: 'info', format: combine(timestamp({ format: "DD-MM-YYYY HH:mm:ss" }), myFormat) }),
    new transports.File({ filename: errorFile, level: 'error', format: combine(timestamp({ format: "DD-MM-YYYY HH:mm:ss" }), myFormat) })
  ],
});

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//

// No need to add verbose file transport in development. Only console is added by default above.

addColors({
  debug: 'white',
  error: 'red',
  info: 'green',
  warn: 'yellow',
});
export default logger




