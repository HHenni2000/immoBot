# ImmoBot - ImmobilienScout24 Automatisierung

Ein automatisierter Bot zur Überwachung von Wohnungsangeboten auf ImmobilienScout24 mit automatischer Interessensbekundung.

## Features

- **Automatische Überwachung**: Prüft Ihre gespeicherte Suche in unregelmäßigen Abständen
- **Sofortige Bewerbung**: Sendet automatisch Interesse an neue Angebote
- **PDF-Dokumentation**: Erstellt PDFs der Inserate bevor sie verschwinden
- **E-Mail-Benachrichtigung**: Informiert Sie über neue Angebote und Bewerbungen
- **Anti-Bot-Maßnahmen**: Simuliert menschliches Verhalten um Blockaden zu vermeiden
- **Nachtmodus**: Pausiert während der Nacht

## Schnellstart

### 1. Voraussetzungen

- Node.js 18 oder höher
- Chrome/Chromium Browser (wird automatisch mit Puppeteer installiert)

### 2. Installation

```bash
# Abhängigkeiten installieren
npm install

# TypeScript kompilieren
npm run build
```

### 3. Konfiguration

```bash
# Beispiel-Konfiguration kopieren
cp .env.example .env

# .env Datei mit Ihren Daten ausfüllen
# Öffnen Sie die Datei in einem Texteditor
```

**Wichtige Einstellungen in der `.env` Datei:**

| Variable | Beschreibung |
|----------|-------------|
| `IS24_EMAIL` | Ihre ImmobilienScout24 E-Mail |
| `IS24_PASSWORD` | Ihr ImmobilienScout24 Passwort |
| `IS24_SEARCH_URL` | URL Ihrer gespeicherten Suche |
| `EMAIL_USER` | E-Mail für Benachrichtigungen |
| `EMAIL_PASSWORD` | App-Passwort für E-Mail |
| `EMAIL_TO` | Empfänger der Benachrichtigungen |

### 4. Bot starten

```bash
# Entwicklungsmodus (mit ts-node)
npm run dev

# Produktionsmodus
npm run build
npm start
```

## Konfiguration im Detail

### Intervall-Einstellungen

```env
BASE_INTERVAL_MINUTES=10    # Prüfintervall in Minuten
RANDOM_OFFSET_PERCENT=30    # Zufällige Abweichung (±30%)
```

Der Bot prüft alle 7-13 Minuten (bei obigen Einstellungen), um menschliches Verhalten zu simulieren.

### Nachtmodus

```env
NIGHT_MODE_ENABLED=true
NIGHT_START_HOUR=23         # Pause ab 23:00 Uhr
NIGHT_END_HOUR=7            # Fortsetzung ab 07:00 Uhr
```

### Nachrichtenvorlage

Die Bewerbungsnachricht kann in der `.env` Datei angepasst werden:

```env
MESSAGE_GREETING=Sehr geehrte Damen und Herren
MESSAGE_CUSTOM=Ich bin berufstätig und verfüge über alle Unterlagen.
```

## E-Mail Einrichtung

### Gmail

1. [2-Faktor-Authentifizierung aktivieren](https://myaccount.google.com/security)
2. [App-Passwort erstellen](https://myaccount.google.com/apppasswords)
3. App-Passwort in `.env` eintragen

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=ihre-email@gmail.com
EMAIL_PASSWORD=xxxx-xxxx-xxxx-xxxx  # App-Passwort
```

### Andere Anbieter

| Anbieter | Host | Port |
|----------|------|------|
| GMX | mail.gmx.net | 587 |
| Web.de | smtp.web.de | 587 |
| Outlook | smtp.office365.com | 587 |

## Server-Deployment

### Option 1: VPS mit PM2

```bash
# Node.js installieren
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Chrome-Abhängigkeiten installieren
sudo apt-get install -y chromium-browser

# PM2 installieren
npm install -g pm2

# Bot starten
cd /pfad/zu/immoBot
npm install
npm run build
pm2 start dist/index.js --name immobot

# Auto-Start bei Server-Neustart
pm2 startup
pm2 save
```

### Option 2: Docker

```dockerfile
FROM node:18-slim

# Chrome-Abhängigkeiten
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

CMD ["node", "dist/index.js"]
```

```bash
# Docker Image bauen
docker build -t immobot .

# Container starten
docker run -d --name immobot --env-file .env immobot
```

## Projektstruktur

```
immoBot/
├── src/
│   ├── config/
│   │   └── config.ts           # Konfiguration laden
│   ├── services/
│   │   ├── browser.service.ts  # Puppeteer Browser
│   │   ├── auth.service.ts     # Login/Logout
│   │   ├── search.service.ts   # Angebote finden
│   │   ├── application.service.ts  # Bewerbungen
│   │   ├── pdf.service.ts      # PDF erstellen
│   │   └── email.service.ts    # Benachrichtigungen
│   ├── database/
│   │   └── database.ts         # SQLite Datenbank
│   ├── utils/
│   │   ├── scheduler.ts        # Timing
│   │   ├── humanizer.ts        # Anti-Bot
│   │   └── logger.ts           # Logging
│   ├── types/
│   │   └── listing.types.ts    # TypeScript Typen
│   └── index.ts                # Hauptprogramm
├── data/
│   ├── listings.db             # Datenbank
│   └── pdfs/                   # Gespeicherte PDFs
├── logs/
│   └── bot.log                 # Logdateien
├── .env                        # Konfiguration (nicht im Git)
├── .env.example                # Beispiel-Konfiguration
└── package.json
```

## Debugging

### Bot im sichtbaren Modus starten

```env
HEADLESS=false
```

### Logs einsehen

```bash
# Live-Log
tail -f logs/bot.log

# Fehler-Log
tail -f logs/error.log
```

### Screenshots

Bei Fehlern werden automatisch Screenshots in `data/screenshots/` gespeichert.

## Rechtliche Hinweise

**WICHTIG**: Die Nutzung dieses Bots kann gegen die Nutzungsbedingungen von ImmobilienScout24 verstoßen. Beachten Sie:

- Verwenden Sie den Bot auf eigene Verantwortung
- Nur für persönliche, nicht-kommerzielle Nutzung
- Vermeiden Sie übermäßige Anfragen an die Server
- Der Bot simuliert menschliches Verhalten, Blockaden sind dennoch möglich

## Troubleshooting

### "Login failed"

- Prüfen Sie Ihre Zugangsdaten in `.env`
- Setzen Sie `HEADLESS=false` um den Login visuell zu prüfen
- Bei 2FA: Deaktivieren Sie diese vorübergehend oder verwenden Sie App-Passwörter

### "CAPTCHA detected"

- Der Bot wird bei Captcha-Erkennung pausieren
- Erhöhen Sie `BASE_INTERVAL_MINUTES` auf 15-20
- Vermeiden Sie zu häufige Neustarts

### "Email verification failed"

- Prüfen Sie SMTP-Einstellungen
- Bei Gmail: Verwenden Sie ein App-Passwort
- Testen Sie die Einstellungen mit einem E-Mail-Client

### Keine Angebote gefunden

- Prüfen Sie `IS24_SEARCH_URL` - ist es eine gültige Suchergebnis-Seite?
- Die Seitenstruktur kann sich ändern - prüfen Sie die Screenshots

## Support

Bei Problemen:

1. Prüfen Sie die Logs in `logs/`
2. Prüfen Sie Screenshots in `data/screenshots/`
3. Setzen Sie `HEADLESS=false` für visuelles Debugging
