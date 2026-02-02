import * as dotenv from 'dotenv';
import * as path from 'path';
import { BotConfig } from '../types/listing.types';

dotenv.config();

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

function getEnvVarInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return parsed;
}

function getEnvVarBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

const rootDir = path.resolve(__dirname, '..', '..');

export const config: BotConfig = {
  // ImmobilienScout24 Credentials
  is24Email: getEnvVar('IS24_EMAIL'),
  is24Password: getEnvVar('IS24_PASSWORD'),
  is24SearchUrl: getEnvVar('IS24_SEARCH_URL'),

  // E-Mail Konfiguration
  emailHost: getEnvVar('EMAIL_HOST', 'smtp.gmail.com'),
  emailPort: getEnvVarInt('EMAIL_PORT', 587),
  emailUser: getEnvVar('EMAIL_USER'),
  emailPassword: getEnvVar('EMAIL_PASSWORD'),
  emailTo: getEnvVar('EMAIL_TO'),

  // Scheduler
  baseIntervalMinutes: getEnvVarInt('BASE_INTERVAL_MINUTES', 10),
  randomOffsetPercent: getEnvVarInt('RANDOM_OFFSET_PERCENT', 30),
  nightModeEnabled: getEnvVarBool('NIGHT_MODE_ENABLED', true),
  nightStartHour: getEnvVarInt('NIGHT_START_HOUR', 23),
  nightEndHour: getEnvVarInt('NIGHT_END_HOUR', 7),

  // Nachrichtenvorlage
  messageGreeting: getEnvVar('MESSAGE_GREETING', 'Sehr geehrte Damen und Herren'),
  messageCustom: getEnvVar('MESSAGE_CUSTOM', 'Ich bin auf der Suche nach einer Wohnung und würde mich über eine Besichtigung freuen.'),

  // Bot-Einstellungen
  headless: getEnvVarBool('HEADLESS', true),
  skipWarmup: getEnvVarBool('SKIP_WARMUP', false),
  captchaPauseMinutes: getEnvVarInt('CAPTCHA_PAUSE_MINUTES', 30),

  // Pfade
  dataDir: path.join(rootDir, 'data'),
  logsDir: path.join(rootDir, 'logs'),
};

export default config;
