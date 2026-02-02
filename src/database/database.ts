import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';
import config from '../config/config';
import logger from '../utils/logger';
import { Listing, ListingFromPage, CheckLog, ListingStatus } from '../types/listing.types';

// Ensure data directory exists
if (!fs.existsSync(config.dataDir)) {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

const dbPath = path.join(config.dataDir, 'listings.db');

let db: SqlJsDatabase | null = null;

/**
 * Saves the database to file
 */
function saveDatabase(): void {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

/**
 * Initializes the database
 */
export async function initializeDatabase(): Promise<void> {
  logger.info('Initializing database...');

  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    logger.info('Loaded existing database');
  } else {
    db = new SQL.Database();
    logger.info('Created new database');
  }

  // Initialize schema
  db.run(`
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      title TEXT,
      address TEXT,
      price TEXT,
      size TEXT,
      rooms TEXT,
      url TEXT,
      image_url TEXT,
      first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      applied_at DATETIME,
      pdf_path TEXT,
      status TEXT DEFAULT 'new',
      error_message TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      listings_found INTEGER,
      new_listings INTEGER,
      success INTEGER,
      error_message TEXT
    )
  `);

  // Create indexes
  db.run('CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_listings_first_seen ON listings(first_seen)');
  db.run('CREATE INDEX IF NOT EXISTS idx_checks_checked_at ON checks(checked_at)');

  saveDatabase();
  logger.info('Database initialized successfully');
}

/**
 * Gets a listing by ID
 */
export function getListingById(id: string): Listing | undefined {
  if (!db) throw new Error('Database not initialized');
  
  const stmt = db.prepare('SELECT * FROM listings WHERE id = ?');
  stmt.bind([id]);
  
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return mapRowToListing(row);
  }
  
  stmt.free();
  return undefined;
}

/**
 * Gets all listings
 */
export function getAllListings(): Listing[] {
  if (!db) throw new Error('Database not initialized');
  
  const results: Listing[] = [];
  const stmt = db.prepare('SELECT * FROM listings ORDER BY first_seen DESC');
  
  while (stmt.step()) {
    results.push(mapRowToListing(stmt.getAsObject()));
  }
  
  stmt.free();
  return results;
}

/**
 * Gets listings by status
 */
export function getListingsByStatus(status: ListingStatus): Listing[] {
  if (!db) throw new Error('Database not initialized');
  
  const results: Listing[] = [];
  const stmt = db.prepare('SELECT * FROM listings WHERE status = ? ORDER BY first_seen DESC');
  stmt.bind([status]);
  
  while (stmt.step()) {
    results.push(mapRowToListing(stmt.getAsObject()));
  }
  
  stmt.free();
  return results;
}

/**
 * Gets all known listing IDs
 */
export function getKnownListingIds(): Set<string> {
  if (!db) throw new Error('Database not initialized');
  
  const ids = new Set<string>();
  const stmt = db.prepare('SELECT id FROM listings');
  
  while (stmt.step()) {
    const row = stmt.getAsObject() as { id: string };
    ids.add(row.id);
  }
  
  stmt.free();
  return ids;
}

/**
 * Inserts a single listing
 */
export function insertListing(listing: ListingFromPage): void {
  if (!db) throw new Error('Database not initialized');
  
  db.run(`
    INSERT OR IGNORE INTO listings (id, title, address, price, size, rooms, url, image_url, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')
  `, [
    listing.id,
    listing.title,
    listing.address,
    listing.price,
    listing.size,
    listing.rooms || null,
    listing.url,
    listing.imageUrl || null
  ]);
  
  saveDatabase();
}

/**
 * Updates listing status
 */
export function updateListingStatus(
  id: string,
  status: ListingStatus,
  pdfPath?: string,
  errorMessage?: string
): void {
  if (!db) throw new Error('Database not initialized');
  
  const appliedAt = status === 'applied' ? new Date().toISOString() : null;
  
  db.run(`
    UPDATE listings 
    SET status = ?, applied_at = ?, pdf_path = ?, error_message = ?
    WHERE id = ?
  `, [status, appliedAt, pdfPath || null, errorMessage || null, id]);
  
  saveDatabase();
}

/**
 * Inserts multiple new listings and returns only the new ones
 */
export function insertNewListings(listings: ListingFromPage[]): ListingFromPage[] {
  if (!db) throw new Error('Database not initialized');
  
  const knownIds = getKnownListingIds();
  const newListings = listings.filter(l => !knownIds.has(l.id));

  for (const listing of newListings) {
    db.run(`
      INSERT INTO listings (id, title, address, price, size, rooms, url, image_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')
    `, [
      listing.id,
      listing.title,
      listing.address,
      listing.price,
      listing.size,
      listing.rooms || null,
      listing.url,
      listing.imageUrl || null
    ]);
  }

  if (newListings.length > 0) {
    saveDatabase();
    logger.info(`Inserted ${newListings.length} new listings into database`);
  }

  return newListings;
}

/**
 * Logs a check
 */
export function logCheck(
  listingsFound: number,
  newListings: number,
  success: boolean,
  errorMessage?: string
): void {
  if (!db) throw new Error('Database not initialized');
  
  db.run(`
    INSERT INTO checks (listings_found, new_listings, success, error_message)
    VALUES (?, ?, ?, ?)
  `, [listingsFound, newListings, success ? 1 : 0, errorMessage || null]);
  
  saveDatabase();
}

/**
 * Gets recent checks
 */
export function getRecentChecks(limit: number = 10): CheckLog[] {
  if (!db) throw new Error('Database not initialized');
  
  const results: CheckLog[] = [];
  const stmt = db.prepare('SELECT * FROM checks ORDER BY checked_at DESC LIMIT ?');
  stmt.bind([limit]);
  
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    results.push({
      id: row.id,
      checkedAt: new Date(row.checked_at),
      listingsFound: row.listings_found,
      newListings: row.new_listings,
      success: Boolean(row.success),
      errorMessage: row.error_message,
    });
  }
  
  stmt.free();
  return results;
}

/**
 * Maps database row to Listing object
 */
function mapRowToListing(row: any): Listing {
  return {
    id: row.id,
    title: row.title,
    address: row.address,
    price: row.price,
    size: row.size,
    rooms: row.rooms,
    url: row.url,
    imageUrl: row.image_url,
    firstSeen: new Date(row.first_seen),
    appliedAt: row.applied_at ? new Date(row.applied_at) : undefined,
    pdfPath: row.pdf_path,
    status: row.status as ListingStatus,
    errorMessage: row.error_message,
  };
}

/**
 * Closes the database
 */
export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}

export default {
  initializeDatabase,
  getListingById,
  getAllListings,
  getListingsByStatus,
  getKnownListingIds,
  insertListing,
  updateListingStatus,
  insertNewListings,
  logCheck,
  getRecentChecks,
  closeDatabase,
};
