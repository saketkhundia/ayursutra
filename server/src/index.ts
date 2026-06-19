// MUST BE FIRST - Initialize configuration before anything else
import './init';

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { installAsyncErrorHandling } from './middleware/asyncErrors';

// Now we can safely use config
import { getConfig } from './config';

const config = getConfig();

// Initialize logger after config
import { getLogger, httpLogger, initializeLogger } from './utils/logger';
initializeLogger(); // Initialize logger singleton
const logger = getLogger(__filename);

// Security and middleware imports
import { securityHeaders, httpsRedirect, trustProxy } from './middleware/security';
import { getApiLimiter, getAiLimiter } from './middleware/rateLimiter';
import correlationIdMiddleware from './middleware/correlationId';
import { errorHandler } from './middleware/errorHandler';

import { initializeDatabase } from './models/database';
import { initializeRealtime } from './services/realtime';

installAsyncErrorHandling();

import { getChannelStatus } from './services/notification-service';
import patientRoutes from './routes/patients';
import practitionerRoutes from './routes/practitioners';
import therapyTypeRoutes from './routes/therapyTypes';
import treatmentPlanRoutes from './routes/treatmentPlans';
import sessionRoutes from './routes/sessions';
import notificationRoutes from './routes/notifications';
import feedbackRoutes from './routes/feedback';
import dashboardRoutes from './routes/dashboard';
import milestoneRoutes from './routes/milestones';
import aiRoutes from './routes/ai';
import availabilityRoutes from './routes/availability';
import authRoutes from './routes/auth';
import patientPortalRoutes from './routes/patientPortal';
import messagesRoutes from './routes/messages';
import appointmentsRoutes from './routes/appointments';
import recommendRoutes from './routes/recommend';

const app = express();
const httpServer = createServer(app);
const PORT = config.PORT;

// Trust proxy for deployment
trustProxy(app);

// Security headers
app.use(securityHeaders());

// HTTPS redirect
app.use(httpsRedirect);

// CORS configuration
app.use(cors({
  origin: config.NODE_ENV === 'production' 
    ? config.ALLOWED_ORIGINS.split(',')
    : (origin, callback) => callback(null, true), // Allow all in dev/staging
  credentials: true,
}));

// Request logging
app.use(httpLogger());

// Correlation ID for request tracing
app.use(correlationIdMiddleware);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Initialize all rate limiters at app startup (required by express-rate-limit)
const apiLimiterInstance = getApiLimiter();
const aiLimiterInstance = getAiLimiter();

// Global API rate limiter (after health check to avoid limiting)
app.use((req, res, next) => {
  if (req.path === '/api/health' || req.path === '/api/readiness') {
    return next();
  }
  apiLimiterInstance(req, res, next);
});

// Initialize Firebase
initializeDatabase();

// Initialize WebSocket for real-time
const io = initializeRealtime(httpServer);

// Root API endpoint
app.get('/api', (_req, res) => {
  res.json({
    message: 'AyurSutra API',
    version: '2.0.0',
    health: '/api/health',
    docs: 'See /api/health for status',
  });
});

// Health check endpoint (not rate limited)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    name: 'ATASS API',
    version: '2.0.0',
    environment: config.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Readiness check for k8s deployments
app.get('/api/readiness', (_req, res) => {
  res.json({
    ready: true,
    database: 'connected',
    websocket: 'active',
  });
});

// Notification channel status endpoint
app.get('/api/channels', (_req, res) => {
  res.json(getChannelStatus());
});

// Routes. The broad API limiter is installed globally above; avoid applying
// the same limiter again per route or each request is counted twice.
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/practitioners', practitionerRoutes);
app.use('/api/therapy-types', therapyTypeRoutes);
app.use('/api/treatment-plans', treatmentPlanRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/milestones', milestoneRoutes);

// Middleware to disable caching for AI endpoints (must run before route handlers)
app.use('/api/ai', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('ETag', 'W/"' + Date.now() + '"'); // Force new ETag
  next();
});

app.use('/api/ai', aiLimiterInstance, aiRoutes); // Stricter rate limit for ML endpoints
app.use('/api/availability', availabilityRoutes);
app.use('/api/patient-portal', patientPortalRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/recommend', recommendRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
  });
});

// Global error handler (must be last)
app.use(errorHandler);

// Start server if not running on Vercel serverless environment
if (!process.env.VERCEL) {
  httpServer.listen(PORT, () => {
    logger.info(`✓ ATASS API running on port ${PORT}`);
    logger.info(`✓ Environment: ${config.NODE_ENV}`);
    logger.info(`✓ WebSocket available on ws://localhost:${PORT}/ws`);
    logger.info(`✓ Health check: GET /api/health`);
    if (config.NODE_ENV === 'development') {
      logger.info(`ℹ Rate limiting: ${config.RATE_LIMIT_MAX_REQUESTS} requests per ${config.RATE_LIMIT_WINDOW} minutes`);
    }
  });
}

// Graceful shutdown (only relevant when server is actually listening)
if (!process.env.VERCEL) {
  process.on('SIGTERM', () => {
    logger.warn('SIGTERM received, shutting down gracefully...');
    httpServer.close(() => {
      logger.info('Server shut down');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.warn('SIGINT received, shutting down gracefully...');
    httpServer.close(() => {
      logger.info('Server shut down');
      process.exit(0);
    });
  });
}

// Prevent server crash on unhandled errors
process.on('uncaughtException', (err) => {
  logger.error('[FATAL] Uncaught exception', {
    name: err.name,
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error('[FATAL] Unhandled rejection', {
    name: error.name,
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

export default app;
