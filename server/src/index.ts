// MUST BE FIRST - Initialize configuration before anything else
import './init';

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';

// Now we can safely use config
import { getConfig } from './config';

const config = getConfig();

// Initialize logger after config
import { getLogger, httpLogger, initializeLogger } from './utils/logger';
initializeLogger();
const logger = getLogger(__filename);

// Security and middleware imports
import { securityHeaders, httpsRedirect, trustProxy } from './middleware/security';
import { getApiLimiter, getAuthLimiter, getAiLimiter } from './middleware/rateLimiter';
import correlationIdMiddleware from './middleware/correlationId';
import { errorHandler, asyncHandler } from './middleware/errorHandler';

import { initializeDatabase } from './models/database';
import { initializeRealtime } from './services/realtime';

const methods = ['get', 'post', 'put', 'delete', 'patch'] as const;
const routerProto = Object.getPrototypeOf(express.Router());
function wrapAsync(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
for (const method of methods) {
  const orig = routerProto[method];
  routerProto[method] = function (this: any, path: any, ...handlers: any[]) {
    const wrapped = handlers.map((h: any) =>
      typeof h === 'function' && h.constructor.name === 'AsyncFunction' ? wrapAsync(h) : h
    );
    return orig.call(this, path, ...wrapped);
  };
}

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

trustProxy(app);
app.use(securityHeaders());
app.use(httpsRedirect);
app.use(cors({
  origin: config.ALLOWED_ORIGINS.split(','),
  credentials: true,
}));
app.use(httpLogger());
app.use(correlationIdMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const apiLimiterInstance = getApiLimiter();
const aiLimiterInstance = getAiLimiter();

app.use((req, res, next) => {
  if (req.path === '/api/health' || req.path === '/api/readiness') return next();
  apiLimiterInstance(req, res, next);
});

initializeDatabase();
initializeRealtime(httpServer);

app.get('/api', (_req, res) => {
  res.json({ message: 'AyurSutra API', version: '2.0.0', health: '/api/health' });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'healthy', name: 'ATASS API', version: '2.0.0', environment: config.NODE_ENV, timestamp: new Date().toISOString() });
});

app.get('/api/readiness', (_req, res) => {
  res.json({ ready: true, database: 'connected', websocket: 'active' });
});

app.get('/api/channels', (_req, res) => {
  res.json(getChannelStatus());
});

app.use('/api/auth', authRoutes);
app.use('/api/patients', apiLimiterInstance, patientRoutes);
app.use('/api/practitioners', apiLimiterInstance, practitionerRoutes);
app.use('/api/therapy-types', apiLimiterInstance, therapyTypeRoutes);
app.use('/api/treatment-plans', apiLimiterInstance, treatmentPlanRoutes);
app.use('/api/sessions', apiLimiterInstance, sessionRoutes);
app.use('/api/notifications', apiLimiterInstance, notificationRoutes);
app.use('/api/feedback', apiLimiterInstance, feedbackRoutes);
app.use('/api/dashboard', apiLimiterInstance, dashboardRoutes);
app.use('/api/milestones', apiLimiterInstance, milestoneRoutes);

app.use('/api/ai', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('ETag', 'W/"' + Date.now() + '"');
  next();
});

app.use('/api/ai', aiLimiterInstance, aiRoutes);
app.use('/api/availability', apiLimiterInstance, availabilityRoutes);
app.use('/api/patient-portal', apiLimiterInstance, patientPortalRoutes);
app.use('/api/messages', apiLimiterInstance, messagesRoutes);
app.use('/api/appointments', apiLimiterInstance, appointmentsRoutes);
app.use('/api/recommend', apiLimiterInstance, recommendRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.path, method: req.method });
});

app.use(errorHandler);

// Only start the server when running locally, NOT on Vercel
if (process.env.NODE_ENV !== 'production') {
  httpServer.listen(PORT, () => {
    logger.info(`✓ ATASS API running on port ${PORT}`);
    logger.info(`✓ Environment: ${config.NODE_ENV}`);
    logger.info(`✓ Health check: GET /api/health`);
  });

  process.on('SIGTERM', () => {
    httpServer.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    httpServer.close(() => process.exit(0));
  });
}

process.on('uncaughtException', (err) => {
  logger.error('[FATAL] Uncaught exception', { name: err.name, message: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('[FATAL] Unhandled rejection', { reason });
  process.exit(1);
});

// Export for Vercel
export default app;