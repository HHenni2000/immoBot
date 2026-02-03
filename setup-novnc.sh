#!/bin/bash
set -e

echo "=================================="
echo "noVNC Remote-Zugriff Setup"
echo "für ImmoBot CAPTCHA-Lösung per iPhone"
echo "=================================="
echo ""

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Prüfen ob Root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Bitte als root ausführen: sudo bash setup-novnc.sh${NC}"
  exit 1
fi

echo -e "${GREEN}[1/8] System aktualisieren...${NC}"
apt update
apt upgrade -y

echo ""
echo -e "${GREEN}[2/8] Desktop-Umgebung (Xfce) installieren...${NC}"
DEBIAN_FRONTEND=noninteractive apt install -y \
  xfce4 \
  xfce4-terminal \
  dbus-x11 \
  x11-xserver-utils

echo ""
echo -e "${GREEN}[3/8] VNC-Server (TigerVNC) installieren...${NC}"
apt install -y tigervnc-standalone-server tigervnc-common

echo ""
echo -e "${GREEN}[4/8] noVNC (Web-VNC) installieren...${NC}"
apt install -y \
  python3 \
  python3-numpy \
  python3-websockify \
  git

# noVNC herunterladen
if [ ! -d "/opt/noVNC" ]; then
  cd /opt
  git clone https://github.com/novnc/noVNC.git
  cd noVNC
  git checkout v1.4.0
fi

# WebSockify (Bridge zwischen VNC und Browser)
if [ ! -d "/opt/noVNC/utils/websockify" ]; then
  cd /opt/noVNC/utils
  git clone https://github.com/novnc/websockify
fi

echo ""
echo -e "${GREEN}[5/8] VNC-Passwort einrichten...${NC}"
echo ""
echo -e "${YELLOW}Bitte VNC-Passwort eingeben (für iPhone-Zugriff):${NC}"
mkdir -p /root/.vnc
vncpasswd /root/.vnc/passwd
chmod 600 /root/.vnc/passwd

echo ""
echo -e "${GREEN}[6/8] VNC-Konfiguration erstellen...${NC}"

# VNC Startup Script (startet Xfce)
cat > /root/.vnc/xstartup << 'EOF'
#!/bin/bash
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
export XKL_XMODMAP_DISABLE=1

# Start Xfce Desktop
startxfce4 &
EOF

chmod +x /root/.vnc/xstartup

# VNC Config
cat > /root/.vnc/config << 'EOF'
geometry=1920x1080
dpi=96
localhost=no
alwaysshared
EOF

echo ""
echo -e "${GREEN}[7/8] Systemd Services erstellen...${NC}"

# VNC Server Service
cat > /etc/systemd/system/vncserver@.service << 'EOF'
[Unit]
Description=Remote desktop service (VNC)
After=syslog.target network.target

[Service]
Type=simple
User=root
PAMName=login
PIDFile=/root/.vnc/%H%i.pid
ExecStartPre=/bin/sh -c '/usr/bin/vncserver -kill :%i > /dev/null 2>&1 || :'
ExecStart=/usr/bin/vncserver :%i -geometry 1920x1080 -localhost no
ExecStop=/usr/bin/vncserver -kill :%i
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# noVNC Service
cat > /etc/systemd/system/novnc.service << 'EOF'
[Unit]
Description=noVNC Web Service
After=vncserver@1.service
Requires=vncserver@1.service

[Service]
Type=simple
User=root
ExecStart=/opt/noVNC/utils/novnc_proxy --vnc localhost:5901 --listen 6080
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Services aktivieren und starten
systemctl daemon-reload
systemctl enable vncserver@1.service
systemctl enable novnc.service
systemctl start vncserver@1.service
systemctl start novnc.service

echo ""
echo -e "${GREEN}[8/8] Firewall-Port öffnen...${NC}"
if command -v ufw &> /dev/null; then
  ufw allow 6080/tcp
  ufw allow 5901/tcp
  echo "Ports 5901 (VNC) und 6080 (Web) geöffnet"
fi

echo ""
echo "=================================="
echo -e "${GREEN}✅ Installation abgeschlossen!${NC}"
echo "=================================="
echo ""
echo "📱 ZUGRIFF VOM iPHONE:"
echo ""
echo "1. Safari auf iPhone öffnen"
echo "2. URL eingeben: http://$(curl -s ifconfig.me):6080"
echo "3. Auf 'Connect' klicken"
echo "4. VNC-Passwort eingeben (das Sie gerade gesetzt haben)"
echo "5. Sie sehen den Desktop!"
echo ""
echo "🤖 BOT STARTEN:"
echo ""
echo "Der Bot muss JETZT im VNC-Desktop gestartet werden,"
echo "damit Sie ihn vom iPhone sehen können!"
echo ""
echo "Führen Sie aus:"
echo "  cd ~/immoBot"
echo "  bash start-bot-vnc.sh"
echo ""
echo "=================================="
echo ""
echo "Status prüfen:"
echo "  systemctl status vncserver@1"
echo "  systemctl status novnc"
echo ""
echo "Logs anschauen:"
echo "  journalctl -u vncserver@1 -f"
echo "  journalctl -u novnc -f"
echo ""
