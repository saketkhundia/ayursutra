import cron from 'node-cron';
import { getLogger } from '../utils/logger';
import { getConfig } from '../config';

const logger = getLogger(__filename);

/**
 * Keep-alive service to prevent Render free tier from spinning down
 * Pings the server's health endpoint every 14 minutes
 */
export function initializeKeepAlive(): void {
  const config = getConfig();

  // Only run in production (Render environment)
  if (config.NODE_ENV !== 'production') {
    logger.info('Keep-alive service disabled in non-production environment');
    return;
  }

  // Get server URL from environment or construct from PORT
  const serverUrl = process.env.SERVER_URL || `http://localhost:${config.PORT}`;
  const healthEndpoint = `${serverUrl}/api/health`;

  // Schedule ping every 14 minutes (Render spins down after 15 minutes of inactivity)
  const cronJob = cron.schedule('*/14 * * * *', async () => {
    try {
      logger.debug('Keep-alive: Pinging health endpoint');

      const response = await fetch(healthEndpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (response.ok) {
        logger.debug('Keep-alive: Ping successful', {
          status: response.status,
          timestamp: new Date().toISOString(),
        });
      } else {
        logger.warn('Keep-alive: Ping returned non-OK status', {
          status: response.status,
          statusText: response.statusText,
        });
      }
    } catch (error) {
      // Log error but don't crash the server
      logger.error('Keep-alive: Ping failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  cronJob.start();
  logger.info('✓ Keep-alive service initialized (pinging every 14 minutes)');
}

/**
 * Stop the keep-alive service (for graceful shutdown)
 */
export function stopKeepAlive(): void {
  cron.getTasks().forEach(task => task.stop());
  logger.info('Keep-alive service stopped');
}
