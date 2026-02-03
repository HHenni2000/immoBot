# 📱 noVNC Remote-Zugriff für iPhone

## Was ist das?

Mit **noVNC** können Sie vom iPhone aus auf den Bot-Browser zugreifen und CAPTCHAs lösen, **egal wo Sie sind**!

---

## 🚀 Installation (einmalig, ~5 Minuten)

### Auf dem VPS:

```bash
cd ~/immoBot
sudo bash setup-novnc.sh
```

Das Script wird Sie nach einem **VNC-Passwort** fragen - merken Sie sich dieses!

---

## 📱 Zugriff vom iPhone

### 1. Safari öffnen

### 2. URL eingeben:
```
http://72.60.80.95:6080
```
(Ihre IP-Adresse vom VPS)

### 3. Auf "Connect" klicken

### 4. VNC-Passwort eingeben

### 5. ✅ Sie sehen den Desktop!

---

## 🤖 Bot im VNC starten

**WICHTIG:** Der Bot muss **im VNC-Desktop** gestartet werden, nicht per SSH!

### Per SSH (für Remote-Start):

```bash
# VNC-Desktop starten (falls nicht läuft)
sudo systemctl start vncserver@1

# In VNC einloggen (vom iPhone oder http://IP:6080)
# Dann im VNC-Terminal:
cd ~/immoBot
bash start-bot-vnc.sh
```

### Oder direkt im VNC-Terminal:

1. VNC öffnen (vom iPhone)
2. Xfce Terminal öffnen (Icon unten)
3. Ausführen:
```bash
cd ~/immoBot
bash start-bot-vnc.sh
```

---

## 📲 CAPTCHA lösen vom iPhone

### Wenn CAPTCHA erscheint:

1. 📱 iPhone: Safari öffnen
2. 🌐 `http://72.60.80.95:6080` aufrufen
3. 👀 Sie sehen den Bot-Browser mit CAPTCHA
4. ✅ CAPTCHA lösen (antippen, schieben, etc.)
5. ✅ Im Terminal-Fenster ENTER drücken
6. 🚀 Bot macht weiter!

---

## 🔧 Troubleshooting

### VNC funktioniert nicht:

```bash
# Status prüfen
sudo systemctl status vncserver@1
sudo systemctl status novnc

# Neu starten
sudo systemctl restart vncserver@1
sudo systemctl restart novnc

# Logs anschauen
journalctl -u vncserver@1 -n 50
journalctl -u novnc -n 50
```

### Browser im VNC nicht sichtbar:

Der Bot muss **im VNC-Desktop** gestartet werden, nicht per SSH/Screen!

```bash
# Falsch (SSH):
screen -S immobot
npm run handoff  # ← Browser ist NICHT im VNC sichtbar

# Richtig (VNC Terminal):
cd ~/immoBot
bash start-bot-vnc.sh  # ← Browser IST sichtbar
```

### Port 6080 nicht erreichbar:

```bash
# Firewall-Port öffnen
sudo ufw allow 6080/tcp
sudo ufw reload
```

### Passwort vergessen:

```bash
# Neues Passwort setzen
sudo vncpasswd /root/.vnc/passwd
sudo systemctl restart vncserver@1
```

---

## 🔐 Sicherheit

### Passwort-Schutz:
✅ VNC ist passwort-geschützt

### Zugriff beschränken (optional):
```bash
# Nur von bestimmter IP erlauben
sudo ufw delete allow 6080/tcp
sudo ufw allow from IHRE_HEIM_IP to any port 6080
```

### SSL/HTTPS (optional, für später):
```bash
# Nginx als Reverse-Proxy mit Let's Encrypt
# → Verschlüsselter Zugriff über https://
```

---

## 💡 Tipps

### Lesezeichen im iPhone Safari:
Fügen Sie `http://72.60.80.95:6080` als Lesezeichen hinzu → Schneller Zugriff!

### VNC-Auflösung ändern:
```bash
sudo nano /root/.vnc/config
# Ändern: geometry=1920x1080
# Zu: geometry=1280x720 (für kleinere Displays)
sudo systemctl restart vncserver@1
```

### Auto-Start beim VPS-Neustart:
✅ Bereits konfiguriert! VNC startet automatisch.

---

## 🎉 Fertig!

Jetzt können Sie:
- ✅ CAPTCHAs vom iPhone lösen
- ✅ Bot von überall steuern
- ✅ Browser-Fenster sehen
- ✅ Terminal-Eingaben machen

Viel Erfolg! 🚀
