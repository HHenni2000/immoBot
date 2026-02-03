// PM2 Ecosystem File für VPS
// NUR Dashboard mit PM2 - Bot wird manuell im VNC gestartet!

module.exports = {
  apps: [
    // ❌ Bot NICHT mit PM2 starten - braucht VNC und manuelle Interaktion!
    // ✅ Starten Sie den Bot manuell im VNC mit: npm run handoff
    
    {
      name: 'dashboard',
      script: './dist/dashboard/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/pm2-dashboard-error.log',
      out_file: './logs/pm2-dashboard-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
