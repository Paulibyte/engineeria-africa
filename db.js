// Database layer — SQLite file stored in ./data (kept out of git)
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'engineeria.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'contributor',      -- admin | eic | contributor
  status TEXT NOT NULL DEFAULT 'pending',         -- pending | active | suspended
  bio TEXT DEFAULT '',
  color TEXT DEFAULT '#1f5fd1',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT DEFAULT '',
  body TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'civil',
  tags TEXT DEFAULT '',
  cover TEXT,
  video_type TEXT,          -- link | file
  video_src TEXT,
  audio TEXT,
  author_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | submitted | approved | changes | rejected | published | unpublished
  featured INTEGER DEFAULT 0,
  breaking INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  editor_note TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  submitted_at INTEGER,
  published_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status, published_at);
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  stars INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_article ON comments(article_id, status);
CREATE TABLE IF NOT EXISTS ads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  advertiser TEXT NOT NULL,
  title TEXT NOT NULL,
  text TEXT DEFAULT '',
  link TEXT DEFAULT '',
  placement TEXT NOT NULL DEFAULT 'sidebar',  -- top | sidebar | inline
  color TEXT DEFAULT '#f26a1b',
  image TEXT,
  active INTEGER DEFAULT 1,
  ends_on TEXT,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  location TEXT DEFAULT '',
  description TEXT DEFAULT '',
  link TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS weather (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  city TEXT NOT NULL,
  lat REAL, lon REAL,
  temp REAL, cond TEXT, hum INTEGER, wind INTEGER,
  sort INTEGER DEFAULT 0,
  updated_at INTEGER
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`);

// ---------- settings helpers ----------
const getSetting = (k, d = null) => {
  const r = db.prepare('SELECT value FROM settings WHERE key=?').get(k);
  if (!r) return d;
  try { return JSON.parse(r.value); } catch { return d; }
};
const setSetting = (k, v) =>
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, JSON.stringify(v));

// ---------- first-run seed ----------
function seed() {
  const now = Date.now();
  if (getSetting('tagline') === null) {
    setSetting('tagline', "Africa's Engineering News & Magazine");
    setSetting('flow', 'eic');          // eic | eic+admin
    setSetting('moderate', true);
    setSetting('breaking', { active: false });
    setSetting('alerts', []);
  }
  const count = db.prepare('SELECT COUNT(*) n FROM users').get().n;
  if (count === 0) {
    const email = process.env.ADMIN_EMAIL;
    const pass = process.env.ADMIN_PASSWORD;
    if (!email || !pass) {
      console.warn('⚠  No users yet. Set ADMIN_EMAIL and ADMIN_PASSWORD in .env, then restart to create the admin account.');
    } else {
      db.prepare('INSERT INTO users(name,email,password_hash,role,status,bio,color,created_at) VALUES(?,?,?,?,?,?,?,?)')
        .run(process.env.ADMIN_NAME || 'Administrator', email, bcrypt.hashSync(pass, 10), 'admin', 'active', 'Platform administrator', '#022455', now);
      console.log(`✓ Admin account created for ${email}`);
    }
  }
  if (db.prepare('SELECT COUNT(*) n FROM weather').get().n === 0) {
    const cities = [
      ['Lagos', 6.5244, 3.3792], ['Abuja', 9.0765, 7.3986], ['Owerri', 5.4836, 7.0333],
      ['Port Harcourt', 4.8156, 7.0498], ['Kano', 12.0022, 8.5920], ['Accra', 5.6037, -0.1870],
      ['Nairobi', -1.2921, 36.8219], ['Johannesburg', -26.2041, 28.0473], ['Cairo', 30.0444, 31.2357]];
    const ins = db.prepare('INSERT INTO weather(city,lat,lon,sort) VALUES(?,?,?,?)');
    cities.forEach((c, i) => ins.run(c[0], c[1], c[2], i));
  }
}
seed();

module.exports = { db, getSetting, setSetting };
