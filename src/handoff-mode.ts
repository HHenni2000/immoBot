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

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as dotenv from 'dotenv';
import db from './database/database';

// Stealth-Plugin aktivieren (macht Bot fast unsichtbar!)
puppeteer.use(StealthPlugin());

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
  rooms?: string;
  url: string;
  imageUrl?: string;
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

// Simuliert menschliches Verhalten (Mouse-Movement, Scrolling)
async function simulateHumanBehavior(page: Page): Promise<void> {
  try {
    const viewport = page.viewport();
    if (!viewport) return;

    // Zufällige Mouse-Bewegungen (2-4 mal)
    const mouseMovements = randomDelay(2, 4);
    for (let i = 0; i < mouseMovements; i++) {
      const x = randomDelay(100, viewport.width - 100);
      const y = randomDelay(100, viewport.height - 100);
      const steps = randomDelay(15, 35);
      await page.mouse.move(x, y, { steps });
      await humanDelay(300, 800);
    }

    // Zufälliges Scrolling (1-3 mal)
    const scrolls = randomDelay(1, 3);
    for (let i = 0; i < scrolls; i++) {
      const scrollAmount = randomDelay(100, 400);
      const direction = Math.random() > 0.3 ? scrollAmount : -scrollAmount; // Meist runter, manchmal hoch
      
      await page.evaluate((amount) => {
        window.scrollBy({ top: amount, behavior: 'smooth' });
      }, direction);
      
      await humanDelay(500, 1500);
    }

    // Manchmal zurück nach oben scrollen
    if (Math.random() > 0.7) {
      await page.evaluate(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      await humanDelay(300, 700);
    }
  } catch (error) {
    // Fehler ignorieren, nicht kritisch
  }
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

async function detectCaptcha(page: Page, skipOnDetailPage = false): Promise<{ detected: boolean; reason?: string }> {
  try {
    // Option: Skip CAPTCHA check on detail/expose pages
    if (skipOnDetailPage) {
      const currentUrl = page.url();
      if (currentUrl.includes('/expose/')) {
        log('[DEBUG] CAPTCHA-Check übersprungen (Detailseite)');
        return { detected: false };
      }
    }

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
        return { detected: true, reason: `DOM-Element gefunden: ${selector}` };
      }
    }

    // Check page content for bot detection / security check pages
    // Only check for very specific bot detection phrases to avoid false positives
    const content = await page.evaluate(() => document.body.innerText.toLowerCase());
    const botDetectionKeywords = [
      'sicherheitsüberprüfung',
      'sind sie ein mensch',
      'gleich geht\'s weiter',
      'gleich gehts weiter', 
      'kein roboter',
      'schädliche software',
      'anfrage blockiert',
      'betrügerischen aktivitäten',
    ];
    
    for (const keyword of botDetectionKeywords) {
      if (content.includes(keyword)) {
        return { detected: true, reason: `Keyword gefunden: "${keyword}"` };
      }
    }

    // Check page title
    const title = await page.title();
    if (title.toLowerCase().includes('sicherheit') || 
        title.toLowerCase().includes('überprüfung') ||
        title.toLowerCase().includes('security')) {
      return { detected: true, reason: `Seiten-Titel: "${title}"` };
    }

    return { detected: false };
  } catch {
    return { detected: false };
  }
}

