# 🚀 ImmoBot Start-Anleitung

## 📍 Auf Ihrem PC (Development)

### **Alles auf einmal starten:**

```bash
npm run start:all
```

Das startet:
- 🤖 **Bot** (Handoff-Mode) auf Terminal 1
- 📊 **Dashboard Backend** auf http://localhost:3001
- ⚛️ **Dashboard Frontend** (Dev-Server) auf http://localhost:5173

**Dashboard öffnen:** http://localhost:5173

### **Nur einzelne Komponenten:**

```bash
# Nur Bot (Handoff-Mode)
npm run handoff

# Nur Dashboard Backend
npm run dashboard

# Nur Dashboard Frontend (Dev)
cd dashboard && npm run dev
```

---

## 🖥️ Auf dem VPS (Production)

### **Erste Einrichtung:**

```bash
# 1. Code bauen
npm run build

# 2. PM2 installieren (falls noch nicht installiert)
npm install -g pm2

# 3. Alles mit einem Befehl starten
pm2 start ecosystem.config.js

# 4. Beim Server-Neustart automatisch starten
pm2 startup
pm2 save
```

### **Tägliche Verwendung:**

```bash
# Alles starten
pm2 start ecosystem.config.js

# Status prüfen
pm2 status

# Logs anzeigen
pm2 logs

# Nur Bot-Logs
pm2 logs immobot

# Nur Dashboard-Logs
pm2 logs dashboard

# Alles stoppen
pm2 stop all

# Alles neu starten
pm2 restart all

# Nur Bot neu starten
pm2 restart immobot

# Nur Dashboard neu starten
pm2 restart dashboard

# Alles löschen
pm2 delete all
```

### **Nach Code-Änderungen:**

```bash
# 1. Code pullen
git pull

# 2. Dependencies aktualisieren (falls nötig)
npm install
cd dashboard && npm install && cd ..

# 3. Neu bauen
npm run build

# 4. PM2 neu starten
pm2 restart all

# Oder nur eine App neu starten:
pm2 restart immobot
pm2 restart dashboard
```

---

## 🔍 Monitoring

### **PM2 Monitor (Terminal UI):**

```bash
pm2 monit
```

Zeigt CPU, Memory, Logs in Echtzeit.

### **PM2 Web Dashboard:**

```bash
# PM2 Plus (kostenlos für Basic Features)
pm2 link [secret] [public]
```

---

## 🛑 Troubleshooting

### **Port bereits in Verwendung:**

```bash
# Prozess auf Port finden und beenden
# Linux/Mac:
lsof -ti:3001 | xargs kill -9

# Windows:
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### **Bot startet nicht:**

```bash
# Logs prüfen
pm2 logs immobot --lines 50

# Fehler in Logs suchen
pm2 logs immobot --err
```

### **Dashboard startet nicht:**

```bash
# Logs prüfen
pm2 logs dashboard --lines 50

# Port prüfen
sudo ufw status | grep 3001
```

### **Datenbank-Fehler:**

```bash
# Datenbank neu initialisieren
rm -rf data/listings.db
pm2 restart immobot
```

---

## 📊 Dashboard Zugriff

### **Lokal (PC):**
- Development: http://localhost:5173
- Production: http://localhost:3001

### **VPS (von außen):**
- http://ihre-vps-ip:3001
- Oder mit Domain: http://dashboard.ihre-domain.de

**Wichtig:** Port 3001 muss in der Firewall geöffnet sein!

```bash
sudo ufw allow 3001/tcp
```

---

## 🔐 Sicherheit

### **Passwort ändern:**

```bash
# Neuen Hash generieren
npx ts-node setup-dashboard-password.ts

# Hash in .env eintragen
nano .env
# -> DASHBOARD_PASSWORD_HASH=...

# Dashboard neu starten
pm2 restart dashboard
```

---

## 💡 Tipps

1. **Logs regelmäßig prüfen:** `pm2 logs`
2. **Bei hohem Memory-Verbrauch:** `pm2 restart all`
3. **Automatische Updates:** Cronjob für `git pull && npm run build && pm2 restart all`
4. **Backup:** Regelmäßig `data/` Ordner sichern
