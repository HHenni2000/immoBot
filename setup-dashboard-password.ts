import bcrypt from 'bcryptjs';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('╔═══════════════════════════════════════════════════╗');
console.log('║     Dashboard Passwort Hash Generator             ║');
console.log('╚═══════════════════════════════════════════════════╝');
console.log('');

rl.question('Bitte geben Sie Ihr Dashboard-Passwort ein: ', async (password) => {
  if (!password || password.length < 6) {
    console.error('❌ Passwort muss mindestens 6 Zeichen lang sein!');
    rl.close();
    return;
  }

  console.log('');
  console.log('⏳ Generiere Hash...');
  
  const hash = await bcrypt.hash(password, 10);
  
  console.log('');
  console.log('✅ Hash erfolgreich generiert!');
  console.log('');
  console.log('Fügen Sie folgende Zeile in Ihre .env Datei ein:');
  console.log('');
  console.log('─'.repeat(60));
  console.log(`DASHBOARD_PASSWORD_HASH=${hash}`);
  console.log('─'.repeat(60));
  console.log('');
  console.log('⚠️  WICHTIG: Teilen Sie diesen Hash niemals öffentlich!');
  console.log('');
  
  rl.close();
});
