/**
 * CAPTCHA-Löser Testtool
 * 
 * Erstellt ein Test-CAPTCHA im Dashboard, damit Sie das System testen können
 */

import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DASHBOARD_URL = `http://localhost:${process.env.DASHBOARD_PORT || 3001}`;
const DATA_DIR = path.resolve(__dirname, 'data');
const SCREENSHOTS_DIR = path.join(DATA_DIR, 'screenshots');

async function createTestCaptcha() {
  console.log('🧪 CAPTCHA-Löser Testmodus');
  console.log('================================\n');

  // Prüfe ob Screenshots-Verzeichnis existiert
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  // Erstelle ein Test-CAPTCHA-Bild (einfaches Placeholder)
  const testImagePath = path.join(SCREENSHOTS_DIR, 'test_captcha.png');
  
  // Suche nach einem existierenden Screenshot
  let imagePath = testImagePath;
  const screenshots = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.png'));
  
  if (screenshots.length > 0) {
    // Nimm den neuesten Screenshot
    const latestScreenshot = screenshots.sort().pop();
    imagePath = path.join(SCREENSHOTS_DIR, latestScreenshot!);
    console.log(`✅ Verwende existierenden Screenshot: ${latestScreenshot}`);
  } else {
    // Erstelle ein einfaches Test-Bild mit Text
    console.log('⚠️  Kein Screenshot gefunden - erstelle Placeholder...');
    
    // Simple Text-basiertes "Bild" (SVG als PNG)
    const svgContent = `
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="300" fill="#f0f0f0"/>
        <text x="200" y="100" font-family="Arial" font-size="24" text-anchor="middle" fill="#333">
          TEST CAPTCHA
        </text>
        <text x="200" y="140" font-family="Arial" font-size="16" text-anchor="middle" fill="#666">
          Wählen Sie die Felder mit Ampeln:
        </text>
        
        <!-- 3x3 Grid -->
        <rect x="50" y="160" width="80" height="80" fill="#fff" stroke="#ccc" stroke-width="2"/>
        <rect x="160" y="160" width="80" height="80" fill="#fff" stroke="#ccc" stroke-width="2"/>
        <rect x="270" y="160" width="80" height="80" fill="#fff" stroke="#ccc" stroke-width="2"/>
        <rect x="50" y="250" width="80" height="80" fill="#fff" stroke="#ccc" stroke-width="2"/>
        <rect x="160" y="250" width="80" height="80" fill="#fff" stroke="#ccc" stroke-width="2"/>
        <rect x="270" y="250" width="80" height="80" fill="#fff" stroke="#ccc" stroke-width="2"/>
        
        <!-- Nummern -->
        <text x="90" y="205" font-family="Arial" font-size="40" text-anchor="middle" fill="#999">1</text>
        <text x="200" y="205" font-family="Arial" font-size="40" text-anchor="middle" fill="#999">2</text>
        <text x="310" y="205" font-family="Arial" font-size="40" text-anchor="middle" fill="#999">3</text>
        <text x="90" y="295" font-family="Arial" font-size="40" text-anchor="middle" fill="#999">4</text>
        <text x="200" y="295" font-family="Arial" font-size="40" text-anchor="middle" fill="#999">5</text>
        <text x="310" y="295" font-family="Arial" font-size="40" text-anchor="middle" fill="#999">6</text>
      </svg>
    `;
    
    fs.writeFileSync(testImagePath, svgContent);
    console.log(`✅ Test-Bild erstellt: ${testImagePath}`);
  }

  console.log('\n📡 Sende CAPTCHA an Dashboard...\n');

  try {
    const response = await fetch(`${DASHBOARD_URL}/api/captcha/set`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        active: true,
        imagePath: imagePath,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log('✅ Test-CAPTCHA aktiviert!\n');
    console.log('================================');
    console.log('📱 NÄCHSTE SCHRITTE:');
    console.log('================================\n');
    console.log('1. Öffnen Sie das Dashboard:');
    console.log(`   http://localhost:${process.env.DASHBOARD_PORT || 3001}`);
    console.log('');
    console.log('2. Sie sollten sehen:');
    console.log('   ⚠️ "CAPTCHA wartet auf Lösung!" Banner');
    console.log('');
    console.log('3. Klicken Sie auf:');
    console.log('   "CAPTCHA lösen →"');
    console.log('');
    console.log('4. Geben Sie eine Test-Lösung ein:');
    console.log('   z.B. "1,3,5"');
    console.log('');
    console.log('5. Klicken Sie:');
    console.log('   "✅ Lösung absenden"');
    console.log('');
    console.log('================================');
    console.log('');
    console.log('💡 TIPP: Sie können dieses Script jederzeit ausführen:');
    console.log('   npx ts-node test-captcha.ts');
    console.log('');

  } catch (error) {
    console.error('❌ Fehler beim Aktivieren des Test-CAPTCHAs:');
    console.error(error);
    console.log('');
    console.log('⚠️  Ist das Dashboard gestartet?');
    console.log(`   URL: ${DASHBOARD_URL}`);
    console.log('');
    console.log('   Starten Sie das Dashboard:');
    console.log('   npm run dashboard:dev');
    console.log('   oder');
    console.log('   pm2 restart dashboard');
  }
}

// Run
createTestCaptcha();
