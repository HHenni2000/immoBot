import { Page } from 'puppeteer';
import config from './config/config';
import logger from './utils/logger';
import { Scheduler } from './utils/scheduler';
import db from './database/database';
import browserService from './services/browser.service';
import authService from './services/auth.service';
import searchService from './services/search.service';
import applicationService from './services/application.service';
import emailService from './services/email.service';
import pdfService from './services/pdf.service';
import { ListingFromPage, ApplicationResult } from './types/listing.types';

let page: Page | null = null;
let scheduler: Scheduler | null = null;

/**
 * Main check function - called by scheduler
 */
async function performCheck(): Promise<void> {
  logger.info('='.repeat(50));
  logger.info('Starting new check cycle');
  logger.info('='.repeat(50));

  try {
    // Ensure browser is initialized
    if (!page) {
      page = await browserService.initBrowser();
    }

    // Check for new listings
    const newListings = await searchService.checkForNewListings(page);

    if (newListings.length === 0) {
      logger.info('No new listings found');
      return;
    }

    logger.info(`Found ${newListings.length} new listing(s)!`);

    // Process each new listing
    const results: ApplicationResult[] = [];

    for (const listing of newListings) {
      logger.info(`Processing listing: ${listing.title} (${listing.id})`);

      // Apply to listing
      const result = await applicationService.applyToListing(page, listing);
      results.push(result);

      // Send email notification
      if (result.success) {
        await emailService.sendApplicationSuccessNotification(listing, result);
      } else {
        await emailService.sendApplicationErrorNotification(listing, result);
      }
    }

    // Log summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    logger.info('-'.repeat(50));
    logger.info(`Check cycle complete:`);
    logger.info(`  - New listings: ${newListings.length}`);
    logger.info(`  - Successful applications: ${successful}`);
    logger.info(`  - Failed applications: ${failed}`);
    logger.info('-'.repeat(50));

  } catch (error) {
    const errorMessage = String(error);
    logger.error('Error during check cycle:', error);
    
    // Check if it's a CAPTCHA error
    if (errorMessage.toLowerCase().includes('captcha')) {
      logger.warn(`CAPTCHA detected! Pausing for ${config.captchaPauseMinutes} minutes...`);
      
      await emailService.sendErrorNotification(
        'CAPTCHA erkannt - Bot pausiert',
        `Der Bot hat ein CAPTCHA erkannt und pausiert für ${config.captchaPauseMinutes} Minuten.\n\n` +
        `Wenn dieses Problem häufig auftritt:\n` +
        `1. Erhöhen Sie BASE_INTERVAL_MINUTES auf 15-20\n` +
        `2. Setzen Sie HEADLESS=false und lösen Sie das CAPTCHA manuell\n` +
        `3. Löschen Sie den Browser-Profil-Ordner (data/browser-profile) und starten Sie neu`
      );
      
      // Close browser to reset session
      if (page) {
        try {
          await browserService.closeBrowser();
          page = null;
        } catch (closeError) {
          logger.error('Error closing browser:', closeError);
        }
      }
      
      // Wait before retrying
      const pauseMs = config.captchaPauseMinutes * 60 * 1000;
      logger.info(`Waiting ${config.captchaPauseMinutes} minutes before retrying...`);
      await new Promise(resolve => setTimeout(resolve, pauseMs));
      
      return;
    }
    
    // Send error notification for other errors
    await emailService.sendErrorNotification(
      'Fehler beim Check-Zyklus',
      errorMessage
    );

    // Try to restart browser on critical errors
    if (page) {
      try {
        await browserService.closeBrowser();
        page = null;
      } catch (closeError) {
        logger.error('Error closing browser:', closeError);
      }
    }
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  try {
    // Stop scheduler
    if (scheduler) {
      scheduler.stop();
    }

    // Close browser
    await browserService.closeBrowser();

    // Close database
    db.closeDatabase();

    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

/**
 * Validates configuration
 */
function validateConfig(): boolean {
  const requiredVars = [
    'IS24_EMAIL',
    'IS24_PASSWORD',
    'IS24_SEARCH_URL',
    'EMAIL_USER',
    'EMAIL_PASSWORD',
    'EMAIL_TO',
  ];

  const missing = requiredVars.filter(v => !process.env[v]);

  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    logger.error('Please create a .env file with the required configuration.');
    logger.error('See .env.example for reference.');
    return false;
  }

  // Validate search URL format
  if (!config.is24SearchUrl.includes('immobilienscout24.de')) {
    logger.error('Invalid IS24_SEARCH_URL. Must be an ImmobilienScout24 URL.');
    return false;
  }

  return true;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  logger.info('╔═══════════════════════════════════════════════════╗');
  logger.info('║         ImmoBot - ImmobilienScout24 Bot           ║');
  logger.info('║                                                   ║');
  logger.info('║  Automatische Wohnungssuche & Bewerbung           ║');
  logger.info('╚═══════════════════════════════════════════════════╝');
  logger.info('');

  // Validate configuration
  if (!validateConfig()) {
    process.exit(1);
  }

  // Initialize database (async)
  await db.initializeDatabase();

  // Initialize email service
  emailService.initEmailService();

  // Verify email connection
  const emailOk = await emailService.verifyEmailConnection();
  if (!emailOk) {
    logger.warn('Email verification failed. Notifications may not work.');
  }

  // Register shutdown handlers
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', async (error) => {
    logger.error('Uncaught exception:', error);
    await shutdown('uncaughtException');
  });
  process.on('unhandledRejection', async (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  });

  // Clean up old PDFs (older than 30 days)
  pdfService.cleanupOldPdfs(30);

  // Send startup notification
  await emailService.sendStartupNotification();

  // Log configuration
  logger.info('Configuration:');
  logger.info(`  - Check interval: ${config.baseIntervalMinutes} minutes (±${config.randomOffsetPercent}%)`);
  logger.info(`  - Night mode: ${config.nightModeEnabled ? `${config.nightStartHour}:00 - ${config.nightEndHour}:00` : 'Disabled'}`);
  logger.info(`  - Headless: ${config.headless}`);
  logger.info('');

  // Create and start scheduler
  scheduler = new Scheduler(performCheck);
  scheduler.start();

  logger.info('Bot is running. Press Ctrl+C to stop.');
}

// Run the bot
main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
