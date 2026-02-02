import { Page } from 'puppeteer';
import config from '../config/config';
import logger from '../utils/logger';
import browserService from './browser.service';
import searchService from './search.service';
import pdfService from './pdf.service';
import db from '../database/database';
import { 
  humanDelay, 
  humanType, 
  humanClick, 
  scrollToElement,
  simulateReading 
} from '../utils/humanizer';
import { ListingFromPage, ApplicationResult } from '../types/listing.types';

/**
 * Generates the message text from template
 */
function generateMessage(listing: ListingFromPage): string {
  let message = `${config.messageGreeting},

ich habe Ihre Anzeige für die Wohnung gesehen und bin sehr interessiert.

${config.messageCustom}

Mit freundlichen Grüßen`;

  // Replace placeholders if the message template contains them
  message = message
    .replace(/{greeting}/g, config.messageGreeting)
    .replace(/{address}/g, listing.address || '')
    .replace(/{price}/g, listing.price || '')
    .replace(/{size}/g, listing.size || '')
    .replace(/{title}/g, listing.title || '')
    .replace(/{custom_message}/g, config.messageCustom);

  return message;
}

/**
 * Finds and clicks the contact button
 */
async function clickContactButton(page: Page): Promise<boolean> {
  const contactButtonSelectors = [
    '[data-testid="contactform-trigger"]',
    '[data-testid="contact-button"]',
    'button[data-qa="sendButton"]',
    'a[data-qa="sendButton"]',
    '.contact-button',
    'button:contains("Nachricht schreiben")',
    'button:contains("Kontakt aufnehmen")',
    'button:contains("Anfrage senden")',
    'a[href*="kontaktformular"]',
    '.is24-button--primary',
    '[data-testid="expose-contact-box-toggle"]',
  ];

  for (const selector of contactButtonSelectors) {
    if (await browserService.elementExists(page, selector)) {
      logger.debug(`Found contact button: ${selector}`);
      await scrollToElement(page, selector);
      await humanDelay(500, 1000);
      await humanClick(page, selector);
      await humanDelay(1500, 3000);
      return true;
    }
  }

  // Try finding any button with relevant text
  const found = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, a'));
    const keywords = ['Nachricht', 'Kontakt', 'Anfrage', 'schreiben', 'senden'];
    
    for (const btn of buttons) {
      const text = btn.textContent?.toLowerCase() || '';
      if (keywords.some(kw => text.includes(kw.toLowerCase()))) {
        (btn as HTMLElement).click();
        return true;
      }
    }
    return false;
  });

  if (found) {
    await humanDelay(1500, 3000);
    return true;
  }

  return false;
}

/**
 * Fills the contact form with the message
 */
async function fillContactForm(page: Page, message: string): Promise<boolean> {
  // Wait for form to appear
  await humanDelay(1000, 2000);

  // Find message textarea
  const textareaSelectors = [
    '[data-testid="contact-form-message"]',
    'textarea[name="message"]',
    'textarea[id="message"]',
    'textarea[data-qa="message"]',
    '.contact-form textarea',
    'textarea',
  ];

  let textareaFound = false;

  for (const selector of textareaSelectors) {
    if (await browserService.waitForElement(page, selector, 5000)) {
      logger.debug(`Found message textarea: ${selector}`);
      
      // Clear existing text and type new message
      await page.click(selector, { clickCount: 3 }); // Select all
      await humanDelay(200, 400);
      
      // Type message with human-like delays
      for (const char of message) {
        await page.type(selector, char, { delay: Math.random() * 30 + 10 });
      }
      
      textareaFound = true;
      break;
    }
  }

  if (!textareaFound) {
    logger.warn('Could not find message textarea');
    return false;
  }

  await humanDelay(500, 1000);
  return true;
}

/**
 * Submits the contact form
 */
async function submitContactForm(page: Page): Promise<boolean> {
  const submitSelectors = [
    '[data-testid="contact-form-submit"]',
    'button[type="submit"]',
    'button[data-qa="submit"]',
    '.contact-form button[type="submit"]',
    'button:contains("Senden")',
    'button:contains("Absenden")',
    'input[type="submit"]',
  ];

  for (const selector of submitSelectors) {
    if (await browserService.elementExists(page, selector)) {
      logger.debug(`Found submit button: ${selector}`);
      await scrollToElement(page, selector);
      await humanDelay(500, 1000);
      await humanClick(page, selector);
      await humanDelay(2000, 4000);
      return true;
    }
  }

  // Try finding any submit button
  const submitted = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
    const keywords = ['senden', 'absenden', 'submit', 'abschicken'];
    
    for (const btn of buttons) {
      const text = (btn.textContent?.toLowerCase() || '') + 
                   ((btn as HTMLInputElement).value?.toLowerCase() || '');
      if (keywords.some(kw => text.includes(kw))) {
        (btn as HTMLElement).click();
        return true;
      }
    }
    return false;
  });

  if (submitted) {
    await humanDelay(2000, 4000);
    return true;
  }

  return false;
}

/**
 * Checks if the application was successful
 */
