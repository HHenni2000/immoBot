import * as dotenv from 'dotenv';
import config from './src/config/config';

// Load environment variables
dotenv.config();

console.log('='.repeat(60));
console.log('Nachtmodus Test');
console.log('='.repeat(60));
console.log('');

// Timezone info
const now = new Date();
console.log('Zeitinformationen:');
console.log(`  System-Zeit (UTC):    ${now.toUTCString()}`);
console.log(`  System-Zeit (Lokal):  ${now.toString()}`);
console.log(`  Deutsche Zeit:        ${now.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}`);
console.log(`  Aktuelle Stunde:      ${now.getHours()}`);
console.log(`  Zeitzone Offset:      UTC${now.getTimezoneOffset() > 0 ? '-' : '+'}${Math.abs(now.getTimezoneOffset() / 60)}`);
console.log('');

// Configuration
console.log('Konfiguration:');
console.log(`  NIGHT_MODE_ENABLED:   ${config.nightModeEnabled}`);
console.log(`  NIGHT_START_HOUR:     ${config.nightStartHour}:00`);
console.log(`  NIGHT_END_HOUR:       ${config.nightEndHour}:00`);
console.log('');

// Test isNightMode logic
const currentHour = now.getHours();
let isNight = false;

if (config.nightModeEnabled) {
  if (config.nightStartHour > config.nightEndHour) {
    // e.g., 23:00 to 07:00
    isNight = currentHour >= config.nightStartHour || currentHour < config.nightEndHour;
    console.log('Logik: Nachtmodus über Mitternacht (23:00 - 07:00)');
  } else {
    // e.g., 01:00 to 06:00
    isNight = currentHour >= config.nightStartHour && currentHour < config.nightEndHour;
    console.log('Logik: Nachtmodus innerhalb eines Tages');
  }
} else {
  console.log('Logik: Nachtmodus deaktiviert');
}

console.log('');
console.log('Ergebnis:');
console.log(`  Aktuelle Stunde:      ${currentHour}`);
console.log(`  Ist Nachtmodus:       ${isNight ? '✓ JA (Bot sollte SCHLAFEN)' : '✗ NEIN (Bot sollte LAUFEN)'}`);

if (isNight) {
  // Calculate when night mode ends
  const endTime = new Date(now);
  endTime.setHours(config.nightEndHour, 0, 0, 0);
  
  if (endTime <= now) {
    endTime.setDate(endTime.getDate() + 1);
  }
  
  const msUntilEnd = endTime.getTime() - now.getTime();
  const hours = Math.floor(msUntilEnd / (1000 * 60 * 60));
  const minutes = Math.floor((msUntilEnd % (1000 * 60 * 60)) / (1000 * 60));
  
  console.log(`  Nachtmodus endet in:  ${hours}h ${minutes}m (um ${endTime.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })})`);
}

console.log('');
console.log('='.repeat(60));
console.log('');

// Show hourly schedule
console.log('24-Stunden Übersicht (welche Stunden sind Nachtmodus):');
for (let hour = 0; hour < 24; hour++) {
  let isNightForHour = false;
  
  if (config.nightModeEnabled) {
    if (config.nightStartHour > config.nightEndHour) {
      isNightForHour = hour >= config.nightStartHour || hour < config.nightEndHour;
    } else {
      isNightForHour = hour >= config.nightStartHour && hour < config.nightEndHour;
    }
  }
  
  const marker = hour === currentHour ? '←' : ' ';
  const status = isNightForHour ? '🌙 SCHLAF' : '☀️ AKTIV';
  console.log(`  ${String(hour).padStart(2, '0')}:00 ${status} ${marker}`);
}

console.log('');
console.log('='.repeat(60));
