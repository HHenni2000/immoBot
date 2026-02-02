import { Page } from 'puppeteer';
import logger from './logger';

/**
 * Generates a random delay between min and max milliseconds
 */
export function randomDelay(minMs: number, maxMs: number): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

/**
 * Waits for a random amount of time to simulate human behavior
 */
export async function humanDelay(minMs: number = 500, maxMs: number = 2000): Promise<void> {
  const delay = randomDelay(minMs, maxMs);
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Types text with random delays between keystrokes to simulate human typing
 */
export async function humanType(page: Page, selector: string, text: string): Promise<void> {
  await page.waitForSelector(selector, { visible: true });
  await page.click(selector);
  await humanDelay(100, 300);

  for (const char of text) {
    await page.type(selector, char, { delay: randomDelay(50, 150) });
  }
}

/**
 * Performs a human-like click with random mouse movement
 */
export async function humanClick(page: Page, selector: string): Promise<void> {
  await page.waitForSelector(selector, { visible: true });
  
  const element = await page.$(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  const box = await element.boundingBox();
  if (!box) {
    throw new Error(`Element has no bounding box: ${selector}`);
  }

  // Click at a random position within the element
  const x = box.x + randomDelay(5, Math.max(10, box.width - 10));
  const y = box.y + randomDelay(5, Math.max(10, box.height - 10));

  await page.mouse.move(x, y, { steps: randomDelay(5, 15) });
  await humanDelay(100, 300);
  await page.mouse.click(x, y);
}

/**
 * Scrolls the page in a human-like manner
 */
export async function humanScroll(page: Page, direction: 'down' | 'up' = 'down'): Promise<void> {
  const scrollAmount = randomDelay(100, 400);
  const scrollDirection = direction === 'down' ? scrollAmount : -scrollAmount;

  await page.evaluate((amount) => {
    window.scrollBy({
      top: amount,
      behavior: 'smooth'
    });
  }, scrollDirection);

  await humanDelay(300, 800);
}

/**
 * Scrolls to the bottom of the page gradually
 */
export async function scrollToBottom(page: Page): Promise<void> {
  const scrollSteps = randomDelay(3, 6);
  
  for (let i = 0; i < scrollSteps; i++) {
    await humanScroll(page, 'down');
    await humanDelay(200, 500);
  }
}

/**
 * Scrolls to make an element visible
 */
export async function scrollToElement(page: Page, selector: string): Promise<void> {
  await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, selector);

  await humanDelay(500, 1000);
}

/**
 * Simulates reading the page by scrolling and waiting
 */
export async function simulateReading(page: Page, durationMs: number = 3000): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < durationMs) {
    if (Math.random() > 0.5) {
      await humanScroll(page, 'down');
    }
    await humanDelay(500, 1500);
  }
}

/**
 * Random user agents for rotation
 */
export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
];

/**
 * Returns a random user agent
 */
export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Common viewport sizes
 */
export const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
];

/**
 * Returns a random viewport size
 */
export function getRandomViewport(): { width: number; height: number } {
  return VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];
}

/**
 * Moves mouse randomly on the page to simulate natural behavior
 */
export async function randomMouseMovement(page: Page): Promise<void> {
  const viewport = page.viewport();
  if (!viewport) return;

  const movements = randomDelay(2, 5);
  
  for (let i = 0; i < movements; i++) {
    const x = randomDelay(100, viewport.width - 100);
    const y = randomDelay(100, viewport.height - 100);
    await page.mouse.move(x, y, { steps: randomDelay(10, 25) });
    await humanDelay(100, 300);
  }
}

export default {
  randomDelay,
  humanDelay,
  humanType,
  humanClick,
  humanScroll,
  scrollToBottom,
  scrollToElement,
  simulateReading,
  getRandomUserAgent,
  getRandomViewport,
  randomMouseMovement,
  USER_AGENTS,
  VIEWPORTS,
};
