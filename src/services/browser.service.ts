import puppeteer, { Browser, Page } from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import config from '../config/config';
import logger from '../utils/logger';
import { getRandomUserAgent, getRandomViewport, humanDelay, randomDelay } from '../utils/humanizer';

// Add stealth plugin to avoid detection
const stealth = StealthPlugin();
stealth.enabledEvasions.delete('chrome.runtime'); // Can cause issues
puppeteerExtra.use(stealth);

const COOKIES_PATH = path.join(config.dataDir, 'cookies.json');
const USER_DATA_DIR = path.join(config.dataDir, 'browser-profile');

let browser: Browser | null = null;
let page: Page | null = null;

/**
 * Ensures the browser profile directory exists
 */
function ensureUserDataDir(): void {
  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
    logger.info('Created browser profile directory');
  }
}

/**
 * Initializes the browser with stealth settings
 */
export async function initBrowser(): Promise<Page> {
  logger.info('Initializing browser...');

  ensureUserDataDir();

  const viewport = getRandomViewport();
  const userAgent = getRandomUserAgent();

  // Use persistent user data directory to maintain cookies, localStorage, etc.
  browser = await puppeteerExtra.launch({
    headless: config.headless,
    userDataDir: USER_DATA_DIR,
    protocolTimeout: 240000, // 4 minutes timeout for protocol operations
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      `--window-size=${viewport.width},${viewport.height}`,
      '--lang=de-DE,de',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
    ],
    defaultViewport: viewport,
    ignoreDefaultArgs: ['--enable-automation'],
  });

  page = await browser.newPage();

  // Set user agent
  await page.setUserAgent(userAgent);

  // Set extra headers to appear more like a real browser
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
  });

  // Override navigator properties to avoid detection
  await page.evaluateOnNewDocument(() => {
    // Override webdriver property
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // Override chrome property
    (window as any).chrome = {
      runtime: {},
      loadTimes: function() {},
      csi: function() {},
      app: {},
    };

    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    (window.navigator.permissions.query as any) = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
        : originalQuery(parameters);

    // Override plugins to seem more realistic
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const plugins = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
          { name: 'Native Client', filename: 'internal-nacl-plugin' },
        ];
        return plugins;
      },
    });

    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['de-DE', 'de', 'en-US', 'en'],
    });

    // Override platform
    Object.defineProperty(navigator, 'platform', {
      get: () => 'Win32',
    });

    // Override hardware concurrency
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 8,
    });

    // Override device memory
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => 8,
    });
  });

  // Load cookies if they exist (additional to userDataDir)
  await loadCookies(page);

  logger.info(`Browser initialized with viewport ${viewport.width}x${viewport.height}`);
  
  // Perform warmup on first launch (unless skipped)
  if (!config.skipWarmup) {
    await performWarmup(page);
  } else {
    logger.info('Skipping warmup (SKIP_WARMUP=true)');
  }
  
  return page;
}

/**
 * Performs a warmup phase to appear more like a real user
 */
async function performWarmup(page: Page): Promise<void> {
  logger.info('Performing browser warmup to avoid detection...');

  try {
    // First, visit a neutral page (Google) to establish browsing history
    logger.debug('Visiting Google...');
    await page.goto('https://www.google.de', { waitUntil: 'networkidle2', timeout: 30000 });
    await humanDelay(2000, 4000);

    // Simulate some mouse movement
    const viewport = page.viewport();
    if (viewport) {
      for (let i = 0; i < 3; i++) {
        const x = randomDelay(100, viewport.width - 100);
        const y = randomDelay(100, viewport.height - 100);
        await page.mouse.move(x, y, { steps: randomDelay(10, 20) });
        await humanDelay(200, 500);
      }
    }

    // Now visit ImmobilienScout24 main page (not directly search/login)
    logger.debug('Visiting ImmobilienScout24 main page...');
    await page.goto('https://www.immobilienscout24.de', { waitUntil: 'networkidle2', timeout: 60000 });
    await humanDelay(3000, 6000);

    // Accept cookie consent if present
    await handleCookieConsent(page);

    // Scroll around a bit
    for (let i = 0; i < 3; i++) {
      await page.evaluate((amount) => {
        window.scrollBy({ top: amount, behavior: 'smooth' });
      }, randomDelay(100, 300));
      await humanDelay(500, 1500);
    }

    // Random mouse movements
    if (viewport) {
      for (let i = 0; i < 5; i++) {
        const x = randomDelay(100, viewport.width - 100);
        const y = randomDelay(100, viewport.height - 100);
        await page.mouse.move(x, y, { steps: randomDelay(10, 25) });
        await humanDelay(300, 800);
      }
    }

    // Wait a bit more
    await humanDelay(2000, 4000);

    // Save cookies after warmup
    await saveCookies(page);

    logger.info('Browser warmup completed');
  } catch (error) {
    logger.warn('Warmup had issues, continuing anyway:', error);
  }
}

