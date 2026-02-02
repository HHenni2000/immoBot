import config from '../config/config';
import logger from './logger';

/**
 * Calculates the next check interval with randomization
 */
export function calculateNextInterval(): number {
  const baseMs = config.baseIntervalMinutes * 60 * 1000;
  const offsetPercent = config.randomOffsetPercent / 100;
  
  // Random offset between -offsetPercent and +offsetPercent
  const randomFactor = (Math.random() - 0.5) * 2 * offsetPercent;
  const intervalMs = baseMs * (1 + randomFactor);
  
  // Ensure minimum interval of 1 minute
  return Math.max(60000, Math.round(intervalMs));
}

/**
 * Checks if currently in night mode hours
 */
export function isNightMode(): boolean {
  if (!config.nightModeEnabled) {
    return false;
  }

  const now = new Date();
  const currentHour = now.getHours();

  // Handle cases where night spans midnight
  if (config.nightStartHour > config.nightEndHour) {
    // e.g., 23:00 to 07:00
    return currentHour >= config.nightStartHour || currentHour < config.nightEndHour;
  } else {
    // e.g., 01:00 to 06:00
    return currentHour >= config.nightStartHour && currentHour < config.nightEndHour;
  }
}

/**
 * Calculates milliseconds until night mode ends
 */
export function getMsUntilNightModeEnds(): number {
  if (!isNightMode()) {
    return 0;
  }

  const now = new Date();
  const endTime = new Date(now);
  
  endTime.setHours(config.nightEndHour, 0, 0, 0);
  
  // If end time is in the past (e.g., it's 2am and end is 7am), it's today
  // If end time is in the future of start time crossing midnight, adjust
  if (endTime <= now) {
    endTime.setDate(endTime.getDate() + 1);
  }

  return endTime.getTime() - now.getTime();
}

/**
 * Formats milliseconds into human-readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  } else if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Returns a promise that resolves after the specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Scheduler class for managing check intervals
 */
export class Scheduler {
  private isRunning: boolean = false;
  private currentTimeout: NodeJS.Timeout | null = null;
  private checkCount: number = 0;
  private onCheck: () => Promise<void>;

  constructor(onCheck: () => Promise<void>) {
    this.onCheck = onCheck;
  }

  /**
   * Starts the scheduler
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Scheduler is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Scheduler started');
    this.scheduleNextCheck(true);
  }

  /**
   * Stops the scheduler
   */
  stop(): void {
    this.isRunning = false;
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
    logger.info('Scheduler stopped');
  }

  /**
   * Schedules the next check
   */
  private scheduleNextCheck(immediate: boolean = false): void {
    if (!this.isRunning) {
      return;
    }

    // Check for night mode
    if (isNightMode()) {
      const sleepDuration = getMsUntilNightModeEnds();
      logger.info(`Night mode active. Sleeping until ${config.nightEndHour}:00 (${formatDuration(sleepDuration)})`);
      
      this.currentTimeout = setTimeout(() => {
        this.scheduleNextCheck(true);
      }, sleepDuration);
      return;
    }

    // Calculate next interval
    const interval = immediate ? 0 : calculateNextInterval();

    if (interval > 0) {
      logger.info(`Next check in ${formatDuration(interval)}`);
    }

    this.currentTimeout = setTimeout(async () => {
      try {
        this.checkCount++;
        logger.info(`Starting check #${this.checkCount}`);
        
        await this.onCheck();
        
        logger.info(`Check #${this.checkCount} completed`);
      } catch (error) {
        logger.error(`Check #${this.checkCount} failed:`, error);
      }

      // Schedule next check
      this.scheduleNextCheck();
    }, interval);
  }

  /**
   * Forces an immediate check
   */
  async forceCheck(): Promise<void> {
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
    }
    
    try {
      this.checkCount++;
      logger.info(`Starting forced check #${this.checkCount}`);
      await this.onCheck();
      logger.info(`Forced check #${this.checkCount} completed`);
    } catch (error) {
      logger.error(`Forced check #${this.checkCount} failed:`, error);
    }

    if (this.isRunning) {
      this.scheduleNextCheck();
    }
  }

  /**
   * Gets the current check count
   */
  getCheckCount(): number {
    return this.checkCount;
  }

  /**
   * Checks if the scheduler is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}

export default {
  calculateNextInterval,
  isNightMode,
  getMsUntilNightModeEnds,
  formatDuration,
  sleep,
  Scheduler,
};
