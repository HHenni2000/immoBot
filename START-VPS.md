# ImmoBot auf VPS starten

## ⚠️ WICHTIG: Nur Handoff-Modus verwenden!

Der ImmoBot hat mehrere Modi, aber für VPS mit VNC sollten Sie **NUR** den Handoff-Modus verwenden!

---

## 🚀 Bot starten (Handoff-Modus)

### 1. Via VNC mit VPS verbinden

- **VNC Viewer öffnen**
- **Verbinden zu:** `IHR-VPS-IP:5901`
- **VNC-Passwort eingeben**

### 2. Terminal im VNC öffnen

### 3. Bot starten

```bash
cd ~/immoBot
npm run handoff
```

### 4. Phasen verstehen

**PHASE 1: Sie übernehmen**
1. Browser öffnet sich automatisch
2. Loggen Sie sich bei ImmobilienScout24 ein
3. Navigieren Sie zu Ihrer gespeicherten Suche
4. **Drücken Sie ENTER** wenn bereit

**PHASE 2: Bot übernimmt**
- Bot aktualisiert die Seite regelmäßig
- Bei neuen Angeboten: Automatische Bewerbung
- Bei CAPTCHA: Bot pausiert → Sie lösen → ENTER drücken

---

## 🔄 Bot im Hintergrund laufen lassen

### Option 1: Mit screen (empfohlen)

```bash
# Screen-Session starten
screen -S immobot

# Bot starten
cd ~/immoBot
npm run handoff

# Session verlassen (Bot läuft weiter)
# Drücken: Strg+A, dann D

# Später zurückkehren:
screen -r immobot

# Session komplett beenden:
screen -r immobot
# Dann: Strg+C (Bot stoppen) + exit
```

### Option 2: Mit tmux

```bash
# Tmux-Session starten
tmux new -s immobot

# Bot starten
cd ~/immoBot
npm run handoff

# Session verlassen (Bot läuft weiter)
# Drücken: Strg+B, dann D

# Später zurückkehren:
tmux attach -t immobot

# Session beenden:
tmux kill-session -t immobot
```

---

## 📊 Dashboard separat starten (optional)

Das Dashboard kann mit PM2 laufen:

```bash
cd ~/immoBot

# Build erstellen (einmalig oder nach Updates)
npm run build

# PM2 starten (nur Dashboard!)
pm2 start ecosystem.config.js

# PM2 Status prüfen
pm2 status

# PM2 Logs ansehen
pm2 logs dashboard

# PM2 stoppen
pm2 stop dashboard
```

Dashboard erreichbar unter: `http://IHR-VPS-IP:3001`

---

## ❌ NICHT verwenden:

### ❌ `npm start` oder `npm run dev`
- Das ist der vollautomatische Modus
- Funktioniert NICHT im VNC (braucht keine Interaktion)
- Bei CAPTCHA → Absturz

### ❌ `npm run manual`
- Nur Browser ohne Automation
- Nur zum einmaligen Setup nötig

### ❌ PM2 für den Bot
- PM2 kann Bot nicht starten (braucht VNC Display und Ihre Interaktion)
- Nur Dashboard mit PM2 starten!

---

## 🔧 Troubleshooting

### "Display not found"
```bash
export DISPLAY=:1
npm run handoff
```

### "Browser launch error"
```bash
# Chromium Pfad prüfen
which chromium-browser

# Puppeteer Pfad setzen
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
npm run handoff
```

### CAPTCHA erscheint
1. ✅ **Richtig:** Im Browser im VNC lösen → ENTER drücken
2. ❌ **Falsch:** Bot neu starten (nicht nötig!)

### Bot hängt/reagiert nicht
```bash
# In screen/tmux:
Strg+C (Bot stoppen)

# Neu starten:
npm run handoff
```

---

## 📝 Täglicher Workflow

1. **Morgens:** VNC verbinden → `screen -r immobot` → Bot läuft noch? ✅
2. **Bei CAPTCHA:** Email-Benachrichtigung → VNC verbinden → CAPTCHA lösen → ENTER
3. **Abends:** VNC verbinden → `screen -r immobot` → Status prüfen

---

## 🎯 Wichtigste Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `npm run handoff` | Bot im Handoff-Modus starten |
| `screen -S immobot` | Neue Screen-Session |
| `screen -r immobot` | Zu Screen zurückkehren |
| `Strg+A, dann D` | Screen verlassen (läuft weiter) |
| `Strg+C` | Bot stoppen |
| `pm2 status` | PM2-Status prüfen (nur Dashboard) |

---

## ✅ Zusammenfassung

- ✅ **Nur Handoff-Modus** verwenden: `npm run handoff`
- ✅ **Im VNC starten** (braucht sichtbaren Browser)
- ✅ **Screen/tmux** für Hintergrund-Betrieb
- ✅ **PM2 nur für Dashboard** (optional)
- ❌ **NICHT** `npm start` oder vollautomatischen Modus
- ❌ **NICHT** PM2 für den Bot