/**
 * Handles cookie consent popup
 */
async function handleCookieConsent(page: Page): Promise<void> {
  try {
    const consentSelectors = [
      '#consent-accept-button',
      '[data-testid="uc-accept-all-button"]',
      'button[title*="akzeptieren"]',
      'button[title*="Akzeptieren"]',
      '.consent-accept',
      '#onetrust-accept-btn-handler',
      'button:has-text("Alle akzeptieren")',
      'button:has-text("Zustimmen")',
    ];

    for (const selector of consentSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          logger.debug('Accepting cookie consent...');
          await humanDelay(500, 1000);
          await element.click();
          await humanDelay(1000, 2000);
          break;
        }
      } catch {
        // Continue to next selector
      }
    }
  } catch (error) {
    logger.debug('No cookie consent popup found or already accepted');
  }
}

/**
 * Gets the current page or initializes a new browser
 */
export async function getPage(): Promise<Page> {
  if (!page || !browser || !browser.isConnected()) {
    return await initBrowser();
  }
  return page;
}

/**
 * Closes the browser
 */
export async function closeBrowser(): Promise<void> {
  if (page) {
    // Save cookies before closing
    await saveCookies(page);
  }

  if (browser) {
    await browser.close();
    browser = null;
    page = null;
    logger.info('Browser closed');
  }
}

/**
 * Saves cookies to file for session persistence
 */
export async function saveCookies(page: Page): Promise<void> {
  try {
    const cookies = await page.cookies();
    
    // Ensure data directory exists
    if (!fs.existsSync(config.dataDir)) {
      fs.mkdirSync(config.dataDir, { recursive: true });
    }
    
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    logger.debug('Cookies saved');
  } catch (error) {
    logger.error('Failed to save cookies:', error);
  }
}

/**
 * Loads cookies from file
 */
export async function loadCookies(page: Page): Promise<boolean> {
  try {
    if (fs.existsSync(COOKIES_PATH)) {
      const cookiesJson = fs.readFileSync(COOKIES_PATH, 'utf-8');
      const cookies = JSON.parse(cookiesJson);
      
      if (cookies.length > 0) {
        await page.setCookie(...cookies);
        logger.debug('Cookies loaded');
        return true;
      }
    }
  } catch (error) {
    logger.error('Failed to load cookies:', error);
  }
  return false;
}

/**
 * Navigates to a URL with retry logic
 */
export async function navigateTo(
  page: Page,
  url: string,
  options: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'; retries?: number } = {}
): Promise<void> {
  const { waitUntil = 'networkidle2', retries = 3 } = options;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.debug(`Navigating to ${url} (attempt ${attempt}/${retries})`);
      
      // Add random delay before navigation
      await humanDelay(1000, 3000);
      
      await page.goto(url, { waitUntil, timeout: 60000 });
      await humanDelay(1000, 2000);
      
      // Check for CAPTCHA immediately after navigation
      if (await detectCaptcha(page)) {
        logger.warn('CAPTCHA detected after navigation!');
        await takeScreenshot(page, 'captcha_detected');
        throw new Error('CAPTCHA detected');
      }
      
      return;
    } catch (error) {
      logger.warn(`Navigation failed (attempt ${attempt}/${retries}):`, error);
      
      if (attempt === retries) {
        throw error;
      }
      
      await humanDelay(5000, 10000);
    }
  }
}

