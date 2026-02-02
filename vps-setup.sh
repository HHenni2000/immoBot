#!/bin/bash
# ============================================================
# ImmoBot VPS Setup Script
# Für Ubuntu 22.04 / Debian 12
# ============================================================

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║          ImmoBot VPS Setup                                ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================
# 1. System aktualisieren
# ============================================================
echo -e "${YELLOW}[1/6] System aktualisieren...${NC}"
sudo apt update && sudo apt upgrade -y

# ============================================================
# 2. Desktop-Umgebung installieren (XFCE - leichtgewichtig)
# ============================================================
echo -e "${YELLOW}[2/6] Desktop-Umgebung installieren...${NC}"
sudo apt install -y xfce4 xfce4-goodies dbus-x11

# ============================================================
# 3. VNC Server installieren
# ============================================================
echo -e "${YELLOW}[3/6] VNC Server installieren...${NC}"
sudo apt install -y tigervnc-standalone-server tigervnc-common

# ============================================================
# 4. Node.js installieren
# ============================================================
echo -e "${YELLOW}[4/6] Node.js installieren...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Version prüfen
echo "Node.js Version: $(node -v)"
echo "npm Version: $(npm -v)"

# ============================================================
# 5. Chrome/Chromium für Puppeteer installieren
# ============================================================
echo -e "${YELLOW}[5/6] Chrome installieren...${NC}"
sudo apt install -y chromium-browser fonts-liberation libappindicator3-1 libasound2 \
    libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 libgdk-pixbuf2.0-0 \
    libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 \
    xdg-utils libgbm1 libxshmfence1

# ============================================================
# 6. VNC konfigurieren
# ============================================================
echo -e "${YELLOW}[6/6] VNC konfigurieren...${NC}"

# VNC Verzeichnis erstellen
mkdir -p ~/.vnc

# VNC Passwort setzen (Sie werden aufgefordert, ein Passwort einzugeben)
echo ""
echo -e "${GREEN}Bitte geben Sie ein VNC-Passwort ein (6-8 Zeichen):${NC}"
vncpasswd

# VNC Startup-Script erstellen
cat > ~/.vnc/xstartup << 'EOF'
#!/bin/bash
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
export XKL_XMODMAP_DISABLE=1
exec startxfce4
EOF

chmod +x ~/.vnc/xstartup

# VNC Config
cat > ~/.vnc/config << 'EOF'
geometry=1920x1080
depth=24
EOF

# ============================================================
# Fertig!
# ============================================================
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Installation abgeschlossen!                           ║${NC}"
echo -e "${GREEN}╠═══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}║  Nächste Schritte:                                        ║${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}║  1. VNC Server starten:                                   ║${NC}"
echo -e "${GREEN}║     vncserver :1                                          ║${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}║  2. Mit VNC Viewer verbinden:                             ║${NC}"
echo -e "${GREEN}║     Server: IHR-VPS-IP:5901                               ║${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}║  3. ImmoBot Projekt hochladen:                            ║${NC}"
echo -e "${GREEN}║     scp -r immoBot/ user@vps:/home/user/                  ║${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}║  4. Im VNC Terminal:                                      ║${NC}"
echo -e "${GREEN}║     cd ~/immoBot                                          ║${NC}"
echo -e "${GREEN}║     npm install                                           ║${NC}"
echo -e "${GREEN}║     npm run handoff                                       ║${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
