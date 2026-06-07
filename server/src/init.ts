/**
 * Initialization module - runs before anything else
 * Ensures configuration is loaded first
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { loadConfig } from './config';

// Load and validate configuration immediately when this module is imported
loadConfig();

export {};