async function verifyApplicationSuccess(page: Page): Promise<boolean> {
  await humanDelay(1000, 2000);

  // Check for success indicators
  const successSelectors = [
    '[data-testid="contact-form-success"]',
    '.contact-form-success',
    '.success-message',
    '.is24-notification--success',
    'div:contains("erfolgreich")',
    'div:contains("Nachricht wurde gesendet")',
  ];

  for (const selector of successSelectors) {
    if (await browserService.elementExists(page, selector)) {
      return true;
    }
  }

  // Check page content for success message
  const pageContent = await page.content();
  const successKeywords = [
    'erfolgreich',
    'gesendet',
    'Vielen Dank',
    'Ihre Nachricht',
    'Anfrage wurde',
  ];

  for (const keyword of successKeywords) {
    if (pageContent.toLowerCase().includes(keyword.toLowerCase())) {
      return true;
    }
  }

  // Check for error indicators
  const errorSelectors = [
    '[data-testid="contact-form-error"]',
    '.contact-form-error',
    '.error-message',
    '.is24-notification--error',
  ];

  for (const selector of errorSelectors) {
    if (await browserService.elementExists(page, selector)) {
      return false;
    }
  }

  // If no clear success or error, assume success if form is gone
  const formStillVisible = await browserService.elementExists(page, 'textarea[name="message"]');
  return !formStillVisible;
}

/**
 * Applies to a single listing
 */
export async function applyToListing(
  page: Page,
  listing: ListingFromPage
): Promise<ApplicationResult> {
  const result: ApplicationResult = {
    success: false,
    listingId: listing.id,
  };

  try {
    logger.info(`Applying to listing ${listing.id}: ${listing.title}`);

    // Navigate to listing
    await searchService.navigateToListing(page, listing);

    // Check if listing is still available
    if (!await searchService.isListingAvailable(page)) {
      logger.warn(`Listing ${listing.id} is no longer available`);
      db.updateListingStatus(listing.id, 'skipped', undefined, 'Listing no longer available');
      result.errorMessage = 'Listing no longer available';
      return result;
    }

    // Simulate reading the listing
    await simulateReading(page, 3000);

    // Create PDF BEFORE applying (in case listing disappears)
    try {
      result.pdfPath = await pdfService.createDetailedListingPdf(page, listing);
      logger.info(`PDF created: ${result.pdfPath}`);
    } catch (pdfError) {
      logger.warn(`Failed to create PDF, trying screenshot: ${pdfError}`);
      try {
        result.pdfPath = await pdfService.createListingScreenshot(page, listing);
      } catch (screenshotError) {
        logger.error(`Failed to create screenshot: ${screenshotError}`);
      }
    }

    // Click contact button
    if (!await clickContactButton(page)) {
      logger.error(`Could not find contact button for listing ${listing.id}`);
      await browserService.takeScreenshot(page, `no_contact_button_${listing.id}`);
      db.updateListingStatus(listing.id, 'error', result.pdfPath, 'Contact button not found');
      result.errorMessage = 'Contact button not found';
      return result;
    }

    // Generate and fill message
    const message = generateMessage(listing);
    if (!await fillContactForm(page, message)) {
      logger.error(`Could not fill contact form for listing ${listing.id}`);
      await browserService.takeScreenshot(page, `no_contact_form_${listing.id}`);
      db.updateListingStatus(listing.id, 'error', result.pdfPath, 'Contact form not found');
      result.errorMessage = 'Contact form not found';
      return result;
    }

    // Submit form
    if (!await submitContactForm(page)) {
      logger.error(`Could not submit contact form for listing ${listing.id}`);
      await browserService.takeScreenshot(page, `submit_failed_${listing.id}`);
      db.updateListingStatus(listing.id, 'error', result.pdfPath, 'Form submission failed');
      result.errorMessage = 'Form submission failed';
      return result;
    }

    // Verify success
    if (await verifyApplicationSuccess(page)) {
      logger.info(`Successfully applied to listing ${listing.id}`);
      db.updateListingStatus(listing.id, 'applied', result.pdfPath);
      result.success = true;
    } else {
      logger.warn(`Application verification failed for listing ${listing.id}`);
      await browserService.takeScreenshot(page, `verification_failed_${listing.id}`);
      db.updateListingStatus(listing.id, 'error', result.pdfPath, 'Verification failed');
      result.errorMessage = 'Application verification failed';
    }

    return result;
  } catch (error) {
    logger.error(`Error applying to listing ${listing.id}:`, error);
    db.updateListingStatus(listing.id, 'error', result.pdfPath, String(error));
    result.errorMessage = String(error);
    return result;
  }
}

/**
 * Applies to multiple listings
 */
export async function applyToListings(
  page: Page,
  listings: ListingFromPage[]
): Promise<ApplicationResult[]> {
  const results: ApplicationResult[] = [];

  for (const listing of listings) {
    // Add random delay between applications to appear more human
    if (results.length > 0) {
      const delayMs = Math.random() * 30000 + 15000; // 15-45 seconds
      logger.debug(`Waiting ${Math.round(delayMs / 1000)}s before next application...`);
      await humanDelay(delayMs, delayMs);
    }

    const result = await applyToListing(page, listing);
    results.push(result);

    // Save cookies periodically
    await browserService.saveCookies(page);
  }

  return results;
}

export default {
  applyToListing,
  applyToListings,
  generateMessage,
};
