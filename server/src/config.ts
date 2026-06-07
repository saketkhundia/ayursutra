import { z } from 'zod';

/**
 * Server environment variables schema
 * Validates all required and optional env vars at startup
 */
const envSchema = z.object({
  // Server
  PORT: z.string().transform(Number).default('3001'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),

  // Firebase
  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  FIREBASE_PRIVATE_KEY: z.string().min(1, 'FIREBASE_PRIVATE_KEY is required'),
  FIREBASE_CLIENT_EMAIL: z.string().email('FIREBASE_CLIENT_EMAIL must be valid email'),

  // JWT & Auth
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters in production'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters in production'),
  JWT_EXPIRY: z.string().default('1h'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SENDER_EMAIL: z.string().email().optional(),

  // ML Service
  ML_SERVICE_URL: z.string().url().default('http://localhost:5000'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Rate Limiting
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('15'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  // CORS
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),

  // Security
  HTTPS_REDIRECT: z.string().transform(v => v === 'true').default('false'),
});

type EnvConfig = z.infer<typeof envSchema>;

let config: EnvConfig;

/**
 * Validate and load environment variables
 * Throws error if required vars are missing or invalid
 */
export function loadConfig(): EnvConfig {
  try {
    config = envSchema.parse(process.env);
    
    // Warn about unsafe default secrets in production
    if (config.NODE_ENV === 'production') {
      if (config.JWT_SECRET === 'atass-secret-key-2026' || config.JWT_SECRET.length < 32) {
        throw new Error('JWT_SECRET is not strong enough for production. Must be at least 32 characters.');
      }
      if (config.JWT_REFRESH_SECRET === 'atass-refresh-secret-2026' || config.JWT_REFRESH_SECRET.length < 32) {
        throw new Error('JWT_REFRESH_SECRET is not strong enough for production. Must be at least 32 characters.');
      }
    }

    console.log(`✓ Environment loaded (${config.NODE_ENV})`);
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('✗ Environment validation failed:');
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      console.error('✗ Configuration error:', error instanceof Error ? error.message : error);
    }
    process.exit(1);
  }
}

/**
 * Get a specific config value
 */
export function getConfig(): EnvConfig {
  if (!config) {
    throw new Error('Config not loaded. Call loadConfig() first.');
  }
  return config;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getConfig().NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return getConfig().NODE_ENV === 'development';
}

export default getConfig;
