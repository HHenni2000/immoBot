/**
 * Manueller Browser-Modus
 * 
 * Öffnet den Browser mit dem gleichen Profil wie der Bot.
 * Sie können sich einloggen, browsen, CAPTCHAs lösen etc.
 * Alle Daten werden automatisch gespeichert für die automatischen Sessions.
 * 
 * Beenden: Drücken Sie Enter in der Konsole oder schließen Sie den Browser.
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// Pfade (gleiche wie der Bot verwendet)
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const USER_DATA_DIR = path.join(DATA_DIR, 'browser-profile');
const COOKIES_PATH = path.join(DATA_DIR, 'cookies.json');

// Sicherstellen dass Ordner existieren
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(USER_DATA_DIR)) {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
}

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║          ImmoBot - Manueller Browser-Modus                ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log('║                                                           ║');
  console.log('║  Der Browser öffnet sich jetzt. Sie können:               ║');
  console.log('║  • Sich bei ImmobilienScout24 einloggen                   ║');
  console.log('║  • CAPTCHAs lösen                                         ║');
  console.log('║  • Durch die Seite browsen                                ║');
  console.log('║  • Ihre Suche aufrufen                                    ║');
  console.log('║                                                           ║');
  console.log('║  Alle Cookies und Login-Daten werden automatisch          ║');
  console.log('║  gespeichert und für den Bot wiederverwendet!             ║');
  console.log('║                                                           ║');
  console.log('║  Zum Beenden: Enter drücken oder Browser schließen        ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  console.log('Starte Browser...');
  console.log(`Browser-Profil: ${USER_DATA_DIR}`);
  console.log('');

  const browser = await puppeteer.launch({
    headless: false, // Immer sichtbar im manuellen Modus
    userDataDir: USER_DATA_DIR,
    defaultViewport: null, // Nutze volle Fenstergröße
    args: [
      '--start-maximized',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--disable-blink-features=AutomationControlled',
      '--lang=de-DE,de',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();

  // User-Agent setzen (realistischer)
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  );

  // Automation-Eigenschaften verstecken
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    (window as any).chrome = { runtime: {} };
  });

  // Zur ImmobilienScout24 Startseite navigieren
  console.log('Öffne ImmobilienScout24...');
  await page.goto('https://www.immobilienscout24.de', { waitUntil: 'networkidle2' });

  console.log('');
  console.log('✓ Browser ist bereit!');
  console.log('');
  console.log('Sie können jetzt frei im Browser navigieren.');
  console.log('Loggen Sie sich ein, lösen Sie CAPTCHAs, etc.');
  console.log('');
  console.log('Drücken Sie ENTER wenn Sie fertig sind...');
  console.log('');

  // Warte auf Browser-Schließung oder Enter-Taste
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Promise für Enter-Taste
  const waitForEnter = new Promise<void>((resolve) => {
    rl.question('', () => {
      resolve();
    });
  });

  // Promise für Browser-Schließung
  const waitForBrowserClose = new Promise<void>((resolve) => {
    browser.on('disconnected', () => {
      resolve();
    });
  });

  // Warte auf eines von beiden
  await Promise.race([waitForEnter, waitForBrowserClose]);

  console.log('');
  console.log('Speichere Daten...');

  // Cookies speichern (zusätzlich zum userDataDir)
  try {
    const allPages = await browser.pages();
    for (const p of allPages) {
      try {
        const cookies = await p.cookies();
        if (cookies.length > 0) {
          // Bestehende Cookies laden und mergen
          let existingCookies: any[] = [];
          if (fs.existsSync(COOKIES_PATH)) {
            try {
              existingCookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
            } catch {}
          }
          
          // Neue Cookies hinzufügen/aktualisieren
          const cookieMap = new Map();
          for (const c of existingCookies) {
            cookieMap.set(`${c.domain}_${c.name}`, c);
          }
          for (const c of cookies) {
            cookieMap.set(`${c.domain}_${c.name}`, c);
          }
          
          const mergedCookies = Array.from(cookieMap.values());
          fs.writeFileSync(COOKIES_PATH, JSON.stringify(mergedCookies, null, 2));
          console.log(`✓ ${mergedCookies.length} Cookies gespeichert`);
        }
      } catch (e) {
        // Ignoriere Fehler bei einzelnen Seiten
      }
    }
  } catch (e) {
    console.log('Hinweis: Einige Cookies konnten nicht gespeichert werden');
  }

  // Browser schließen falls noch offen
  try {
    await browser.close();
  } catch {
    // Browser war schon geschlossen
  }

  rl.close();

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  ✓ Alle Daten wurden gespeichert!                         ║');
  console.log('║                                                           ║');
  console.log('║  Das Browser-Profil mit allen Cookies und Login-Daten     ║');
  console.log('║  steht dem Bot jetzt zur Verfügung.                       ║');
  console.log('║                                                           ║');
  console.log('║  Sie können den Bot jetzt mit "npm start" starten.        ║');
  console.log('║                                                           ║');
  console.log('║  Tipp: Setzen Sie SKIP_WARMUP=true in .env um die         ║');
  console.log('║  Aufwärmphase zu überspringen (Sie haben ja gerade        ║');
  console.log('║  manuell aufgewärmt).                                     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  process.exit(0);
}

main().catch((error) => {
  console.error('Fehler:', error);
  process.exit(1);
});
