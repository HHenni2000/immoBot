import { Page } from 'puppeteer';
import config from '../config/config';
import logger from '../utils/logger';
import browserService from './browser.service';
import { humanDelay, humanType, humanClick, scrollToElement } from '../utils/humanizer';

const IS24_LOGIN_URL = 'https://www.immobilienscout24.de/geschlossenerbereich/start.html';
const IS24_BASE_URL = 'https://www.immobilienscout24.de';

/**
 * Checks if the user is currently logged in
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    // Check for typical logged-in indicators
    const loggedInIndicators = [
      '[data-testid="user-menu"]',
      '.sso-login--logged-in',
      'a[href*="abmelden"]',
      'a[href*="logout"]',
      '.oss-header-user-icon',
    ];

    for (const selector of loggedInIndicators) {
      if (await browserService.elementExists(page, selector)) {
        logger.debug('User is logged in (found indicator)');
        return true;
      }
    }

    // Check if login button is visible (means NOT logged in)
    const loginIndicators = [
      '[data-testid="login-button"]',
      'a[href*="login"]',
      '.sso-login--logged-out',
    ];

    for (const selector of loginIndicators) {
      if (await browserService.elementExists(page, selector)) {
        logger.debug('User is not logged in (found login button)');
        return false;
      }
    }

    // Navigate to a protected page to check
    await browserService.navigateTo(page, `${IS24_BASE_URL}/meinkonto/`);
    await humanDelay(1000, 2000);

    // If redirected to login page, not logged in
    const currentUrl = page.url();
    if (currentUrl.includes('login') || currentUrl.includes('sso')) {
      logger.debug('User is not logged in (redirected to login)');
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error checking login status:', error);
    return false;
  }
}

/**
 * Logs in to ImmobilienScout24
 */