async function handleCaptcha(page: Page, reason?: string): Promise<void> {
  // Try Dashboard-based CAPTCHA solving first
  const dashboardSolved = await handleCaptchaViaDashboard(page, reason);
  if (dashboardSolved) {
    return;
  }

  // Fallback: Manual solving
  logWarning(`Bot-Erkennung/CAPTCHA erkannt! Bot pausiert. ${reason ? `(Grund: ${reason})` : ''}`);
  
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
  const recheckResult = await detectCaptcha(page);
  if (recheckResult.detected) {
    logWarning(`Sicherheitsprüfung scheint noch aktiv zu sein... (${recheckResult.reason})`);
    await handleCaptcha(page, recheckResult.reason); // Rekursiv
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
    const listings: Array<{id: string, title: string, address: string, price: string, size: string, rooms?: string, url: string, imageUrl?: string}> = [];
    
    // METHODE 1: Alle Links zu Exposés finden
    const exposeLinks = document.querySelectorAll('a[href*="/expose/"]');
    console.log(`[DEBUG] Gefundene Expose-Links: ${exposeLinks.length}`);
    
    const seenIds = new Set<string>();
    
    exposeLinks.forEach((link, index) => {
      try {
        const href = link.getAttribute('href') || '';
        const match = href.match(/\/expose\/(\d+)/);
        if (!match) return;
        
        const id = match[1];
        if (seenIds.has(id)) return;
        seenIds.add(id);
        
        // Versuche das Parent-Element zu finden (das Listing-Container)
        let container: Element | null = link.closest('article, [data-testid*="result"], [class*="result"], [class*="listing"], [class*="ResultList"], li, div[data-id]');
        
        // Fallback: Mehrere Parent-Ebenen durchsuchen
        if (!container) {
          let current: Element | null = link.parentElement;
          for (let i = 0; i < 5 && current; i++) {
            const classes = current.className || '';
            if (classes.includes('result') || classes.includes('listing') || classes.includes('item') || current.tagName === 'ARTICLE' || current.tagName === 'LI') {
              container = current;
              break;
            }
            current = current.parentElement;
          }
        }
        
        if (!container) {
          container = link.parentElement?.parentElement || link.parentElement || document.body;
        }
        
        // Titel aus Link-Text oder Container
        let title = '';
        if (link.textContent && link.textContent.trim().length > 10) {
          title = link.textContent.trim();
        } else {
          const titleSelectors = ['h2', 'h3', '[class*="title"]', '[class*="Title"]', '[data-testid*="title"]'];
          for (const sel of titleSelectors) {
            const el = container.querySelector(sel);
            if (el?.textContent?.trim()) {
              title = el.textContent.trim();
              break;
            }
          }
        }
        if (!title) title = `Objekt ${id}`;
        
        // Adresse suchen - ERWEITERTE Selektoren
        let address = '';
        const addressSelectors = [
          '[class*="address"]', '[class*="Address"]', 
          '[class*="location"]', '[class*="Location"]',
          '[class*="ort"]', '[class*="Ort"]',
          '[data-testid*="address"]', '[data-testid*="location"]'
        ];
        for (const sel of addressSelectors) {
          const el = container.querySelector(sel);
          if (el?.textContent?.trim()) {
            address = el.textContent.trim();
            break;
          }
        }
        
        // Preis suchen - ERWEITERTE Selektoren
        let price = '';
        const priceSelectors = [
          '[class*="price"]', '[class*="Price"]',
          '[class*="preis"]', '[class*="Preis"]',
          '[class*="kosten"]', '[class*="Kosten"]',
          '[data-testid*="price"]'
        ];
        for (const sel of priceSelectors) {
          const el = container.querySelector(sel);
          const text = el?.textContent?.trim() || '';
          if (text && (text.includes('€') || text.includes('EUR') || /\d+/.test(text))) {
            price = text;
            break;
          }
        }
        
        // Größe suchen - ERWEITERTE Selektoren
        let size = '';
        const sizeSelectors = [
          '[class*="area"]', '[class*="Area"]',
          '[class*="flaeche"]', '[class*="Flaeche"]', '[class*="Fläche"]',
          '[class*="size"]', '[class*="Size"]',
          '[class*="qm"]', '[class*="livingspace"]', '[class*="LivingSpace"]',
          '[data-testid*="area"]', '[data-testid*="size"]'
        ];
        for (const sel of sizeSelectors) {
          const el = container.querySelector(sel);
          const text = el?.textContent?.trim() || '';
          if (text && (text.includes('m²') || text.includes('qm') || /\d+/.test(text))) {
            size = text;
            break;
          }
        }
        
        // Zimmer suchen
        let rooms = '';
        const roomSelectors = [
          '[class*="room"]', '[class*="Room"]',
          '[class*="zimmer"]', '[class*="Zimmer"]',
          '[data-testid*="room"]'
        ];
        for (const sel of roomSelectors) {
          const el = container.querySelector(sel);
          const text = el?.textContent?.trim() || '';
          if (text && /\d+/.test(text)) {
            rooms = text;
            break;
          }
        }
        
        // URL
        let url = href;
        if (!url.startsWith('http')) {
          url = 'https://www.immobilienscout24.de' + url;
        }
        
        console.log(`[DEBUG] Listing ${index + 1}: ID=${id}, Title="${title.substring(0, 30)}...", Address="${address}", Price="${price}", Size="${size}"`);
        
        listings.push({ id, title, address, price, size, rooms, url, imageUrl: undefined });
      } catch (e) {
        console.error('[DEBUG] Fehler bei Link:', e);
      }
    });
    
    console.log(`[DEBUG] Extrahiert: ${listings.length} Listings`);
    
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

async function applyToListing(page: Page, listing: Listing): Promise<{ success: boolean; pdfPath?: string }> {
  try {
    log(`Öffne Inserat: ${listing.title}`);
    
    // Zur Detailseite navigieren
    await page.goto(listing.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await humanDelay(2000, 4000);

    // CAPTCHA prüfen (mit Skip auf Detailseite)
    const captchaCheck = await detectCaptcha(page, true);
    if (captchaCheck.detected) {
      log(`[DEBUG] CAPTCHA erkannt: ${captchaCheck.reason}`);
      await handleCaptcha(page, captchaCheck.reason);
      log('Fahre fort mit Bewerbung...');
    }

    // PDF erstellen BEVOR wir bewerben
    const pdfPath = await createPdf(page, listing);

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
      return { success: false, pdfPath: pdfPath || undefined };
    }

    // CAPTCHA prüfen nach Klick (Skip auf Detailseite)
    const captchaCheck2 = await detectCaptcha(page, true);
    if (captchaCheck2.detected) {
      log(`[DEBUG] CAPTCHA erkannt nach Klick: ${captchaCheck2.reason}`);
      await handleCaptcha(page, captchaCheck2.reason);
      log('Fahre fort mit Nachricht eingeben...');
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
      return { success: false, pdfPath: pdfPath || undefined };
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
      return { success: false, pdfPath: pdfPath || undefined };
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
      return { success: true, pdfPath: pdfPath || undefined }; // Als erfolgreich markieren
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

    // CAPTCHA prüfen nach Absenden (Skip auf Detailseite)
    const captchaCheck3 = await detectCaptcha(page, true);
    if (captchaCheck3.detected) {
      log(`[DEBUG] CAPTCHA erkannt nach Absenden: ${captchaCheck3.reason}`);
      await handleCaptcha(page, captchaCheck3.reason);
    }

    logSuccess(`Bewerbung gesendet für: ${listing.title}`);
    return { success: true, pdfPath: pdfPath || undefined };

  } catch (error) {
    logError(`Fehler bei Bewerbung: ${error}`);
    return { success: false };
  }
}

// ============================================
// Hauptlogik
// ============================================

async function runCheckCycle(page: Page, searchUrl: string): Promise<void> {
  // VOR dem Check: Menschliches Verhalten simulieren
  log('Simuliere menschliches Verhalten...');
  await simulateHumanBehavior(page);
  await humanDelay(1000, 3000);
  
  log('Aktualisiere Seite...');
  
  // Zur Suchseite navigieren (oder refresh wenn schon dort)
  const currentUrl = page.url();
  
  // 30% Chance: Zur Startseite gehen und dann zurück (natürlicher!)
  const shouldVisitHomepage = Math.random() > 0.7;
  
  if (shouldVisitHomepage && currentUrl.includes('immobilienscout24.de')) {
    log('Besuche Startseite...');
    await page.goto('https://www.immobilienscout24.de', { waitUntil: 'networkidle2' });
    await humanDelay(2000, 4000);
    await simulateHumanBehavior(page);
    await humanDelay(1000, 2000);
    log('Zurück zur Suche...');
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });
  } else if (currentUrl.includes('immobilienscout24.de/Suche') || currentUrl.includes('/suche/')) {
    await page.reload({ waitUntil: 'networkidle2' });
  } else {
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });
  }
  
  await humanDelay(2000, 4000);
  
  // NACH dem Reload: Auch etwas Aktivität zeigen
  await simulateHumanBehavior(page);

  // CAPTCHA prüfen (auf Suchseite)
  const captchaCheck = await detectCaptcha(page, false);
  if (captchaCheck.detected) {
    log(`[DEBUG] CAPTCHA erkannt: ${captchaCheck.reason}`);
    await handleCaptcha(page, captchaCheck.reason);
    log('Lade Suchseite neu...');
    // Nach CAPTCHA nochmal refresh
    await page.reload({ waitUntil: 'networkidle2' });
    await humanDelay(2000, 4000);
  }

  // Listings extrahieren
  const listings = await extractListings(page);
  log(`${listings.length} Angebote gefunden`);

  // Neue Listings finden (über Datenbank)
  // listings ist bereits im richtigen Format von extractListingsFromPage
  const newListings = db.insertNewListings(listings);
  
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
    
    const listingForApply: Listing = {
      id: listing.id,
      title: listing.title,
      address: listing.address,
      price: listing.price,
      size: listing.size,
      rooms: listing.rooms,
      url: listing.url,
      imageUrl: listing.imageUrl,
    };
    
    const result = await applyToListing(page, listingForApply);
    
    if (result.success) {
      logSuccess(`Bewerbung erfolgreich: ${listing.title}`);
      // Status in DB aktualisieren mit PDF-Pfad
      db.updateListingStatus(listing.id, 'applied', result.pdfPath);
    } else {
      logWarning(`Bewerbung fehlgeschlagen: ${listing.title}`);
      // Als Fehler markieren
      db.updateListingStatus(listing.id, 'error', result.pdfPath, 'Bewerbung fehlgeschlagen');
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

  // Prüfen ob DB leer ist
  const existingListings = db.getAllListings();
  const isFirstRun = existingListings.length === 0;

  if (isFirstRun) {
    log('Datenbank ist leer - alle gefundenen Angebote werden als NEU behandelt!');
  } else {
    // Nur wenn DB schon Daten hat: Erste Listings merken
    const initialListings = await extractListings(page);
    
    // In Datenbank schreiben (werden als "bekannt" markiert)
    db.insertNewListings(initialListings);
    log(`${initialListings.length} bestehende Angebote gemerkt (werden übersprungen)`);
  }

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
      
      // CAPTCHA prüfen (auf Suchseite)
      const captchaCheck = await detectCaptcha(page, false);
      if (captchaCheck.detected) {
        log(`[DEBUG] CAPTCHA erkannt: ${captchaCheck.reason}`);
        await handleCaptcha(page, captchaCheck.reason);
      }
    }

    // Nächstes Intervall berechnen
    const nextInterval = calculateNextInterval();
    log(`Nächster Check in ${formatDuration(nextInterval)}`);
    
    await sleep(nextInterval);
  }
}

