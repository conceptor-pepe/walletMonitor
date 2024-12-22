import winston from 'winston'
import moment from 'moment-timezone'

export const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp({ format: () => moment().tz('Asia/Shanghai').format('MMM DD HH:mm:ss') }), // Add formatted timestamp to log message
    winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`), // Custom log format
  ),
  transports: [
    new winston.transports.Console(), // Log to the console
    new winston.transports.File({
      // Log to a file
      filename: 'logs/app.log', // Specify the file name and path
      level: 'info', // Log level
    }),
  ],
})

logger.info('Logging message to both terminal and log file')
