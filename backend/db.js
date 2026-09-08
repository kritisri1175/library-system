const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const db = new Database(path.join(__dirname, 'data', 'library.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student', -- 'student' | 'admin'
  student_code TEXT UNIQUE,             -- code embedded in the student's QR ID card
  qr_payload TEXT,                      -- serialized QR content for the ID card
  phone TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  isbn TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  cover_url TEXT,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Each physical copy of a book is tracked separately (multiple copies support)
CREATE TABLE IF NOT EXISTS book_copies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  copy_code TEXT UNIQUE NOT NULL,   -- unique code encoded in this copy's QR label
  shelf TEXT,
  rack TEXT,
  location_note TEXT,
  condition TEXT NOT NULL DEFAULT 'Good', -- Good | Damaged | Lost
  status TEXT NOT NULL DEFAULT 'Available', -- Available | Issued | Lost | Damaged
  qr_payload TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  copy_id INTEGER NOT NULL REFERENCES book_copies(id),
  book_id INTEGER NOT NULL REFERENCES books(id),
  student_id INTEGER NOT NULL REFERENCES users(id),
  issued_at TEXT DEFAULT (datetime('now')),
  due_at TEXT NOT NULL,
  returned_at TEXT,
  status TEXT NOT NULL DEFAULT 'Issued', -- Issued | Returned | Overdue | Lost
  fine_amount REAL NOT NULL DEFAULT 0,
  fine_paid INTEGER NOT NULL DEFAULT 0,
  condition_on_return TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- info | due_soon | overdue | fine
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_copies_book ON book_copies(book_id);
CREATE INDEX IF NOT EXISTS idx_tx_student ON transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);
`);

// Seed default settings
const defaultSettings = {
  borrow_period_days: process.env.BORROW_PERIOD_DAYS || '14',
  fine_per_day: process.env.FINE_PER_DAY || '5',
};
const upsertSetting = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO NOTHING`);
for (const [k, v] of Object.entries(defaultSettings)) upsertSetting.run(k, v);

// Seed default admin
const adminEmail = process.env.ADMIN_EMAIL || 'admin@library.local';
const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
if (!existingAdmin) {
  const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Admin@123', 10);
  db.prepare(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')`)
    .run('Library Admin', adminEmail, hash);
  console.log(`Seeded default admin -> ${adminEmail} / ${process.env.ADMIN_PASSWORD || 'Admin@123'}`);
}

module.exports = db;
