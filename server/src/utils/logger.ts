import winston from 'winston';
import morgan, { StreamOptions } from 'morgan';
import { getConfig } from '../config';
import path from 'path';

/**
 * Winston logger configuration
 */
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: false }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Create transports
const transports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  new winston.transports.File({
    filename: 'logs/all.log',
  }),
];

// Lazily initialize logger after config is loaded
let loggerInstance: winston.Logger | null = null;

export function initializeLogger() {
  if (!loggerInstance) {
    const config = getConfig();
    loggerInstance = winston.createLogger({
      level: config.LOG_LEVEL || 'info',
      levels,
      format,
      transports,
    });
  }
  return loggerInstance;
}

/**
 * Get logger instance
 */
export function getLogger(filename: string) {
  const logger = initializeLogger();
  const shortFilename = path.basename(filename);
  return {
    error: (message: string, meta?: any) => logger.error(`[${shortFilename}] ${message}`, meta),
    warn: (message: string, meta?: any) => logger.warn(`[${shortFilename}] ${message}`, meta),
    info: (message: string, meta?: any) => logger.info(`[${shortFilename}] ${message}`, meta),
    debug: (message: string, meta?: any) => logger.debug(`[${shortFilename}] ${message}`, meta),
  };
}

/**
 * Morgan stream for integration with Winston
 */
const stream: StreamOptions = {
  write: (message: string) => {
    const logger = initializeLogger();
    logger.info(message.trim());
  },
};

/**
 * Morgan middleware for HTTP request logging
 */
export function httpLogger() {
  return morgan(
    ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"',
    { stream }
  );
}

export default {
  getLogger,
  httpLogger,
  initializeLogger,
};
