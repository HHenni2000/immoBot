/**
 * Debug-Script zum Testen der Listing-Extraktion
 * Öffnet die Suchseite und zeigt, was extrahiert wird
 */

import puppeteer from 'puppeteer';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const DATA_DIR = path.resolve(__dirname, 'data');
const USER_DATA_DIR = path.join(DATA_DIR, 'browser-profile');
const SEARCH_URL = process.env.IS24_SEARCH_URL || '';

async function main() {
  console.log('Starte Browser für Debug...');
  
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: USER_DATA_DIR,
    defaultViewport: null,
  });

  const page = (await browser.pages())[0] || await browser.newPage();
  
  console.log('Navigiere zur Suchseite...');
  await page.goto(SEARCH_URL, { waitUntil: 'networkidle2' });
  
  console.log('\nExtrahiere Listings...\n');
  
  const listings = await page.evaluate(() => {
    const results: any[] = [];
    
    // Finde alle Expose-Links
    const exposeLinks = document.querySelectorAll('a[href*="/expose/"]');
    console.log(`Gefundene Links: ${exposeLinks.length}`);
    
    const seenIds = new Set<string>();
    
    exposeLinks.forEach((link, index) => {
      const href = link.getAttribute('href') || '';
      const match = href.match(/\/expose\/(\d+)/);
      if (!match) return;
      
      const id = match[1];
      if (seenIds.has(id)) return;
      seenIds.add(id);
      
      // Container finden
      let container = link.closest('article, [class*="result"], [class*="listing"], li, div[data-id]');
      if (!container) container = link.parentElement?.parentElement || link.parentElement;
      if (!container) {
        console.log(`Listing ${id}: Kein Container gefunden`);
        return;
      }
      
      // Alle möglichen Elemente im Container ausgeben
      const allText = container.textContent || '';
      const allClasses = Array.from(container.querySelectorAll('*'))
        .map(el => el.className)
        .filter(c => c)
        .join(', ');
      
      // Versuche Daten zu extrahieren
      const title = link.textContent?.trim() || container.querySelector('h2, h3, [class*="title"]')?.textContent?.trim() || '';
      const address = container.querySelector('[class*="address"], [class*="location"], [class*="ort"], [class*="Address"]')?.textContent?.trim() || '';
      const price = container.querySelector('[class*="price"], [class*="preis"], [class*="kosten"], [class*="Price"]')?.textContent?.trim() || '';
      const size = container.querySelector('[class*="area"], [class*="flaeche"], [class*="size"], [class*="qm"], [class*="LivingSpace"]')?.textContent?.trim() || '';
      
      console.log(`\nListing ${index + 1} (ID: ${id}):`);
      console.log(`  Titel: ${title || 'FEHLT'}`);
      console.log(`  Adresse: ${address || 'FEHLT'}`);
      console.log(`  Preis: ${price || 'FEHLT'}`);
      console.log(`  Größe: ${size || 'FEHLT'}`);
      console.log(`  URL: ${href}`);
      console.log(`  Klassen im Container: ${allClasses.substring(0, 200)}...`);
      
      results.push({ id, title, address, price, size, url: href });
    });
    
    return results;
  });
  
  console.log(`\n\nGesamt extrahiert: ${listings.length} Listings`);
  console.log('\n='.repeat(60));
  
  await new Promise(resolve => setTimeout(resolve, 60000)); // 1 Minute warten
  await browser.close();
}

main().catch(console.error);