// ============================================
// Dashboard CAPTCHA Solver
// ============================================

async function handleCaptchaViaDashboard(page: Page, reason?: string): Promise<boolean> {
  try {
    log('📱 Versuche CAPTCHA über Dashboard zu lösen...');
    
    // Screenshot erstellen
    const screenshotPath = path.join(SCREENSHOTS_DIR, `captcha_${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    log(`Screenshot gespeichert: ${screenshotPath}`);
    
    // Dashboard benachrichtigen
    const dashboardUrl = `http://localhost:${process.env.DASHBOARD_PORT || 3001}`;
    await fetch(`${dashboardUrl}/api/captcha/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        active: true,
        imagePath: screenshotPath,
      }),
    });
    
    log('✅ Dashboard benachrichtigt - warte auf Lösung...');
    log('📱 Öffnen Sie das Dashboard auf Ihrem iPhone/PC!');
    
    // Polling: Warte auf Lösung (max. 10 Minuten)
    const maxWaitTime = 10 * 60 * 1000; // 10 minutes
    const startTime = Date.now();
    let solution: string | null = null;
    
    while (Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Check every 3 seconds
      
      const response = await fetch(`${dashboardUrl}/api/captcha/solution`);
      const data = await response.json();
      
      if (data.resolved && data.solution) {
        solution = data.solution;
        break;
      }
    }
    
    if (!solution) {
      log('⏱️ Timeout: Keine Lösung vom Dashboard erhalten - Fallback zu manueller Lösung');
      return false;
    }
    
    log(`✅ Lösung vom Dashboard erhalten: ${solution}`);
    
    // Lösung anwenden - einfach als Info speichern
    // User muss selbst die Felder klicken im Browser
    log(`Sie haben folgende Lösung eingegeben: ${solution}`);
    log('Bitte klicken Sie jetzt die entsprechenden Felder im Browser!');
    
    await waitForEnter('Felder geklickt? ENTER drücken wenn fertig...');
    
    logSuccess('✅ CAPTCHA-Lösung angewendet!');
    return true;
    
  } catch (error) {
    logError(`Fehler bei Dashboard-CAPTCHA-Lösung: ${error}`);
    return false;
  }
}

// Start
main().catch((error) => {
  console.error('Fataler Fehler:', error);
  process.exit(1);
});
