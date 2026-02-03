import { Page } from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import config from '../config/config';
import logger from '../utils/logger';
import { ListingFromPage } from '../types/listing.types';
import { humanDelay, scrollToBottom } from '../utils/humanizer';

const PDF_DIR = path.join(config.dataDir, 'pdfs');

// Ensure PDF directory exists
if (!fs.existsSync(PDF_DIR)) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}

/**
 * Sanitizes a string for use in filenames
 */
function sanitizeFilename(str: string): string {
  return str
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 50)
    .trim();
}

/**
 * Generates a filename for the PDF
 */
function generatePdfFilename(listing: ListingFromPage): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const sanitizedAddress = sanitizeFilename(listing.address || 'unbekannt');
  return `${timestamp}_${listing.id}_${sanitizedAddress}.pdf`;
}

/**
 * Creates a PDF of the current page
 */
export async function createListingPdf(page: Page, listing: ListingFromPage): Promise<string> {
  try {
    logger.info(`Creating PDF for listing ${listing.id}...`);

    // Scroll through the page to load all images
    await scrollToBottom(page);
    await humanDelay(1000, 2000);

    // Wait for images to load
    await page.evaluate(async () => {
      const images = document.querySelectorAll('img');
      await Promise.all(
        Array.from(images).map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.addEventListener('load', resolve);
            img.addEventListener('error', resolve);
            setTimeout(resolve, 5000); // Timeout after 5 seconds
          });
        })
      );
    });

    await humanDelay(500, 1000);

    // Generate filename
    const filename = generatePdfFilename(listing);
    const pdfPath = path.join(PDF_DIR, filename);

    // Create PDF with optimal settings
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 10px; text-align: center; width: 100%; padding: 5px;">
          <span>ImmobilienScout24 - ${listing.title || listing.id}</span>
        </div>
      `,
      footerTemplate: `
        <div style="font-size: 10px; text-align: center; width: 100%; padding: 5px;">
          <span>Erstellt am: ${new Date().toLocaleDateString('de-DE')} | 
          Seite <span class="pageNumber"></span> von <span class="totalPages"></span></span>
        </div>
      `,
    });

    logger.info(`PDF created: ${pdfPath}`);
    return pdfPath;
  } catch (error) {
    logger.error(`Failed to create PDF for listing ${listing.id}:`, error);
    throw error;
  }
}

/**
 * Creates a PDF with additional metadata
 */
export async function createDetailedListingPdf(
  page: Page,
  listing: ListingFromPage
): Promise<string> {
  try {
    // Add metadata overlay to the page before creating PDF
    await page.evaluate((listingData) => {
      // Create metadata banner
      const banner = document.createElement('div');
      banner.id = 'immobot-metadata';
      banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #f5f5f5;
        border-bottom: 2px solid #ff7300;
        padding: 10px 20px;
        font-family: Arial, sans-serif;
        font-size: 12px;
        z-index: 99999;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      `;
      banner.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto;">
          <strong style="color: #ff7300;">📋 Bewerbung gesendet</strong>
          <div style="margin-top: 5px; display: flex; gap: 20px; flex-wrap: wrap;">
            <span><strong>ID:</strong> ${listingData.id}</span>
            <span><strong>Adresse:</strong> ${listingData.address}</span>
            <span><strong>Preis:</strong> ${listingData.price}</span>
            <span><strong>Größe:</strong> ${listingData.size}</span>
            <span><strong>Erfasst:</strong> ${new Date().toLocaleString('de-DE')}</span>
          </div>
        </div>
      `;
      document.body.insertBefore(banner, document.body.firstChild);
      
      // Add padding to body to account for banner
      document.body.style.paddingTop = '80px';
    }, listing);

    // Create the PDF
    const pdfPath = await createListingPdf(page, listing);

    // Remove the metadata overlay
    await page.evaluate(() => {
      const banner = document.getElementById('immobot-metadata');
      if (banner) banner.remove();
      document.body.style.paddingTop = '';
    });

    return pdfPath;
  } catch (error) {
    logger.error(`Failed to create detailed PDF for listing ${listing.id}:`, error);
    // Try creating a simple PDF as fallback
    return await createListingPdf(page, listing);
  }
}

/**
 * Takes a screenshot as fallback if PDF fails
 */
export async function createListingScreenshot(
  page: Page,
  listing: ListingFromPage
): Promise<string> {
  try {
    logger.info(`Creating screenshot for listing ${listing.id}...`);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const sanitizedAddress = sanitizeFilename(listing.address || 'unbekannt');
    const filename = `${timestamp}_${listing.id}_${sanitizedAddress}.png`;
    const screenshotPath = path.join(PDF_DIR, filename);

    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      timeout: 30000, // 30 seconds timeout for screenshot
    });

    logger.info(`Screenshot created: ${screenshotPath}`);
    return screenshotPath;
  } catch (error) {
    logger.error(`Failed to create screenshot for listing ${listing.id}:`, error);
    throw error;
  }
}

/**
 * Gets all PDFs for a specific listing
 */
export function getListingPdfs(listingId: string): string[] {
  try {
    const files = fs.readdirSync(PDF_DIR);
    return files
      .filter((f) => f.includes(`_${listingId}_`))
      .map((f) => path.join(PDF_DIR, f));
  } catch (error) {
    return [];
  }
}

/**
 * Deletes old PDFs (older than specified days)
 */
export function cleanupOldPdfs(daysOld: number = 30): number {
  try {
    const files = fs.readdirSync(PDF_DIR);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(PDF_DIR, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} old PDF files`);
    }

    return deletedCount;
  } catch (error) {
    logger.error('Error cleaning up old PDFs:', error);
    return 0;
  }
}

export default {
  createListingPdf,
  createDetailedListingPdf,
  createListingScreenshot,
  getListingPdfs,
  cleanupOldPdfs,
};
