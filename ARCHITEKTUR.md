# ImmoBot - Architektur-Übersicht

## 🎯 Haupt-Komponenten

### 1. Bot (Handoff-Modus)
**Datei:** `src/handoff-mode.ts`  
**Start:** `npm run handoff` oder `npm start`

Der Kern des Bots. Läuft im VNC mit sichtbarem Browser.

**Workflow:**
1. User startet Bot im VNC
2. User loggt sich ein bei ImmobilienScout24
3. User navigiert zur gespeicherten Suche
4. User drückt ENTER → Bot übernimmt
5. Bot aktualisiert Seite regelmäßig
6. Bei neuen Angeboten: Automatische Bewerbung
7. Bei CAPTCHA: Bot pausiert, User löst, ENTER drücken

**Features:**
- ✅ Puppeteer mit Stealth-Plugin
- ✅ Eigene Browser-Verwaltung
- ✅ PDF-Erstellung direkt
- ✅ Datenbank-Integration
- ✅ CAPTCHA-Erkennung mit Handoff
- ✅ DRY_RUN Modus (Testmodus)

---

### 2. Dashboard (Web-Interface)
**Datei:** `src/dashboard/server.ts`  
**Start:** `npm run dashboard`  
**Frontend:** `dashboard/src/`

Web-Dashboard zum Monitoring des Bots.

**Features:**
- ✅ Login/Logout (bcrypt-geschützt)
- ✅ Statistiken (Angebote, Bewerbungen, Fehler)
- ✅ CAPTCHA-Löser (über Dashboard)
- ✅ Activity Feed
- ✅ Warnungen/Hinweise
- ✅ Night-Mode Status

**Port:** 3001 (konfigurierbar)

---

### 3. Datenbank
**Datei:** `src/database/database.ts`  
**Typ:** SQLite (sql.js)

Speichert alle Angebote und deren Status.

**Tabelle `listings`:**
- `id` (TEXT, PRIMARY KEY) - ImmobilienScout24 ID
- `url` (TEXT) - Link zum Angebot
- `title` (TEXT) - Titel der Wohnung
- `address` (TEXT) - Adresse
- `price` (TEXT) - Kaltmiete
- `rooms` (TEXT) - Anzahl Zimmer
- `size` (TEXT) - Quadratmeter
- `status` (TEXT) - 'new', 'applied', 'error', 'skipped'
- `first_seen` (INTEGER) - Timestamp erste Erkennung
- `applied_at` (INTEGER) - Timestamp Bewerbung
- `pdf_path` (TEXT) - Pfad zum PDF
- `error_message` (TEXT) - Fehlermeldung falls gescheitert

---

### 4. Utilities

#### Logger (`src/utils/logger.ts`)
Winston-basiertes Logging mit Datei- und Konsolen-Ausgabe.

**Log-Levels:**
- error
- warn
- info
- debug

**Log-Dateien:**
- `logs/combined.log` - Alles
- `logs/error.log` - Nur Fehler

#### Scheduler (`src/utils/scheduler.ts`)
Night-Mode Logik für das Dashboard.

**Export:**
- `isNightMode()` - Prüft, ob aktuell Night-Mode ist

---

### 5. Konfiguration

#### Config (`src/config/config.ts`)
Lädt und validiert alle Umgebungsvariablen aus `.env`.

**Wichtige Variablen:**
- `IS24_EMAIL`, `IS24_PASSWORD` - Login-Daten
- `IS24_SEARCH_URL` - URL der gespeicherten Suche
- `DRY_RUN` - Testmodus (true/false)
- `BASE_INTERVAL_MINUTES` - Check-Intervall
- `RANDOM_OFFSET_PERCENT` - Varianz
- `NIGHT_MODE_ENABLED` - Night-Mode aktivieren
- `NIGHT_START_HOUR`, `NIGHT_END_HOUR` - Night-Mode Zeiten
- `MESSAGE_GREETING`, `MESSAGE_CUSTOM` - Bewerbungstext

#### Types (`src/types/`)
TypeScript Type-Definitionen.

---

## 🗂️ Verzeichnis-Struktur

