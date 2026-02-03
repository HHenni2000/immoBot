# 🔒 Sichere noVNC-Verbindung per SSH-Tunnel (iPhone)

## Was ist ein SSH-Tunnel?

Statt direktem Zugriff auf `http://VPS-IP:6080` (unsicher) leiten wir den Traffic durch einen **verschlüsselten SSH-Tunnel**.

**Vorher (unsicher):**
```
iPhone → Internet → VPS:6080 (unverschlüsselt, öffentlich)
```

**Nachher (sicher):**
```
iPhone → SSH-Tunnel → VPS:localhost:6080 (verschlüsselt, nur für Sie)
```

---

## 📱 Setup (15 Minuten)

### Schritt 1: Termius App installieren

1. **App Store** öffnen
2. Suchen: **"Termius"**
3. Installieren (kostenlos)

---

### Schritt 2: VPS-Verbindung in Termius einrichten

1. **Termius** öffnen
2. **"Hosts"** → **"+ New Host"**
3. Eingeben:
   ```
   Label: ImmoBot VPS
   Address: 72.60.80.95
   Username: root
   Port: 22
   ```
4. **"Keys"** → SSH-Key auswählen oder Passwort eingeben
5. **"Save"**

**Testen:** Auf "ImmoBot VPS" tippen → Sollte SSH-Verbindung öffnen

---

### Schritt 3: Port Forwarding einrichten

1. **Termius** → **"Hosts"**
2. **"ImmoBot VPS"** antippen und halten → **"Edit"**
3. Nach unten scrollen → **"Port Forwarding"**
4. **"+ Add"** antippen
5. Eingeben:
   ```
   Type: Local
   From: localhost:6080
   To: localhost:6080
   ```
6. **"Save"** → **"Save"** (Host)

---

### Schritt 4: Firewall auf VPS anpassen

**Auf dem VPS (SSH):**

```bash
# Port 6080 NUR für localhost (nicht mehr öffentlich!)
sudo ufw delete allow 6080/tcp
sudo ufw reload

# noVNC Config anpassen (nur localhost)
sudo systemctl stop novnc

# noVNC Service bearbeiten
sudo nano /etc/systemd/system/novnc.service
```

**Ändern Sie diese Zeile:**
```
ExecStart=/opt/noVNC/utils/novnc_proxy --vnc localhost:5901 --listen 6080
```

**Zu:**
```
ExecStart=/opt/noVNC/utils/novnc_proxy --vnc localhost:5901 --listen localhost:6080
```

**Speichern:** Strg+O, Enter, Strg+X

```bash
# Service neu laden
sudo systemctl daemon-reload
sudo systemctl start novnc
```

✅ **Port 6080 ist jetzt NICHT mehr öffentlich zugänglich!**

---

### Schritt 5: Verbindung testen

1. **Termius** öffnen
2. **"ImmoBot VPS"** antippen
3. SSH-Verbindung wird hergestellt
4. **Termius im Hintergrund lassen** (nicht schließen!)
5. **Safari** öffnen
6. URL eingeben:
   ```
   http://localhost:6080/vnc.html
   ```
7. ✅ VNC-Desktop sollte erscheinen!

---

## 🎯 Wie benutze ich das?

### CAPTCHA lösen vom iPhone:

1. 📱 **Termius** öffnen
2. Auf **"ImmoBot VPS"** tippen (SSH-Verbindung starten)
3. **Home-Button** drücken (Termius läuft im Hintergrund)
4. 🌐 **Safari** öffnen
5. **Lesezeichen** aufrufen: `http://localhost:6080/vnc.html`
6. ✅ CAPTCHA lösen im VNC-Desktop
7. ✅ ENTER im Terminal drücken

### Wichtig:
- **Termius muss laufen** (im Hintergrund) für den Tunnel
- Nach 5-10 Min Inaktivität: Termius neu verbinden

---

## 🔒 Sicherheit

### Was ist jetzt sicher?

✅ **Port 6080 NICHT mehr öffentlich** (nur localhost)  
✅ **Alle Daten SSH-verschlüsselt**  
✅ **Kein Brute-Force möglich** (SSH ist sehr sicher)  
✅ **Fail2ban** schützt SSH zusätzlich  

### Von außen:
```bash
# Test: Sollte NICHT funktionieren
curl http://72.60.80.95:6080
# → Connection refused oder Timeout
```

### Nur über SSH-Tunnel:
```bash
# In Termius: SSH-Verbindung aktiv
# Im Safari: http://localhost:6080/vnc.html
# → Funktioniert! ✅
```

---

## 🔧 Troubleshooting

### "Connection refused" im Safari:

**Termius läuft nicht!**
1. Termius öffnen
2. "ImmoBot VPS" antippen
3. Warten bis "Connected"
4. Dann Safari öffnen

### "Timeout" oder "Can't connect":

**Port Forwarding nicht aktiviert:**
1. Termius → Hosts
2. "ImmoBot VPS" → Edit
3. Port Forwarding prüfen
4. Neu verbinden

### SSH-Verbindung bricht ab:

**Termius Keep-Alive aktivieren:**
1. Termius → Settings
2. "Keep connections alive"
3. Interval: 60 seconds

### noVNC läuft nicht:

```bash
# Auf VPS:
sudo systemctl status novnc
sudo systemctl restart novnc
journalctl -u novnc -n 20
```

---

## 💡 Tipps

### Lesezeichen erstellen:
- Safari: `localhost:6080/vnc.html` → Share → Add to Home Screen
- Schneller Zugriff vom Home-Screen!

### Termius Quick Connect:
- Widgets hinzufügen → Termius Widget
- Ein Tap → SSH-Tunnel aktiv

### Automatische Trennung verhindern:
- Termius → Settings → Terminal
- "Auto-lock" deaktivieren

---

## 📊 Vergleich

| Methode | Sicherheit | iPhone-Freundlich | Setup-Zeit |
|---------|------------|-------------------|------------|
| **Direkt (vorher)** | ⚠️ Unsicher | ✅ Sehr einfach | 0 Min |
| **SSH-Tunnel (jetzt)** | ✅ Sehr sicher | ✅ Einfach | 15 Min |
| **VPN (WireGuard)** | ✅ Sehr sicher | ⚠️ Komplex | 30 Min |
| **Nginx + SSL** | ✅ Sicher | ✅ Sehr einfach | 45 Min (braucht Domain) |

---

## ✅ Fertig!

Jetzt ist Ihr noVNC-Zugriff:
- 🔒 **Sicher** (SSH-verschlüsselt)
- 📱 **iPhone-kompatibel** (Termius App)
- 🚫 **Nicht öffentlich** (nur über SSH-Tunnel)
- 🛡️ **Fail2ban-geschützt** (SSH)

CAPTCHA-Lösung vom iPhone? **Jederzeit und sicher!** 🎉
