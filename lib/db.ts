import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Use /app/data for Railway persistent volumes, fallback to current directory for local dev
const dataDir = process.env.NODE_ENV === 'production'
  ? '/app/data'
  : process.cwd();

// Ensure data directory exists (for Railway)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'dashboard.db');
const db = new Database(dbPath);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    beginning_value REAL NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS daily_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    percentage REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS trading_calendar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    is_half_day INTEGER DEFAULT 0
  );
`);

// Create admin user if doesn't exist
const adminExists = db.prepare('SELECT id FROM users WHERE is_admin = 1').get();
if (!adminExists) {
  db.prepare(`
    INSERT INTO users (username, password, first_name, last_name, beginning_value, is_admin)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run('admin', 'admin123', 'Admin', 'User', 0);
}

// Populate trading calendar for October-December 2025
const calendarExists = db.prepare('SELECT COUNT(*) as count FROM trading_calendar').get() as { count: number };
if (calendarExists.count === 0) {
  const tradingDays = [
    // October 2025
    ...Array.from({ length: 3 }, (_, i) => `2025-10-${String(i + 1).padStart(2, '0')}`),
    ...Array.from({ length: 5 }, (_, i) => `2025-10-${String(i + 6).padStart(2, '0')}`),
    ...Array.from({ length: 5 }, (_, i) => `2025-10-${String(i + 13).padStart(2, '0')}`),
    ...Array.from({ length: 5 }, (_, i) => `2025-10-${String(i + 20).padStart(2, '0')}`),
    ...Array.from({ length: 5 }, (_, i) => `2025-10-${String(i + 27).padStart(2, '0')}`),
    // November 2025
    ...Array.from({ length: 5 }, (_, i) => `2025-11-${String(i + 3).padStart(2, '0')}`),
    ...Array.from({ length: 5 }, (_, i) => `2025-11-${String(i + 10).padStart(2, '0')}`),
    ...Array.from({ length: 5 }, (_, i) => `2025-11-${String(i + 17).padStart(2, '0')}`),
    '2025-11-24', '2025-11-25', '2025-11-26',
    // December 2025
    ...Array.from({ length: 5 }, (_, i) => `2025-12-${String(i + 1).padStart(2, '0')}`),
    ...Array.from({ length: 5 }, (_, i) => `2025-12-${String(i + 8).padStart(2, '0')}`),
    ...Array.from({ length: 5 }, (_, i) => `2025-12-${String(i + 15).padStart(2, '0')}`),
    '2025-12-22', '2025-12-23', '2025-12-24', '2025-12-26',
    ...Array.from({ length: 3 }, (_, i) => `2025-12-${String(i + 29).padStart(2, '0')}`),
  ];

  const halfDays = ['2025-11-28', '2025-12-24'];

  const insertStmt = db.prepare('INSERT OR IGNORE INTO trading_calendar (date, is_half_day) VALUES (?, ?)');
  for (const date of tradingDays) {
    insertStmt.run(date, halfDays.includes(date) ? 1 : 0);
  }
}

export default db;
