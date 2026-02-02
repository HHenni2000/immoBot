# ImmoBot auf VPS installieren

Diese Anleitung erklärt, wie Sie den ImmoBot auf einem VPS (Virtual Private Server) mit VNC-Zugriff installieren.

## Voraussetzungen

- VPS mit Ubuntu 22.04 oder Debian 12
- Mindestens 2 GB RAM
- Root-Zugriff oder sudo-Rechte
- SSH-Zugang zum VPS

## Schritt 1: Setup-Script auf VPS ausführen

### 1.1 Per SSH auf VPS verbinden

```bash
ssh benutzer@ihr-vps-ip
```

### 1.2 Setup-Script hochladen und ausführen

**Option A: Script direkt herunterladen (falls auf GitHub):**
```bash
wget https://raw.githubusercontent.com/ihr-repo/immoBot/main/vps-setup.sh
chmod +x vps-setup.sh
./vps-setup.sh
```

**Option B: Script manuell erstellen:**
```bash
nano vps-setup.sh
# Inhalt von vps-setup.sh einfügen
chmod +x vps-setup.sh
./vps-setup.sh
```

Das Script installiert:
- XFCE Desktop-Umgebung
- TigerVNC Server
- Node.js 18
- Chromium Browser

## Schritt 2: VNC Server starten

```bash
# VNC Server auf Display :1 starten
vncserver :1

# Ausgabe zeigt den Port (normalerweise 5901)
```

**VNC Server stoppen:**
```bash
vncserver -kill :1
```

**VNC Server automatisch beim Booten starten:**
```bash
# Systemd Service erstellen
sudo nano /etc/systemd/system/vncserver@.service
```

Inhalt:
```ini
[Unit]
Description=VNC Server for display %i
After=syslog.target network.target

[Service]
Type=forking
User=IHRBENUTZER
ExecStart=/usr/bin/vncserver :%i -geometry 1920x1080 -depth 24
ExecStop=/usr/bin/vncserver -kill :%i

[Install]
WantedBy=multi-user.target
```

Dann:
```bash
sudo systemctl daemon-reload
sudo systemctl enable vncserver@1
sudo systemctl start vncserver@1
```

## Schritt 3: Firewall konfigurieren (falls aktiv)

```bash
# UFW (Ubuntu Firewall)
sudo ufw allow 5901/tcp

# Oder für iptables
sudo iptables -A INPUT -p tcp --dport 5901 -j ACCEPT
```

## Schritt 4: Mit VNC verbinden

### VNC Viewer installieren (auf Ihrem PC)

**Windows:**
- [RealVNC Viewer](https://www.realvnc.com/de/connect/download/viewer/)
- [TightVNC Viewer](https://www.tightvnc.com/download.php)

**Mac:**
- Integrierter VNC Viewer: `Finder → Gehe zu → Mit Server verbinden → vnc://ihr-vps:5901`
- Oder RealVNC Viewer

**Linux:**
```bash
sudo apt install tigervnc-viewer
vncviewer ihr-vps-ip:5901
```

### Verbindung herstellen

1. VNC Viewer öffnen
2. Adresse eingeben: `IHR-VPS-IP:5901`
3. VNC-Passwort eingeben (das Sie beim Setup gewählt haben)
4. Desktop erscheint

## Schritt 5: ImmoBot auf VPS hochladen

### Von Ihrem Windows-PC:

**Option A: Mit SCP (empfohlen):**
```powershell
# In PowerShell (im immoBot Ordner)
scp -r . benutzer@ihr-vps-ip:/home/benutzer/immoBot/
```

**Option B: Mit WinSCP:**
1. WinSCP herunterladen und installieren
2. Mit VPS verbinden
3. Ordner `immoBot` hochladen

**Option C: Mit Git (falls auf GitHub):**
```bash
# Auf dem VPS
git clone https://github.com/ihr-repo/immoBot.git
cd immoBot
```

## Schritt 6: ImmoBot auf VPS starten

Im VNC-Fenster ein Terminal öffnen:

```bash
# Zum Projekt navigieren
cd ~/immoBot

# Dependencies installieren
npm install

# .env Datei erstellen/bearbeiten
nano .env
# Ihre Konfiguration einfügen

# Bot starten
npm run handoff
```

## Schritt 7: Bot im Hintergrund laufen lassen

### Mit screen (empfohlen):

```bash
# Screen installieren
sudo apt install screen

# Neue Screen-Session starten
screen -S immobot

# Bot starten
cd ~/immoBot
npm run handoff

# Screen verlassen (Bot läuft weiter): Strg+A, dann D

# Später wieder verbinden:
screen -r immobot
```

### Mit tmux (Alternative):

```bash
# tmux installieren
sudo apt install tmux

# Neue Session
tmux new -s immobot

# Bot starten
npm run handoff

# Verlassen: Strg+B, dann D

# Wieder verbinden:
tmux attach -t immobot
```

## Wichtige Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `vncserver :1` | VNC Server starten |
| `vncserver -kill :1` | VNC Server stoppen |
| `vncpasswd` | VNC Passwort ändern |
| `screen -r immobot` | Zur Bot-Session zurückkehren |
| `npm run handoff` | Bot starten |

## Troubleshooting

### "Display not found" Fehler
```bash
export DISPLAY=:1
npm run handoff
```

### VNC Verbindung abgelehnt
```bash
# Prüfen ob VNC läuft
vncserver -list

# Firewall prüfen
sudo ufw status
```

### Browser startet nicht
```bash
# Chromium Pfad prüfen
which chromium-browser

# Evtl. Umgebungsvariable setzen
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### Hohe CPU-Auslastung
- VNC Qualität reduzieren im VNC Viewer
- Oder: Headless-Modus nach Login verwenden

## Sicherheitshinweise

1. **VNC-Passwort**: Verwenden Sie ein starkes Passwort
2. **SSH-Tunnel**: Für extra Sicherheit, VNC über SSH tunneln:
   ```bash
   # Auf Ihrem PC:
   ssh -L 5901:localhost:5901 benutzer@ihr-vps-ip
   # Dann VNC verbinden zu: localhost:5901
   ```
3. **Firewall**: VNC-Port nur bei Bedarf öffnen
