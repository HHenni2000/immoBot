/**
 * ImmoBot - Handoff-Modus
 * 
 * Sie starten den Browser, loggen sich ein, navigieren zur Suche.
 * Dann übernimmt der Bot und macht nur noch:
 * - Seite aktualisieren
 * - Neue Angebote erkennen
 * - Automatisch bewerben
 * 
 * Bei CAPTCHA: Bot pausiert, Sie lösen es, drücken Enter, Bot macht weiter.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as dotenv from 'dotenv';
import db from './database/database';

dotenv.config();

// Konfiguration
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const USER_DATA_DIR = path.join(DATA_DIR, 'browser-profile');
const PDF_DIR = path.join(DATA_DIR, 'pdfs');
const COOKIES_PATH = path.join(DATA_DIR, 'cookies.json');

// Aus .env laden
const BASE_INTERVAL_MINUTES = parseInt(process.env.BASE_INTERVAL_MINUTES || '10', 10);
const RANDOM_OFFSET_PERCENT = parseInt(process.env.RANDOM_OFFSET_PERCENT || '30', 10);
const MESSAGE_GREETING = process.env.MESSAGE_GREETING || 'Sehr geehrte Damen und Herren';
const MESSAGE_CUSTOM = process.env.MESSAGE_CUSTOM || 'Ich bin auf der Suche nach einer Wohnung und würde mich über eine Besichtigung freuen.';

// TESTMODUS: true = Nicht wirklich absenden, nur Screenshot als Beweis
const DRY_RUN = process.env.DRY_RUN === 'true';
const SCREENSHOTS_DIR = path.join(DATA_DIR, 'screenshots');

// Ordner erstellen
[DATA_DIR, USER_DATA_DIR, PDF_DIR, SCREENSHOTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Bekannte Listing-IDs (aus Datenbank laden)
let knownListingIds = new Set<string>();

// Readline Interface
let rl: readline.Interface;

interface Listing {
  id: string;
  title: string;
  address: string;
  price: string;
  size: string;
  url: string;
}

// ============================================
// Hilfsfunktionen
// ============================================

function log(message: string) {
  const timestamp = new Date().toLocaleTimeString('de-DE');
  console.log(`[${timestamp}] ${message}`);
}

function logError(message: string) {
  const timestamp = new Date().toLocaleTimeString('de-DE');
  console.error(`[${timestamp}] ❌ ${message}`);
}

function logSuccess(message: string) {
  const timestamp = new Date().toLocaleTimeString('de-DE');
  console.log(`[${timestamp}] ✅ ${message}`);
}

function logWarning(message: string) {
  const timestamp = new Date().toLocaleTimeString('de-DE');
  console.log(`[${timestamp}] ⚠️  ${message}`);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function humanDelay(minMs: number = 500, maxMs: number = 2000): Promise<void> {
  await sleep(randomDelay(minMs, maxMs));
}

function calculateNextInterval(): number {
  const baseMs = BASE_INTERVAL_MINUTES * 60 * 1000;
  const offsetPercent = RANDOM_OFFSET_PERCENT / 100;
  const randomFactor = (Math.random() - 0.5) * 2 * offsetPercent;
  return Math.max(60000, Math.round(baseMs * (1 + randomFactor)));
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`;
}

async function waitForEnter(prompt: string = 'Drücken Sie ENTER um fortzufahren...'): Promise<void> {
  return new Promise((resolve) => {
    rl.question(`\n>>> ${prompt}\n`, () => {
      resolve();
    });
  });
}

// ============================================
// CAPTCHA Erkennung
// ============================================

async function detectCaptcha(page: Page): Promise<boolean> {
  try {
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
    ];

    for (const selector of captchaSelectors) {
      const element = await page.$(selector);
      if (element) {
        return true;
      }
    }

    // Check page content for bot detection / security check pages
    const content = await page.evaluate(() => document.body.innerText.toLowerCase());
    const botDetectionKeywords = [
      'captcha',
      'robot',
      'roboter',
      'sicherheitsüberprüfung',
      'sind sie ein mensch',
      'gleich geht\'s weiter',
      'gleich gehts weiter', 
      'kein roboter',
      'schädliche software',
      'anfrage blockiert',
      'anfrage-id anzeigen',
      'betrügerischen aktivitäten',
    ];
    
    for (const keyword of botDetectionKeywords) {
      if (content.includes(keyword)) {
        return true;
      }
    }

    // Check page title
    const title = await page.title();
    if (title.toLowerCase().includes('sicherheit') || 
        title.toLowerCase().includes('überprüfung') ||
        title.toLowerCase().includes('security')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

async function handleCaptcha(page: Page): Promise<void> {
  logWarning('Bot-Erkennung/CAPTCHA erkannt! Bot pausiert.');
  
  // Versuche zu erkennen welche Art von Sperre es ist
  const pageContent = await page.evaluate(() => document.body.innerText).catch(() => '');
  const isWaitPage = pageContent.toLowerCase().includes('gleich geht') || 
                     pageContent.toLowerCase().includes('einigen sekunden');
  
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  ⚠️  BOT-ERKENNUNG / SICHERHEITSPRÜFUNG - BOT PAUSIERT     ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  
  if (isWaitPage) {
    console.log('║                                                           ║');
    console.log('║  Es wird eine "Gleich geht\'s weiter"-Seite angezeigt.     ║');
    console.log('║                                                           ║');
    console.log('║  Mögliche Lösungen:                                       ║');
    console.log('║  1. Warten Sie einige Sekunden - oft löst es sich selbst  ║');
    console.log('║  2. Falls nicht: Seite manuell neu laden (F5)             ║');
    console.log('║  3. Falls blockiert: Browser schließen, später neu        ║');
    console.log('║                                                           ║');
  } else {
    console.log('║                                                           ║');
    console.log('║  Bitte lösen Sie das CAPTCHA/die Sicherheitsprüfung       ║');
    console.log('║  im Browser-Fenster.                                      ║');
    console.log('║                                                           ║');
  }
  
  console.log('║  Wenn die normale Seite wieder angezeigt wird:            ║');
  console.log('║  → Drücken Sie ENTER hier in der Konsole                  ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  
  await waitForEnter('Seite wieder normal? ENTER drücken um fortzufahren...');
  
  // Kurz warten nach Lösung
  await humanDelay(2000, 4000);
  
  // Prüfen ob Bot-Erkennung wirklich weg ist
  if (await detectCaptcha(page)) {
    logWarning('Sicherheitsprüfung scheint noch aktiv zu sein...');
    await handleCaptcha(page); // Rekursiv
  } else {
    logSuccess('Sicherheitsprüfung überwunden! Bot macht weiter.');
  }
}

// ============================================
// Listing-Extraktion
// ============================================

async function extractListings(page: Page): Promise<Listing[]> {
  // Debug: Screenshot für Analyse
  const debugScreenshot = path.join(SCREENSHOTS_DIR, `debug_extraction_${Date.now()}.png`);
  try {
    await page.screenshot({ 
      path: debugScreenshot, 
      fullPage: false
    });
    log(`Debug-Screenshot: ${debugScreenshot}`);
  } catch (error) {
    logWarning(`Screenshot fehlgeschlagen (wird übersprungen): ${error}`);
  }

  const results = await page.evaluate(() => {
    const listings: Array<{id: string, title: string, address: string, price: string, size: string, url: string}> = [];
    
    // METHODE 1: Alle Links zu Exposés finden
    const exposeLinks = document.querySelectorAll('a[href*="/expose/"]');
    console.log(`[DEBUG] Gefundene Expose-Links: ${exposeLinks.length}`);
    
    const seenIds = new Set<string>();
    
    exposeLinks.forEach(link => {
      try {
        const href = link.getAttribute('href') || '';
        const match = href.match(/\/expose\/(\d+)/);
        if (!match) return;
        
        const id = match[1];
        if (seenIds.has(id)) return;
        seenIds.add(id);
        
        // Versuche das Parent-Element zu finden (das Listing-Container)
        let container = link.closest('article, [class*="result"], [class*="listing"], li, div[data-id]');
        if (!container) container = link.parentElement?.parentElement || link.parentElement;
        if (!container) return;
        
        // Titel aus Link-Text oder Container
        let title = link.textContent?.trim() || '';
        if (!title || title.length < 5) {
          const h2 = container.querySelector('h2, h3, [class*="title"]');
          title = h2?.textContent?.trim() || `Objekt ${id}`;
        }
        
        // Adresse suchen
        let address = '';
        const addressEl = container.querySelector('[class*="address"], [class*="location"], [class*="ort"]');
        if (addressEl) {
          address = addressEl.textContent?.trim() || '';
        }
        
        // Preis suchen
        let price = '';
        const priceEl = container.querySelector('[class*="price"], [class*="preis"], [class*="kosten"]');
        if (priceEl) {
          price = priceEl.textContent?.trim() || '';
        }
        
        // Größe suchen
        let size = '';
        const sizeEl = container.querySelector('[class*="area"], [class*="flaeche"], [class*="size"], [class*="qm"]');
        if (sizeEl) {
          size = sizeEl.textContent?.trim() || '';
        }
        
        // URL
        let url = href;
        if (!url.startsWith('http')) {
          url = 'https://www.immobilienscout24.de' + url;
        }
        
        listings.push({ id, title, address, price, size, url });
      } catch (e) {
        console.error('[DEBUG] Fehler bei Link:', e);
      }
    });
    
    // METHODE 2: Falls keine Links gefunden, versuche andere Selektoren
    if (listings.length === 0) {
      console.log('[DEBUG] Keine Links gefunden, versuche alternative Selektoren...');
      
      const containers = document.querySelectorAll(
        '[data-testid="result-list-entry"], ' +
        '.result-list__listing, ' +
        'article[data-item], ' +
        '[data-go-to-expose-id], ' +
        '.result-list-entry, ' +
        '[class*="ResultListEntry"], ' +
        '[class*="result-list"]'
      );
      
      console.log(`[DEBUG] Alternative Container gefunden: ${containers.length}`);
      
      containers.forEach(el => {
        try {
          let id = el.getAttribute('data-go-to-expose-id') ||
                   el.getAttribute('data-id') ||
                   el.getAttribute('data-obid') || '';
          
          if (!id) {
            const linkInside = el.querySelector('a[href*="/expose/"]');
            if (linkInside) {
              const m = linkInside.getAttribute('href')?.match(/\/expose\/(\d+)/);
              if (m) id = m[1];
            }
          }
          
          if (!id || seenIds.has(id)) return;
          seenIds.add(id);
          
          const title = el.querySelector('h2, h3, [class*="title"]')?.textContent?.trim() || `Objekt ${id}`;
          const address = el.querySelector('[class*="address"]')?.textContent?.trim() || '';
          const price = el.querySelector('[class*="price"]')?.textContent?.trim() || '';
          const size = el.querySelector('[class*="area"], [class*="size"]')?.textContent?.trim() || '';
          
          listings.push({
            id,
            title,
            address,
            price,
            size,
            url: `https://www.immobilienscout24.de/expose/${id}`
          });
        } catch (e) {
          // Skip
        }
      });
    }
    
    // Debug: Zeige was auf der Seite ist
    console.log(`[DEBUG] Finale Listings: ${listings.length}`);
    console.log(`[DEBUG] Seiten-URL: ${window.location.href}`);
    console.log(`[DEBUG] Body hat ${document.body.children.length} direkte Kinder`);
    
    return listings;
  });

  // Wenn keine gefunden, zeige Warnung
  if (results.length === 0) {
    logWarning('Keine Angebote gefunden! Mögliche Ursachen:');
    console.log('  - Die Seite hat sich geändert');
    console.log('  - Sie sind auf der falschen Seite');
    console.log('  - Die Suche hat wirklich 0 Ergebnisse');
    console.log(`  - Debug-Screenshot: ${debugScreenshot}`);
  }

  return results;
}

// ============================================
// PDF erstellen
// ============================================

async function createPdf(page: Page, listing: Listing): Promise<string | null> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const safeAddress = listing.address.replace(/[<>:"/\\|?*]/g, '').substring(0, 30);
    const filename = `${timestamp}_${listing.id}_${safeAddress}.pdf`;
    const pdfPath = path.join(PDF_DIR, filename);

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
    });

    log(`PDF erstellt: ${filename}`);
    return pdfPath;
  } catch (error) {
    logError(`PDF-Erstellung fehlgeschlagen: ${error}`);
    return null;
  }
}

// ============================================
// Bewerbung senden
// ============================================

async function applyToListing(page: Page, listing: Listing): Promise<boolean> {
  try {
    log(`Öffne Inserat: ${listing.title}`);
    
    // Zur Detailseite navigieren
    await page.goto(listing.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await humanDelay(2000, 4000);

    // CAPTCHA prüfen
    if (await detectCaptcha(page)) {
      await handleCaptcha(page);
    }

    // PDF erstellen BEVOR wir bewerben
    await createPdf(page, listing);

    // Kontakt-Button finden und klicken
    const contactSelectors = [
      '[data-testid="contactform-trigger"]',
      '[data-testid="contact-button"]',
      'button[data-qa="sendButton"]',
      'a[data-qa="sendButton"]',
      '.is24-button--primary',
    ];

    let clicked = false;
    for (const selector of contactSelectors) {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        clicked = true;
        await humanDelay(1500, 3000);
        break;
      }
    }

    if (!clicked) {
      // Versuche via Text zu finden
      clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        for (const btn of buttons) {
          const text = btn.textContent?.toLowerCase() || '';
          if (text.includes('nachricht') || text.includes('kontakt') || text.includes('anfrage')) {
            (btn as HTMLElement).click();
            return true;
          }
        }
        return false;
      });
      
      if (clicked) await humanDelay(1500, 3000);
    }

    if (!clicked) {
      logWarning(`Kein Kontakt-Button gefunden für ${listing.id}`);
      return false;
    }

    // CAPTCHA prüfen nach Klick
    if (await detectCaptcha(page)) {
      await handleCaptcha(page);
    }

    // Nachricht eingeben
    const message = `${MESSAGE_GREETING},

ich habe Ihre Anzeige gesehen und bin sehr interessiert.

${MESSAGE_CUSTOM}

Mit freundlichen Grüßen`;

    const textareaSelectors = [
      'textarea[name="message"]',
      'textarea[id="message"]',
      '[data-testid="contact-form-message"]',
      'textarea',
    ];

    let typed = false;
    for (const selector of textareaSelectors) {
      const textarea = await page.$(selector);
      if (textarea) {
        await textarea.click({ clickCount: 3 });
        await humanDelay(200, 400);
        await textarea.type(message, { delay: randomDelay(10, 30) });
        typed = true;
        break;
      }
    }

    if (!typed) {
      logWarning(`Kein Textfeld gefunden für ${listing.id}`);
      return false;
    }

    await humanDelay(500, 1000);

    // Absenden-Button finden
    const submitSelectors = [
      'button[type="submit"]',
      '[data-testid="contact-form-submit"]',
      'input[type="submit"]',
    ];

    let submitButtonFound = false;
    for (const selector of submitSelectors) {
      const btn = await page.$(selector);
      if (btn) {
        submitButtonFound = true;
        break;
      }
    }

    if (!submitButtonFound) {
      // Versuche via Text zu finden
      submitButtonFound = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        for (const btn of buttons) {
          const text = (btn.textContent?.toLowerCase() || '') + ((btn as any).value?.toLowerCase() || '');
          if (text.includes('senden') || text.includes('absenden')) {
            return true;
          }
        }
        return false;
      });
    }

    if (!submitButtonFound) {
      logWarning(`Absende-Button nicht gefunden für ${listing.id}`);
      return false;
    }

    // ═══════════════════════════════════════════════════════════
    // TESTMODUS (DRY_RUN): Screenshot machen, NICHT absenden
    // ═══════════════════════════════════════════════════════════
    if (DRY_RUN) {
      // Screenshot als Beweis erstellen
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const screenshotPath = path.join(SCREENSHOTS_DIR, `TESTLAUF_${timestamp}_${listing.id}.png`);
      
      try {
        await page.screenshot({ 
          path: screenshotPath, 
          fullPage: true
        });
        
        console.log('');
        console.log('  ╔═══════════════════════════════════════════════════════╗');
        console.log('  ║  🧪 TESTMODUS - NICHT WIRKLICH ABGESENDET             ║');
        console.log('  ╠═══════════════════════════════════════════════════════╣');
        console.log(`  ║  Listing: ${listing.id.padEnd(43)}║`);
        console.log('  ║  Status: Formular ausgefüllt, Absende-Button gefunden ║');
        console.log('  ║  Beweis: Screenshot erstellt                          ║');
        console.log(`  ║  → ${screenshotPath.substring(screenshotPath.length - 50).padEnd(51)}║`);
        console.log('  ╚═══════════════════════════════════════════════════════╝');
        console.log('');
      } catch (error) {
        logWarning(`Screenshot fehlgeschlagen: ${error}`);
        console.log('');
        console.log('  ╔═══════════════════════════════════════════════════════╗');
        console.log('  ║  🧪 TESTMODUS - NICHT WIRKLICH ABGESENDET             ║');
        console.log('  ╠═══════════════════════════════════════════════════════╣');
        console.log(`  ║  Listing: ${listing.id.padEnd(43)}║`);
        console.log('  ║  Status: Formular ausgefüllt, Absende-Button gefunden ║');
        console.log('  ║  Beweis: Screenshot fehlgeschlagen                    ║');
        console.log('  ╚═══════════════════════════════════════════════════════╝');
        console.log('');
      }
      
      logSuccess(`[TESTMODUS] Bewerbung WÜRDE funktionieren für: ${listing.title}`);
      return true; // Als erfolgreich markieren
    }

    // ═══════════════════════════════════════════════════════════
    // ECHTER MODUS: Wirklich absenden
    // ═══════════════════════════════════════════════════════════
    // Klicke den Submit-Button
    let submitClicked = false;
    for (const selector of submitSelectors) {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        submitClicked = true;
        break;
      }
    }
    
    if (!submitClicked) {
      // Via evaluate klicken
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        for (const btn of buttons) {
          const text = (btn.textContent?.toLowerCase() || '') + ((btn as any).value?.toLowerCase() || '');
          if (text.includes('senden') || text.includes('absenden')) {
            (btn as HTMLElement).click();
            break;
          }
        }
      });
    }
    
    await humanDelay(2000, 4000);

    // CAPTCHA prüfen nach Absenden
    if (await detectCaptcha(page)) {
      await handleCaptcha(page);
    }

    logSuccess(`Bewerbung gesendet für: ${listing.title}`);
    return true;

  } catch (error) {
    logError(`Fehler bei Bewerbung: ${error}`);
    return false;
  }
}

// ============================================
// Hauptlogik
// ============================================

async function runCheckCycle(page: Page, searchUrl: string): Promise<void> {
  log('Aktualisiere Seite...');
  
  // Zur Suchseite navigieren (oder refresh wenn schon dort)
  const currentUrl = page.url();
  if (currentUrl.includes('immobilienscout24.de/Suche') || currentUrl.includes('/suche/')) {
    await page.reload({ waitUntil: 'networkidle2' });
  } else {
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });
  }
  
  await humanDelay(2000, 4000);

  // CAPTCHA prüfen
  if (await detectCaptcha(page)) {
    await handleCaptcha(page);
    // Nach CAPTCHA nochmal refresh
    await page.reload({ waitUntil: 'networkidle2' });
    await humanDelay(2000, 4000);
  }

  // Listings extrahieren
  const listings = await extractListings(page);
  log(`${listings.length} Angebote gefunden`);

  // In Datenbank-Format konvertieren
  const listingsForDb = listings.map(l => ({
    id: l.id,
    title: l.title,
    address: l.address,
    price: l.price,
    size: l.size,
    rooms: undefined,
    url: l.url,
    imageUrl: undefined,
  }));

  // Neue Listings finden (über Datenbank)
  const newListings = db.insertNewListings(listingsForDb);
  
  // Check loggen
  db.logCheck(listings.length, newListings.length, true);

  if (newListings.length === 0) {
    log('Keine neuen Angebote');
    return;
  }

  logSuccess(`${newListings.length} NEUE Angebote gefunden!`);
  
  for (const listing of newListings) {
    console.log(`   → ${listing.title} | ${listing.price} | ${listing.address}`);
  }

  // Auf jedes neue Listing bewerben
  for (const listing of newListings) {
    console.log('');
    log(`Bewerbe auf: ${listing.title}`);
    
    const listingForApply = {
      id: listing.id,
      title: listing.title,
      address: listing.address,
      price: listing.price,
      size: listing.size,
      url: listing.url,
    };
    
    const success = await applyToListing(page, listingForApply);
    
    if (success) {
      logSuccess(`Bewerbung erfolgreich: ${listing.title}`);
      // Status in DB aktualisieren
      db.updateListingStatus(listing.id, 'applied');
    } else {
      logWarning(`Bewerbung fehlgeschlagen: ${listing.title}`);
      // Als Fehler markieren
      db.updateListingStatus(listing.id, 'error', undefined, 'Bewerbung fehlgeschlagen');
    }

    // Zurück zur Suche
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });
    await humanDelay(3000, 6000);
  }
}

// ============================================
// Hauptprogramm
// ============================================

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  if (DRY_RUN) {
    console.log('║      ImmoBot - Handoff-Modus  🧪 TESTMODUS AKTIV          ║');
  } else {
    console.log('║          ImmoBot - Handoff-Modus                          ║');
  }
  console.log('╠═══════════════════════════════════════════════════════════╣');
  if (DRY_RUN) {
    console.log('║                                                           ║');
    console.log('║  ⚠️  TESTMODUS: Bewerbungen werden NICHT abgesendet!       ║');
    console.log('║      Stattdessen wird ein Screenshot als Beweis erstellt. ║');
    console.log('║      Zum Deaktivieren: DRY_RUN=false in .env setzen       ║');
    console.log('║                                                           ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
  }
  console.log('║                                                           ║');
  console.log('║  PHASE 1: Sie übernehmen                                  ║');
  console.log('║  ─────────────────────────────                            ║');
  console.log('║  • Loggen Sie sich bei ImmobilienScout24 ein              ║');
  console.log('║  • Lösen Sie eventuelle CAPTCHAs                          ║');
  console.log('║  • Navigieren Sie zu Ihrer Suche                          ║');
  console.log('║  • Drücken Sie ENTER wenn Sie bereit sind                 ║');
  console.log('║                                                           ║');
  console.log('║  PHASE 2: Bot übernimmt                                   ║');
  console.log('║  ─────────────────────────                                ║');
  console.log('║  • Bot aktualisiert die Seite regelmäßig                  ║');
  console.log('║  • Bei neuen Angeboten: automatische Bewerbung            ║');
  console.log('║  • Bei CAPTCHA: Bot pausiert, Sie lösen, ENTER drücken    ║');
  console.log('║                                                           ║');
  console.log('║  Zum Beenden: Strg+C oder Browser schließen               ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  // Readline setup
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  log('Starte Browser...');
  
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: USER_DATA_DIR,
    defaultViewport: null,
    protocolTimeout: 240000, // 4 minutes timeout for protocol operations
    args: [
      '--start-maximized',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--disable-blink-features=AutomationControlled',
      '--lang=de-DE,de',
      '--enable-javascript',
      '--enable-features=NetworkService,NetworkServiceInProcess',
      '--disable-features=IsolateOrigins,site-per-process,TranslateUI',
      '--disable-web-security',
      '--allow-running-insecure-content',
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-popup-blocking',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
    ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=IdleDetection'],
  });

  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();

  // Realistischer User-Agent (aktueller Chrome)
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );

  // JavaScript und andere Browser-Features korrekt setzen
  await page.setJavaScriptEnabled(true);
  
  // Vollständige Anti-Detection Overrides
  await page.evaluateOnNewDocument(() => {
    // Webdriver verstecken
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    
    // Chrome-Objekt simulieren
    (window as any).chrome = {
      runtime: {
        onMessage: { addListener: () => {} },
        sendMessage: () => {},
      },
      loadTimes: () => ({}),
      csi: () => ({}),
      app: { isInstalled: false },
    };

    // Permissions API korrigieren
    const originalQuery = window.navigator.permissions.query;
    (window.navigator.permissions as any).query = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
        : originalQuery(parameters);

    // Plugins simulieren (nicht leer)
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
      ],
    });

    // Languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['de-DE', 'de', 'en-US', 'en'],
    });

    // Platform
    Object.defineProperty(navigator, 'platform', {
      get: () => 'Win32',
    });

    // Hardware Concurrency
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 8,
    });

    // Device Memory
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => 8,
    });

    // Connection (simuliere echte Netzwerkverbindung)
    Object.defineProperty(navigator, 'connection', {
      get: () => ({
        effectiveType: '4g',
        rtt: 50,
        downlink: 10,
        saveData: false,
      }),
    });
  });

  // ImmobilienScout24 öffnen
  log('Öffne ImmobilienScout24...');
  await page.goto('https://www.immobilienscout24.de', { waitUntil: 'networkidle2' });

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  PHASE 1: Sie sind dran!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('  1. Loggen Sie sich ein');
  console.log('  2. Lösen Sie CAPTCHAs falls nötig');
  console.log('  3. Navigieren Sie zu Ihrer gespeicherten Suche');
  console.log('  4. Wenn die Suchergebnisse angezeigt werden:');
  console.log('');
  
  await waitForEnter('Bereit? ENTER drücken um den Bot zu starten...');

  // Datenbank initialisieren
  await db.initializeDatabase();
  log('Datenbank initialisiert');

  // Aktuelle URL speichern (das ist die Suche)
  const searchUrl = page.url();
  log(`Suche-URL gespeichert: ${searchUrl}`);

  // Erste Listings merken (damit wir nicht auf bereits vorhandene bewerben)
  const initialListings = await extractListings(page);
  const initialListingsForDb = initialListings.map(l => ({
    id: l.id,
    title: l.title,
    address: l.address,
    price: l.price,
    size: l.size,
    rooms: undefined,
    url: l.url,
    imageUrl: undefined,
  }));
  
  // In Datenbank schreiben (werden als "bekannt" markiert)
  db.insertNewListings(initialListingsForDb);
  log(`${initialListings.length} bestehende Angebote gemerkt (werden übersprungen)`);

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  PHASE 2: Bot übernimmt!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Prüf-Intervall: ${BASE_INTERVAL_MINUTES} Minuten (±${RANDOM_OFFSET_PERCENT}%)`);
  if (DRY_RUN) {
    console.log('  🧪 TESTMODUS: Bewerbungen werden NICHT abgesendet');
    console.log('     Screenshots werden gespeichert in: data/screenshots/');
  } else {
    console.log('  📤 ECHTER MODUS: Bewerbungen werden abgesendet');
  }
  console.log('  Bei CAPTCHA: Bot pausiert und wartet auf Sie');
  console.log('  Zum Beenden: Strg+C');
  console.log('');

  // Browser-Schließung abfangen
  browser.on('disconnected', () => {
    log('Browser wurde geschlossen. Beende...');
    rl.close();
    process.exit(0);
  });

  // Hauptschleife
  let checkCount = 0;
  
  while (true) {
    checkCount++;
    console.log('');
    log(`━━━ Check #${checkCount} ━━━`);
    
    try {
      await runCheckCycle(page, searchUrl);
    } catch (error) {
      logError(`Fehler: ${error}`);
      
      // CAPTCHA prüfen
      if (await detectCaptcha(page)) {
        await handleCaptcha(page);
      }
    }

    // Nächstes Intervall berechnen
    const nextInterval = calculateNextInterval();
    log(`Nächster Check in ${formatDuration(nextInterval)}`);
    
    await sleep(nextInterval);
  }
}

// Start
main().catch((error) => {
  console.error('Fataler Fehler:', error);
  process.exit(1);
});