export async function login(page: Page): Promise<boolean> {
  try {
    logger.info('Attempting to log in to ImmobilienScout24...');

    // Navigate to login page
    await browserService.navigateTo(page, IS24_LOGIN_URL);
    await humanDelay(2000, 4000);

    // Check if already logged in
    if (await isLoggedIn(page)) {
      logger.info('Already logged in');
      return true;
    }

    // Handle cookie consent if present
    await handleCookieConsent(page);

    // Wait for login form
    const emailSelectors = [
      '#username',
      'input[name="username"]',
      'input[type="email"]',
      '#email',
    ];

    let emailInput: string | null = null;
    for (const selector of emailSelectors) {
      if (await browserService.waitForElement(page, selector, 5000)) {
        emailInput = selector;
        break;
      }
    }

    if (!emailInput) {
      // Maybe we need to click a login button first
      const loginButtonSelectors = [
        '[data-testid="login-button"]',
        'button[type="submit"]',
        'a[href*="login"]',
      ];

      for (const selector of loginButtonSelectors) {
        if (await browserService.elementExists(page, selector)) {
          await humanClick(page, selector);
          await humanDelay(2000, 3000);
          break;
        }
      }

      // Try email selectors again
      for (const selector of emailSelectors) {
        if (await browserService.waitForElement(page, selector, 5000)) {
          emailInput = selector;
          break;
        }
      }
    }

    if (!emailInput) {
      logger.error('Could not find email input field');
      await browserService.takeScreenshot(page, 'login_error_no_email_field');
      return false;
    }

    // Enter email
    logger.debug('Entering email...');
    await scrollToElement(page, emailInput);
    await humanDelay(500, 1000);
    await humanType(page, emailInput, config.is24Email);
    await humanDelay(500, 1500);

    // Look for password field
    const passwordSelectors = [
      '#password',
      'input[name="password"]',
      'input[type="password"]',
    ];

    let passwordInput: string | null = null;
    for (const selector of passwordSelectors) {
      if (await browserService.elementExists(page, selector)) {
        passwordInput = selector;
        break;
      }
    }

    // If password field not visible, submit email first (multi-step login)
    if (!passwordInput || !(await browserService.waitForElement(page, passwordInput, 3000))) {
      logger.debug('Submitting email first...');
      
      const submitSelectors = [
        'button[type="submit"]',
        '[data-testid="submit-button"]',
        'button:contains("Weiter")',
        'input[type="submit"]',
      ];

      for (const selector of submitSelectors) {
        if (await browserService.elementExists(page, selector)) {
          await humanClick(page, selector);
          break;
        }
      }

      await humanDelay(2000, 4000);

      // Wait for password field
      for (const selector of passwordSelectors) {
        if (await browserService.waitForElement(page, selector, 10000)) {
          passwordInput = selector;
          break;
        }
      }
    }

    if (!passwordInput) {
      logger.error('Could not find password input field');
      await browserService.takeScreenshot(page, 'login_error_no_password_field');
      return false;
    }

    // Enter password
    logger.debug('Entering password...');
    await scrollToElement(page, passwordInput);
    await humanDelay(500, 1000);
    await humanType(page, passwordInput, config.is24Password);
    await humanDelay(500, 1500);

    // Submit login form
    logger.debug('Submitting login form...');
    const submitSelectors = [
      'button[type="submit"]',
      '[data-testid="submit-button"]',
      '#loginOrRegistration',
      'button:contains("Anmelden")',
    ];

    for (const selector of submitSelectors) {
      if (await browserService.elementExists(page, selector)) {
        await humanClick(page, selector);
        break;
      }
    }

    // Wait for login to complete
    await humanDelay(3000, 5000);

    // Check for CAPTCHA or additional verification
    const captchaSelectors = [
      '[data-testid="captcha"]',
      '.captcha',
      'iframe[src*="captcha"]',
      'iframe[src*="recaptcha"]',
    ];

    for (const selector of captchaSelectors) {
      if (await browserService.elementExists(page, selector)) {
        logger.error('CAPTCHA detected! Manual intervention required.');
        await browserService.takeScreenshot(page, 'login_captcha');
        return false;
      }
    }

    // Verify login success
    const loginSuccess = await isLoggedIn(page);

    if (loginSuccess) {
      logger.info('Successfully logged in to ImmobilienScout24');
      await browserService.saveCookies(page);
    } else {
      logger.error('Login failed - not logged in after attempt');
      await browserService.takeScreenshot(page, 'login_failed');
    }

    return loginSuccess;
  } catch (error) {
    logger.error('Login error:', error);
    await browserService.takeScreenshot(page, 'login_exception');
    return false;
  }
}

/**
 * Handles cookie consent popup
 */
async function handleCookieConsent(page: Page): Promise<void> {
  try {
    const consentSelectors = [
      '#consent-accept-button',
      '[data-testid="consent-accept"]',
      'button[title*="akzeptieren"]',
      'button[title*="Akzeptieren"]',
      '.consent-accept',
      '#onetrust-accept-btn-handler',
    ];

    for (const selector of consentSelectors) {
      if (await browserService.elementExists(page, selector)) {
        logger.debug('Accepting cookie consent...');
        await humanClick(page, selector);
        await humanDelay(1000, 2000);
        break;
      }
    }
  } catch (error) {
    logger.debug('No cookie consent popup found or already accepted');
  }
}

/**
 * Ensures user is logged in, logging in if necessary
 */
export async function ensureLoggedIn(page: Page): Promise<boolean> {
  if (await isLoggedIn(page)) {
    logger.debug('Session valid, already logged in');
    return true;
  }

  logger.info('Session expired or not logged in, attempting to log in...');
  return await login(page);
}

/**
 * Logs out from ImmobilienScout24
 */
export async function logout(page: Page): Promise<void> {
  try {
    logger.info('Logging out...');

    const logoutSelectors = [
      'a[href*="abmelden"]',
      'a[href*="logout"]',
      '[data-testid="logout-button"]',
    ];

    for (const selector of logoutSelectors) {
      if (await browserService.elementExists(page, selector)) {
        await humanClick(page, selector);
        await humanDelay(2000, 3000);
        break;
      }
    }

    logger.info('Logged out successfully');
  } catch (error) {
    logger.error('Error logging out:', error);
  }
}

export default {
  isLoggedIn,
  login,
  ensureLoggedIn,
  logout,
};