```
immoBot/
├── src/
│   ├── handoff-mode.ts          ← Haupt-Bot (EINZIGER Modus)
│   ├── dashboard/
│   │   └── server.ts            ← Dashboard-Backend
│   ├── database/
│   │   └── database.ts          ← SQLite Datenbank
│   ├── utils/
│   │   ├── logger.ts            ← Winston Logger
│   │   └── scheduler.ts         ← Night-Mode Logik
│   ├── config/
│   │   └── config.ts            ← .env Konfiguration
│   └── types/
│       ├── listing.types.ts     ← Type-Definitionen
│       └── sql.js.d.ts          ← sql.js Types
│
├── dashboard/                   ← React Frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/          ← React-Komponenten
│   │   └── pages/               ← Dashboard-Seiten
│   └── vite.config.ts
│
├── data/                        ← Bot-Daten (git-ignoriert)
│   ├── browser-profile/         ← Persistentes Browser-Profil
│   ├── cookies.json             ← Session-Cookies
│   ├── listings.db              ← SQLite Datenbank
│   ├── pdfs/                    ← Bewerbungs-PDFs
│   └── screenshots/             ← Debug-Screenshots
│
├── logs/                        ← Log-Dateien (git-ignoriert)
│   ├── combined.log
│   └── error.log
│
├── .env                         ← Konfiguration (git-ignoriert)
├── ecosystem.config.js          ← PM2-Config (nur Dashboard)
└── package.json                 ← NPM-Scripts
```

---

## 🚀 NPM Scripts

| Script | Beschreibung |
|--------|--------------|
| `npm start` | Startet Bot (= `npm run handoff`) |
| `npm run handoff` | Startet Bot im Handoff-Modus |
| `npm run dashboard` | Startet Dashboard-Server |
| `npm run dashboard:dev` | Dashboard im Dev-Modus (Vite) |
| `npm run build` | Kompiliert TypeScript → `dist/` |
| `npm run start:all` | Bot + Dashboard + Frontend (Dev) |

---

## 🔄 Datenfluss

```
User (VNC) → handoff-mode.ts → ImmobilienScout24
                ↓
            database.ts (listings speichern)
                ↓
            dashboard/server.ts (API)
                ↓
            Dashboard Frontend (React)
                ↓
            User (Browser)
```

---

## ⚠️ Gelöschte Komponenten

Die folgenden Komponenten wurden entfernt, da sie **nicht für den Handoff-Modus benötigt** werden:

### Alte Modi (gelöscht):
- ❌ `src/index.ts` - Vollautomatischer Bot (ohne User-Interaktion)
- ❌ `src/manual-browser.ts` - Nur Browser öffnen (kein Bot)

### Alte Services (gelöscht):
- ❌ `src/services/auth.service.ts` - Auth nur für index.ts
- ❌ `src/services/search.service.ts` - Search nur für index.ts
- ❌ `src/services/application.service.ts` - Apply nur für index.ts
- ❌ `src/services/browser.service.ts` - Browser nur für index.ts
- ❌ `src/services/email.service.ts` - Email nur für index.ts
- ❌ `src/services/pdf.service.ts` - PDF nur für index.ts
- ❌ `src/utils/humanizer.ts` - Humanizer nur für index.ts

### Alte Test-Dateien (gelöscht):
- ❌ `test-nightmode.ts`
- ❌ `debug-extraction.ts`

**Grund:** Der Handoff-Modus hat **seine eigene komplette Logik** und braucht keine Services. Alle Features sind direkt in `handoff-mode.ts` implementiert.

---

## 🎯 Philosophie

**Ein Modus, ein Zweck:**
- Handoff-Modus ist der **einzige** Bot-Modus
- Läuft **immer mit sichtbarem Browser** (headless: false)
- Braucht **User-Interaktion** (Login, CAPTCHA)
- Perfekt für **VPS + VNC Setup**

**Keine Abstraktion:**
- Keine komplexen Service-Layer
- Alles in einer Datei
- Einfach zu verstehen und zu warten

**User First:**
- Bot ist **transparent** (sichtbarer Browser)
- User hat **volle Kontrolle** (kann jederzeit eingreifen)
- Bei Problemen: **Bot pausiert** und wartet auf User

---

## 📚 Weitere Dokumentation

- `START-VPS.md` - VPS-Setup und Start-Anleitung
- `DASHBOARD.md` - Dashboard-Features und API
- `VNC-ANLEITUNG.md` - VNC-Setup für iPhone/Remote-Zugriff
- `SSH-TUNNEL-ANLEITUNG.md` - SSH-Tunnel für sichere Verbindungen
- `.env.example` - Beispiel-Konfiguration