/**
 * Detects if a CAPTCHA is present on the page
 */
export async function detectCaptcha(page: Page): Promise<boolean> {
  const captchaSelectors = [
    '[data-testid="captcha"]',
    '.captcha',
    'iframe[src*="captcha"]',
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    '#challenge-running',
    '#challenge-form',
    '.cf-browser-verification',
    '[class*="captcha"]',
    '[id*="captcha"]',
    'img[src*="captcha"]',
  ];

  for (const selector of captchaSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        return true;
      }
    } catch {
      // Continue checking
    }
  }

  // Check page content for CAPTCHA keywords
  try {
    const content = await page.content();
    const captchaKeywords = [
      'captcha',
      'robot',
      'bot-check',
      'challenge',
      'verification required',
      'Sicherheitsüberprüfung',
    ];

    for (const keyword of captchaKeywords) {
      if (content.toLowerCase().includes(keyword.toLowerCase())) {
        // Double check - might be false positive
        const visibleText = await page.evaluate(() => document.body.innerText);
        if (visibleText.toLowerCase().includes('robot') || 
            visibleText.toLowerCase().includes('captcha') ||
            visibleText.toLowerCase().includes('sicherheit')) {
          return true;
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return false;
}

/**
 * Takes a screenshot for debugging
 */
export async function takeScreenshot(page: Page, name: string): Promise<string> {
  const screenshotsDir = path.join(config.dataDir, 'screenshots');
  
  // Ensure screenshots directory exists
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  
  const screenshotPath = path.join(screenshotsDir, `${name}_${Date.now()}.png`);
  
  try {
    await page.screenshot({ 
      path: screenshotPath, 
      fullPage: true,
      timeout: 30000 // 30 seconds timeout for screenshot
    });
    logger.debug(`Screenshot saved: ${screenshotPath}`);
  } catch (error) {
    logger.warn(`Screenshot failed: ${error}`);
    throw error; // Re-throw for caller to handle
  }
  
  return screenshotPath;
}

/**
 * Waits for navigation to complete
 */
export async function waitForNavigation(page: Page, timeout: number = 30000): Promise<void> {
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout });
}

/**
 * Checks if an element exists on the page
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  try {
    const element = await page.$(selector);
    return element !== null;
  } catch {
    return false;
  }
}

/**
 * Waits for an element to appear
 */
export async function waitForElement(
  page: Page,
  selector: string,
  timeout: number = 10000
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { visible: true, timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets text content of an element
 */
export async function getTextContent(page: Page, selector: string): Promise<string | null> {
  try {
    const element = await page.$(selector);
    if (!element) return null;
    
    const text = await page.evaluate(el => el.textContent, element);
    return text?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Restarts the browser (useful for long-running sessions)
 */
export async function restartBrowser(): Promise<Page> {
  logger.info('Restarting browser...');
  await closeBrowser();
  await humanDelay(5000, 10000);
  return await initBrowser();
}

/**
 * Clears browser profile (use when stuck in CAPTCHA loop)
 */
export function clearBrowserProfile(): void {
  logger.info('Clearing browser profile...');
  
  try {
    if (fs.existsSync(USER_DATA_DIR)) {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
      logger.info('Browser profile cleared');
    }
    
    if (fs.existsSync(COOKIES_PATH)) {
      fs.unlinkSync(COOKIES_PATH);
      logger.info('Cookies cleared');
    }
  } catch (error) {
    logger.error('Failed to clear browser profile:', error);
  }
}

export default {
  initBrowser,
  getPage,
  closeBrowser,
  saveCookies,
  loadCookies,
  navigateTo,
  takeScreenshot,
  waitForNavigation,
  elementExists,
  waitForElement,
  getTextContent,
  restartBrowser,
  detectCaptcha,
  clearBrowserProfile,
};
