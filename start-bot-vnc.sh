#!/bin/bash

# ============================================
# ImmoBot Starter für VNC/noVNC
# ============================================
# Startet den Bot im VNC-Desktop, damit er
# vom iPhone aus sichtbar und steuerbar ist.
# ============================================

echo "🤖 Starte ImmoBot im VNC-Modus..."
echo ""

# Prüfen ob im VNC läuft
if [ -z "$DISPLAY" ]; then
  echo "⚠️  WARNUNG: Kein DISPLAY gefunden!"
  echo ""
  echo "Sie müssen dieses Script im VNC-Desktop ausführen!"
  echo ""
  echo "So gehts:"
  echo "1. VNC-Desktop öffnen (vom iPhone oder http://IP:6080)"
  echo "2. Terminal öffnen (Xfce Terminal)"
  echo "3. Dort ausführen:"
  echo "   cd ~/immoBot && bash start-bot-vnc.sh"
  echo ""
  exit 1
fi

# Zum Projektverzeichnis wechseln
cd "$(dirname "$0")"

# Node-Version prüfen
if ! command -v node &> /dev/null; then
  echo "❌ Node.js nicht gefunden!"
  exit 1
fi

# Dependencies prüfen
if [ ! -d "node_modules" ]; then
  echo "📦 Installiere Dependencies..."
  npm install
fi

# Build prüfen
if [ ! -d "dist" ]; then
  echo "🔨 Baue Projekt..."
  npm run build
fi

echo ""
echo "✅ Starte Bot im Handoff-Modus..."
echo ""
echo "📱 Sie können jetzt vom iPhone aus:"
echo "   - Den Browser sehen"
echo "   - CAPTCHAs lösen"
echo "   - ENTER drücken zum Fortfahren"
echo ""
echo "🛑 Zum Beenden: Strg+C"
echo ""
echo "========================================"
echo ""

# Bot starten
npm run handoff
