import { Request, Response, NextFunction } from 'express';
import { getLogger } from '../utils/logger';

const logger = getLogger(__filename);

/**
 * Application-specific error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Specific error subclasses
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

/**
 * Global error handler middleware
 * Should be the last middleware registered
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Add correlation ID to error logs
  const correlationId = req.id || 'unknown';

  let error = err;
  if (!(err instanceof AppError)) {
    logger.error(`[${correlationId}] Unhandled error:`, {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });
    error = new AppError('Internal server error', 500, false);
  }

  const appError = error as AppError;

  // Log operational errors at appropriate level
  const logLevel = appError.statusCode >= 500 ? 'error' : 'warn';
  logger[logLevel as 'error' | 'warn'](`[${correlationId}] ${appError.statusCode} - ${appError.message}`, {
    path: req.path,
    method: req.method,
    userId: (req as any).user?.id,
  });

  // Send error response
  res.status(appError.statusCode).json({
    error: appError.message,
    status: appError.statusCode,
    ...(process.env.NODE_ENV === 'development' && { stack: appError.stack }),
  });
}

/**
 * Async route wrapper to catch errors
 * Usage: app.get('/route', asyncHandler((req, res) => { ... }))
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  errorHandler,
  asyncHandler,
};
