#!/bin/bash
set -e

echo "=========================================="
echo "Fail2ban Setup - Brute-Force-Schutz"
echo "für noVNC/VNC Server"
echo "=========================================="
echo ""

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Prüfen ob Root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Bitte als root ausführen: sudo bash setup-fail2ban.sh${NC}"
  exit 1
fi

echo -e "${GREEN}[1/4] Fail2ban installieren...${NC}"
apt update
apt install -y fail2ban

echo ""
echo -e "${GREEN}[2/4] VNC/noVNC Jail erstellen...${NC}"

# Fail2ban Filter für VNC
cat > /etc/fail2ban/filter.d/tigervnc.conf << 'EOF'
[Definition]
failregex = ^.*authentication failed from <HOST>.*$
            ^.*Authentication failure from <HOST>.*$
            ^.*Rejected unauthenticated connection from <HOST>.*$
ignoreregex =
EOF

# Fail2ban Filter für noVNC (WebSocket)
cat > /etc/fail2ban/filter.d/novnc.conf << 'EOF'
[Definition]
failregex = ^.*Client <HOST>.*failed to connect.*$
            ^.*<HOST>.*SecurityResult: failed.*$
ignoreregex =
EOF

echo ""
echo -e "${GREEN}[3/4] Fail2ban Jails konfigurieren...${NC}"

# Lokale Jail-Konfiguration
cat > /etc/fail2ban/jail.d/novnc.conf << 'EOF'
[tigervnc]
enabled = true
port = 5901
filter = tigervnc
logpath = /root/.vnc/*.log
maxretry = 5
findtime = 600
bantime = 3600
action = iptables-allports[name=tigervnc]

[novnc]
enabled = true
port = 6080
filter = novnc
logpath = /var/log/syslog
maxretry = 5
findtime = 600
bantime = 3600
action = iptables-allports[name=novnc]

[sshd]
enabled = true
port = ssh
maxretry = 3
findtime = 600
bantime = 3600
EOF

echo ""
echo -e "${GREEN}[4/4] Fail2ban starten...${NC}"
systemctl enable fail2ban
systemctl restart fail2ban

# Status anzeigen
sleep 2
systemctl status fail2ban --no-pager | head -15

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Fail2ban erfolgreich installiert!${NC}"
echo "=========================================="
echo ""
echo "📊 KONFIGURATION:"
echo ""
echo "  • Max. Versuche: 5"
echo "  • Beobachtungszeit: 10 Minuten"
echo "  • Ban-Zeit: 1 Stunde"
echo "  • Geschützte Ports: 5901 (VNC), 6080 (Web), 22 (SSH)"
echo ""
echo "🔍 STATUS PRÜFEN:"
echo ""
echo "  fail2ban-client status"
echo "  fail2ban-client status tigervnc"
echo "  fail2ban-client status novnc"
echo "  fail2ban-client status sshd"
echo ""
echo "📋 GEBANNTE IPs ANZEIGEN:"
echo ""
echo "  fail2ban-client get tigervnc banned"
echo "  fail2ban-client get novnc banned"
echo ""
echo "🔓 IP MANUELL ENTBANNEN:"
echo ""
echo "  fail2ban-client set tigervnc unbanip 1.2.3.4"
echo ""
echo "=========================================="
echo ""
