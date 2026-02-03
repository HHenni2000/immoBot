#!/bin/bash

echo "Fixe VNC xstartup..."

cat > /root/.vnc/xstartup << 'EOF'
#!/bin/bash

unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
export XKL_XMODMAP_DISABLE=1

# Xfce starten und auf ihn warten
exec startxfce4
EOF

chmod +x /root/.vnc/xstartup

echo "✅ xstartup gefixt!"
echo ""
echo "Führen Sie aus:"
echo "  vncserver -kill :1"
echo "  vncserver :1 -geometry 1920x1080 -localhost no"
