import { Page } from 'puppeteer';
import config from '../config/config';
import logger from '../utils/logger';
import browserService from './browser.service';
import authService from './auth.service';
import db from '../database/database';
import { humanDelay, scrollToBottom, simulateReading } from '../utils/humanizer';
import { ListingFromPage } from '../types/listing.types';

/**
 * Extracts listings from the search results page
 */
export async function extractListingsFromPage(page: Page): Promise<ListingFromPage[]> {
  logger.debug('Extracting listings from page...');

  const listings = await page.evaluate(() => {
    const results: Array<{
      id: string;
      title: string;
      address: string;
      price: string;
      size: string;
      rooms?: string;
      url: string;
      imageUrl?: string;
    }> = [];

    // Common selectors for listing items
    const listingSelectors = [
      '[data-testid="result-list-entry"]',
      '.result-list__listing',
      'article[data-item="result"]',
      '.result-list-entry',
      '[data-go-to-expose-id]',
    ];

    let listingElements: Element[] = [];

    for (const selector of listingSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        listingElements = Array.from(elements);
        break;
      }
    }

    for (const element of listingElements) {
      try {
        // Extract ID from various attributes
        let id = element.getAttribute('data-go-to-expose-id') ||
                 element.getAttribute('data-id') ||
                 element.getAttribute('data-obid') ||
                 '';

        // Try to extract from link if not found
        if (!id) {
          const link = element.querySelector('a[href*="/expose/"]');
          if (link) {
            const href = link.getAttribute('href') || '';
            const match = href.match(/\/expose\/(\d+)/);
            if (match) {
              id = match[1];
            }
          }
        }

        if (!id) continue;

        // Extract title
        const titleSelectors = [
          '[data-testid="result-list-entry-title"]',
          '.result-list-entry__brand-title',
          'h2',
          '.title',
        ];
        let title = '';
        for (const sel of titleSelectors) {
          const titleEl = element.querySelector(sel);
          if (titleEl) {
            title = titleEl.textContent?.trim() || '';
            break;
          }
        }

        // Extract address
        const addressSelectors = [
          '[data-testid="result-list-entry-address"]',
          '.result-list-entry__address',
          '.address',
          '[class*="address"]',
        ];
        let address = '';
        for (const sel of addressSelectors) {
          const addressEl = element.querySelector(sel);
          if (addressEl) {
            address = addressEl.textContent?.trim() || '';
            break;
          }
        }

        // Extract price
        const priceSelectors = [
          '[data-testid="result-list-entry-price"]',
          '.result-list-entry__criteria dd:first-child',
          '[class*="price"]',
          '.price',
        ];
        let price = '';
        for (const sel of priceSelectors) {
          const priceEl = element.querySelector(sel);
          if (priceEl) {
            price = priceEl.textContent?.trim() || '';
            break;
          }
        }

        // Extract size
        const sizeSelectors = [
          '[data-testid="result-list-entry-size"]',
          '[class*="living-space"]',
          '[class*="size"]',
        ];
        let size = '';
        for (const sel of sizeSelectors) {
          const sizeEl = element.querySelector(sel);
          if (sizeEl) {
            size = sizeEl.textContent?.trim() || '';
            break;
          }
        }

        // Extract rooms
        const roomsSelectors = [
          '[data-testid="result-list-entry-rooms"]',
          '[class*="rooms"]',
          '[class*="zimmer"]',
        ];
        let rooms: string | undefined;
        for (const sel of roomsSelectors) {
          const roomsEl = element.querySelector(sel);
          if (roomsEl) {
            rooms = roomsEl.textContent?.trim();
            break;
          }
        }

        // Extract URL
        let url = '';
        const linkEl = element.querySelector('a[href*="/expose/"]');
        if (linkEl) {
          url = linkEl.getAttribute('href') || '';
          if (url && !url.startsWith('http')) {
            url = 'https://www.immobilienscout24.de' + url;
          }
        }

        // Extract image URL
        let imageUrl: string | undefined;
        const imgEl = element.querySelector('img[src*="immobilienscout24"]');
        if (imgEl) {
          imageUrl = imgEl.getAttribute('src') || undefined;
        }

        if (id && (title || address)) {
          results.push({
            id,
            title: title || `Objekt ${id}`,
            address: address || 'Adresse nicht verfügbar',
            price: price || 'Preis auf Anfrage',
            size: size || '',
            rooms,
            url: url || `https://www.immobilienscout24.de/expose/${id}`,
            imageUrl,
          });
        }
      } catch (error) {
        console.error('Error extracting listing:', error);
      }
    }

    return results;
  });

  logger.info(`Extracted ${listings.length} listings from page`);
  return listings;
}

