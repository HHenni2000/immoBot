import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import db from '../database/database';
import logger from '../utils/logger';
import { isNightMode } from '../utils/scheduler';
import config from '../config/config';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.DASHBOARD_PORT || '3001', 10);
const SESSION_SECRET = process.env.DASHBOARD_SESSION_SECRET || 'change-this-secret-in-production';
const DASHBOARD_PASSWORD_HASH = process.env.DASHBOARD_PASSWORD_HASH || '';

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Extend session type
declare module 'express-session' {
  interface SessionData {
    authenticated?: boolean;
  }
}

// Auth middleware
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.session.authenticated) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// ============================================================
// AUTH ROUTES
// ============================================================

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    // Compare with hashed password from env
    const isValid = await bcrypt.compare(password, DASHBOARD_PASSWORD_HASH);

    if (isValid) {
      req.session.authenticated = true;
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Invalid password' });
    }
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/api/auth/check', (req: Request, res: Response) => {
  res.json({ authenticated: !!req.session.authenticated });
});

// ============================================================
// DASHBOARD API ROUTES (Protected)
// ============================================================

app.get('/api/dashboard/stats', requireAuth, (req: Request, res: Response) => {
  try {
    const allListings = db.getAllListings();
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Statistics
    const totalFound = allListings.length;
    const foundLast24h = allListings.filter(l => l.firstSeen >= last24h).length;
    
    // Calculate average per day
    const firstListing = allListings[allListings.length - 1];
    const daysSinceStart = firstListing 
      ? Math.max(1, Math.ceil((now.getTime() - firstListing.firstSeen.getTime()) / (1000 * 60 * 60 * 24)))
      : 1;
    const avgPerDay = totalFound / daysSinceStart;

    res.json({
      totalFound,
      foundLast24h,
      avgPerDay: Math.round(avgPerDay * 10) / 10,
    });
  } catch (error) {
    logger.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/api/dashboard/status', requireAuth, (req: Request, res: Response) => {
  try {
    const recentChecks = db.getRecentChecks(1);
    const lastCheck = recentChecks[0];
    const isNight = isNightMode();

    let status: 'active' | 'night' | 'paused' | 'error' = 'active';
    let statusText = 'Bot läuft';

    if (isNight) {
      status = 'night';
      statusText = `Nachtmodus (bis ${config.nightEndHour}:00 Uhr)`;
    } else if (lastCheck && !lastCheck.success) {
      status = 'error';
      statusText = 'Fehler beim letzten Check';
    }

    const lastActivity = lastCheck 
      ? {
          timestamp: lastCheck.checkedAt,
          text: lastCheck.newListings > 0 
            ? `${lastCheck.newListings} neue(s) Angebot(e) gefunden`
            : 'Check abgeschlossen - keine neuen Angebote',
        }
      : null;

    res.json({
      status,
      statusText,
      lastActivity,
      nightMode: {
        enabled: config.nightModeEnabled,
        startHour: config.nightStartHour,
        endHour: config.nightEndHour,
        isActive: isNight,
      },
      checkInterval: config.baseIntervalMinutes,
    });
  } catch (error) {
    logger.error('Status error:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

app.get('/api/dashboard/activities', requireAuth, (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string || '10', 10);
    const listings = db.getAllListings().slice(0, limit);

    const activities = listings.map(listing => {
      const hasError = listing.status === 'error';
      const isApplied = listing.status === 'applied';

      return {
        id: listing.id,
        timestamp: listing.appliedAt || listing.firstSeen,
        type: hasError ? 'error' : isApplied ? 'applied' : 'found',
        title: listing.title,
        address: listing.address,
        price: listing.price,
        size: listing.size,
        rooms: listing.rooms,
        url: listing.url,
        pdfPath: listing.pdfPath,
        errorMessage: listing.errorMessage,
      };
    });

    res.json(activities);
  } catch (error) {
    logger.error('Activities error:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

app.get('/api/dashboard/warnings', requireAuth, (req: Request, res: Response) => {
  try {
    const warnings: Array<{ type: string; message: string; timestamp: Date }> = [];
    
    // Check for recent errors
    const recentChecks = db.getRecentChecks(10);
    const recentErrors = recentChecks.filter(c => !c.success);
    
    if (recentErrors.length > 0) {
      const lastError = recentErrors[0];
      warnings.push({
        type: 'error',
        message: lastError.errorMessage || 'Unbekannter Fehler beim letzten Check',
        timestamp: lastError.checkedAt,
      });
    }

    // Check for CAPTCHA mentions
    const listings = db.getAllListings().slice(0, 20);
    const captchaErrors = listings.filter(l => 
      l.errorMessage?.toLowerCase().includes('captcha')
    );
    
    if (captchaErrors.length > 0) {
      warnings.push({
        type: 'captcha',
        message: `CAPTCHA erkannt - Bot pausiert für ${config.captchaPauseMinutes} Minuten`,
        timestamp: captchaErrors[0].firstSeen,
      });
    }

    // Night mode warning
    if (isNightMode()) {
      warnings.push({
        type: 'info',
        message: `Nachtmodus aktiv - Bot pausiert bis ${config.nightEndHour}:00 Uhr`,
        timestamp: new Date(),
      });
    }

    res.json(warnings);
  } catch (error) {
    logger.error('Warnings error:', error);
    res.status(500).json({ error: 'Failed to fetch warnings' });
  }
});

// Serve PDF/Screenshot files
app.get('/api/files/:filename', requireAuth, (req: Request, res: Response) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(config.dataDir, 'pdfs', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(filePath);
  } catch (error) {
    logger.error('File serve error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../../dashboard/dist');
  app.use(express.static(distPath));
  
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Initialize and start server
async function startServer() {
  try {
    // Initialize database
    await db.initializeDatabase();
    logger.info('Database initialized for dashboard');

    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Dashboard server running on http://0.0.0.0:${PORT}`);
      console.log(`Dashboard server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start dashboard server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
