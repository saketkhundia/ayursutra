import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { getConfig } from '../config';

/**
 * Security headers middleware using Helmet.js
 * Protects against XSS, clickjacking, MIME sniffing, etc.
 */
export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'http://localhost:5173', 'http://localhost:5000', 'https://ayursu.vercel.app'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
}

/**
 * HTTPS redirect middleware
 * Redirects all HTTP requests to HTTPS in production
 */
export function httpsRedirect(req: Request, res: Response, next: NextFunction) {
  const config = getConfig();
  
  if (config.HTTPS_REDIRECT && req.header('x-forwarded-proto') !== 'https') {
    return res.redirect(301, `https://${req.header('host')}${req.url}`);
  }
  
  next();
}

/**
 * Trust proxy middleware
 * Necessary for getting real IP addresses behind reverse proxies
 */
export function trustProxy(app: any) {
  const config = getConfig();
  if (config.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }
}

export default {
  securityHeaders,
  httpsRedirect,
  trustProxy,
};