/**
 * Checks for new listings and returns them
 */
export async function checkForNewListings(page: Page): Promise<ListingFromPage[]> {
  try {
    logger.info('Checking for new listings...');

    // Ensure logged in
    if (!await authService.ensureLoggedIn(page)) {
      throw new Error('Failed to log in');
    }

    await humanDelay(1000, 2000);

    // Navigate to search URL
    logger.debug(`Navigating to search: ${config.is24SearchUrl}`);
    await browserService.navigateTo(page, config.is24SearchUrl);
    await humanDelay(2000, 4000);

    // Handle cookie consent if present
    await handleCookieConsentOnSearch(page);

    // Simulate human reading behavior
    await simulateReading(page, 2000);

    // Scroll through results to load all
    await scrollToBottom(page);
    await humanDelay(1000, 2000);

    // Extract listings
    const allListings = await extractListingsFromPage(page);

    if (allListings.length === 0) {
      logger.warn('No listings found on page. The page structure might have changed.');
      await browserService.takeScreenshot(page, 'no_listings_found');
    }

    // Find new listings (not in database)
    const newListings = db.insertNewListings(allListings);

    // Log the check
    db.logCheck(allListings.length, newListings.length, true);

    logger.info(`Found ${allListings.length} total listings, ${newListings.length} are new`);

    return newListings;
  } catch (error) {
    logger.error('Error checking for new listings:', error);
    db.logCheck(0, 0, false, String(error));
    throw error;
  }
}

/**
 * Handles cookie consent on search page
 */
async function handleCookieConsentOnSearch(page: Page): Promise<void> {
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
        logger.debug('Accepting cookie consent on search page...');
        await page.click(selector);
        await humanDelay(1000, 2000);
        break;
      }
    }
  } catch (error) {
    // Ignore - consent might already be accepted
  }
}

/**
 * Gets the URL for a specific listing
 */
export function getListingUrl(listingId: string): string {
  return `https://www.immobilienscout24.de/expose/${listingId}`;
}

/**
 * Navigates to a specific listing page
 */
export async function navigateToListing(page: Page, listing: ListingFromPage): Promise<void> {
  const url = listing.url || getListingUrl(listing.id);
  logger.debug(`Navigating to listing: ${url}`);
  await browserService.navigateTo(page, url);
  await humanDelay(2000, 4000);
}

/**
 * Checks if the listing is still available
 */
export async function isListingAvailable(page: Page): Promise<boolean> {
  // Check for "not found" or "removed" indicators
  const unavailableSelectors = [
    '[data-testid="expose-not-found"]',
    '.expose-not-found',
    '.is24-notification--error',
    'h1:contains("nicht mehr verfügbar")',
  ];

  for (const selector of unavailableSelectors) {
    if (await browserService.elementExists(page, selector)) {
      return false;
    }
  }

  // Check page title for error
  const title = await page.title();
  if (title.toLowerCase().includes('nicht gefunden') || 
      title.toLowerCase().includes('fehler')) {
    return false;
  }

  return true;
}

export default {
  extractListingsFromPage,
  checkForNewListings,
  getListingUrl,
  navigateToListing,
  isListingAvailable,
};
