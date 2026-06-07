import rateLimit from 'express-rate-limit';
import { getConfig } from '../config';

// Get config once at module load time
const config = getConfig();

// Initialize all rate limiters at module load time (required by express-rate-limit)
const apiLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW * 60 * 1000, // Convert minutes to milliseconds
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: 'Too many requests, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Don't rate limit health checks
    return req.path === '/api/health';
  },
});

/**
 * Stricter limiter for authentication endpoints
 * Prevents brute force login attacks
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many login attempts, please try again after 15 minutes.',
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Very strict limiter for password reset
 */
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit to 3 requests per hour
  message: {
    error: 'Too many password reset attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict limiter for AI/ML endpoints (expensive operations)
 */
const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Limit to 20 requests per 5 minutes
  message: {
    error: 'AI service rate limit exceeded, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Export functions that return already-initialized limiters
export function getApiLimiter() {
  return apiLimiter;
}

export function getAuthLimiter() {
  return authLimiter;
}

export function getResetLimiter() {
  return resetLimiter;
}

export function getAiLimiter() {
  return aiLimiter;
}

export default {
  getApiLimiter,
  getAuthLimiter,
  getResetLimiter,
  getAiLimiter,
};
