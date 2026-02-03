# 📊 ImmoBot Dashboard

Modernes, responsives Web-Dashboard zur Überwachung des ImmoBot-Status.

## ✨ Features

- **🎯 Status-Übersicht:** Echtzeit-Status des Bots (aktiv, Nachtmodus, Fehler)
- **📈 Statistiken:** Gesamt gefundene Angebote, letzte 24h, Durchschnitt pro Tag
- **📝 Aktivitäten-Feed:** Letzte Aktionen mit klickbaren Screenshots
- **⚠️ Warnungen:** CAPTCHA-Erkennungen, Fehler, Hinweise
- **🔒 Passwort-Schutz:** Session-basierte Authentifizierung
- **📱 Responsive:** Funktioniert auf Desktop, Tablet und Smartphone

## 🚀 Setup

### 1. Dashboard-Passwort erstellen

```bash
# Hash für Ihr Passwort generieren
npx ts-node setup-dashboard-password.ts

# Geben Sie ein Passwort ein (mind. 6 Zeichen)
# Kopieren Sie den generierten Hash in die .env Datei
```

### 2. .env Konfiguration

Fügen Sie folgende Zeilen in Ihre `.env` Datei ein:

```env
# Dashboard Einstellungen
DASHBOARD_PORT=3001
DASHBOARD_SESSION_SECRET=ihr-zufälliger-secret-string-hier
DASHBOARD_PASSWORD_HASH=<generierter-hash-hier>
```

**Wichtig:** 
- Ändern Sie `DASHBOARD_SESSION_SECRET` zu einem zufälligen String!
- Fügen Sie den generierten Hash bei `DASHBOARD_PASSWORD_HASH` ein

### 3. Dependencies installieren

```bash
# Haupt-Dependencies
npm install

# Dashboard-Dependencies
cd dashboard
npm install
cd ..
```

## 🏃 Verwendung

### Development (Lokal)

```bash
# Terminal 1: Dashboard Server starten
npm run dashboard

# Terminal 2: React Dev Server (optional für Entwicklung)
npm run dashboard:dev

# Dashboard öffnen
# http://localhost:3001 (Produktion)
# http://localhost:5173 (Development mit Hot Reload)
```

### Production (VPS)

```bash
# 1. Projekt bauen
npm run build

# 2. Bot starten (läuft im Hintergrund)
npm start &

# 3. Dashboard Server starten
npm run dashboard &

# Dashboard ist nun erreichbar unter:
# http://your-vps-ip:3001
```

### Mit PM2 (empfohlen für VPS)

```bash
# PM2 installieren
npm install -g pm2

# Bot starten
pm2 start dist/index.js --name immobot

# Dashboard starten
pm2 start dist/dashboard/server.js --name dashboard

# Status prüfen
pm2 status

# Logs anzeigen
pm2 logs

# Auto-Start beim Server-Neustart
pm2 startup
pm2 save
```

## 🔧 Konfiguration

### Port ändern

In `.env`:
```env
DASHBOARD_PORT=8080  # Ihr gewünschter Port
```

### Firewall öffnen (VPS)

```bash
# Port für Dashboard öffnen
sudo ufw allow 3001/tcp

# Oder Ihren konfigurierten Port
sudo ufw allow 8080/tcp
```

## 📱 Zugriff von Mobilgerät

1. **Im lokalen Netzwerk:**
   ```
   http://192.168.x.x:3001
   ```
   (Ersetzen Sie mit der lokalen IP Ihres VPS)

2. **Über Internet:**
   ```
   http://ihre-vps-ip:3001
   ```

3. **Mit Domain (optional):**
   - Richten Sie einen Reverse Proxy (nginx) ein
   - Verwenden Sie HTTPS mit Let's Encrypt
   - Dann: `https://dashboard.ihre-domain.de`

## 🔐 Sicherheit

### Empfohlene Maßnahmen

1. **Starkes Passwort:** Mindestens 12 Zeichen, Groß-/Kleinbuchstaben, Zahlen, Sonderzeichen
2. **Session Secret ändern:** Verwenden Sie einen zufälligen String (z.B. generiert mit `openssl rand -base64 32`)
3. **HTTPS verwenden:** Richten Sie einen Reverse Proxy mit SSL-Zertifikat ein
4. **Firewall:** Beschränken Sie den Zugriff auf bestimmte IPs (optional)

### Session-Dauer

Standardmäßig läuft die Session 24 Stunden. Danach müssen Sie sich neu anmelden.

## 🎨 Screenshots

### Login
![Login Screen](docs/login.png)

### Dashboard
![Dashboard](docs/dashboard.png)

## 🐛 Troubleshooting

### Dashboard startet nicht

```bash
# Prüfen Sie, ob der Port bereits verwendet wird
sudo lsof -i :3001

# Prüfen Sie die Logs
npm run dashboard
```

### Passwort funktioniert nicht

```bash
# Neuen Hash generieren
npx ts-node setup-dashboard-password.ts

# Hash in .env eintragen
# Dashboard neu starten
```

### "Unauthorized" beim Zugriff

- Prüfen Sie, ob `DASHBOARD_PASSWORD_HASH` in `.env` gesetzt ist
- Löschen Sie Browser-Cookies und versuchen Sie erneut
- Prüfen Sie die Server-Logs

## 📄 API Endpoints

Falls Sie das Dashboard erweitern möchten:

### Auth
- `POST /api/auth/login` - Login mit Passwort
- `POST /api/auth/logout` - Logout
- `GET /api/auth/check` - Session prüfen

### Dashboard (Auth required)
- `GET /api/dashboard/stats` - Statistiken
- `GET /api/dashboard/status` - Bot-Status
- `GET /api/dashboard/activities?limit=10` - Letzte Aktivitäten
- `GET /api/dashboard/warnings` - Aktuelle Warnungen
- `GET /api/files/:filename` - Screenshot/PDF abrufen

## 🛠️ Entwicklung

### Struktur

```
dashboard/
├── src/
│   ├── components/      # React Komponenten
│   ├── api.ts          # API Client
│   ├── types.ts        # TypeScript Types
│   └── App.tsx         # Main App
├── package.json
└── vite.config.ts

src/
└── dashboard/
    └── server.ts       # Express Backend
```

### Neue Features hinzufügen

1. Backend: Erweitern Sie `src/dashboard/server.ts`
2. Frontend: Erstellen Sie neue Komponenten in `dashboard/src/components/`
3. Types: Aktualisieren Sie `dashboard/src/types.ts`

## 📞 Support

Bei Problemen oder Fragen, prüfen Sie:
1. Logs: `pm2 logs dashboard` oder direkte Konsole
2. .env Konfiguration
3. Firewall-Einstellungen
