// Engineeria Africa — server
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { db, getSetting, setSetting } = require('./db');
const { startWeather, refreshWeather, pushAll, pushReady } = require('./lib/services');
const sanitizeHtml = require('sanitize-html');
let sharp = null; try { sharp = require('sharp'); } catch { /* optional */ }

const PORT = +process.env.PORT || 4100;
const PROD = process.env.NODE_ENV === 'production';
const SITE_URL = (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 20) { console.error('✗ JWT_SECRET missing in .env — run "npm run setup" first.'); process.exit(1); }

const CATS = [
  { id: 'civil', name: 'Civil & Structural', color: '#1f5fd1' },
  { id: 'mechanical', name: 'Mechanical', color: '#7c3aed' },
  { id: 'electrical', name: 'Electrical', color: '#c48a00' },
  { id: 'energy', name: 'Energy & Power', color: '#15803d' },
  { id: 'construction', name: 'Construction', color: '#e2560c' },
  { id: 'tech', name: 'Tech & Innovation', color: '#0891b2' },
  { id: 'environment', name: 'Climate & Environment', color: '#0f766e' },
  { id: 'events', name: 'Events', color: '#c0267a' }];
const CAT_IDS = CATS.map(c => c.id);
const COLORS = ['#1f5fd1', '#15803d', '#e2560c', '#7c3aed', '#0891b2', '#c0267a', '#b45309'];

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:', 'blob:', 'https:'],
      'media-src': ["'self'", 'blob:'],
      'frame-src': ['https://www.youtube.com', 'https://www.youtube-nocookie.com', 'https://player.vimeo.com'],
      'connect-src': ["'self'"],
      'upgrade-insecure-requests': PROD ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  // YouTube/Vimeo embeds need to see the site's address (fixes YouTube "Error 153")
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: PROD,
}));
app.use(compression());
app.use(express.json({ limit: '3mb' }));
app.use(cookieParser());

/* ---------------- helpers ---------------- */
const now = () => Date.now();
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const isUrl = v => /^https?:\/\/[^\s]+$/i.test(v || '');
const localUrl = v => typeof v === 'string' && /^\/uploads\/[\w\/.\-]+$/.test(v) ? v : null;
const slugify = s => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 80) || 'story';
const xml = s => String(s ?? '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const ipHash = req => crypto.createHash('sha256').update((req.ip || '') + new Date().toDateString() + SECRET).digest('hex').slice(0, 16);
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

function signIn(res, user) {
  const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: '30d' });
  res.cookie('ea_token', token, { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: 30 * 864e5 });
}
app.use((req, _res, next) => {
  const t = req.cookies.ea_token;
  if (t) {
    try {
      const p = jwt.verify(t, SECRET);
      const u = db.prepare('SELECT id,name,email,role,status,bio,color,avatar,headline,location,website FROM users WHERE id=?').get(p.id);
      if (u && u.status === 'active') req.user = u;
    } catch { /* invalid token */ }
  }
  next();
});
const need = (...roles) => (req, res, next) => {
  if (!req.user) return bad(res, 'Please sign in', 401);
  if (roles.length && !roles.includes(req.user.role)) return bad(res, 'You do not have permission for this', 403);
  next();
};
const isStaff = u => u && (u.role === 'admin' || u.role === 'eic');
const limits = () => getSetting('limits', {});
const LIMIT_RULES = { imgMaxMB: [0.1, 50], imgMaxWidth: [200, 6000], imgQuality: [40, 100], avatarSize: [100, 1000], videoMaxMB: [1, 2048], audioMaxMB: [1, 500] };

/* ---------------- story HTML sanitising ---------------- */
const COLOR = [/^#[0-9a-f]{3,8}$/i, /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/];
const SAFE_HTML = {
  allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'a', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
    'span', 'figure', 'figcaption', 'img', 'div', 'iframe', 'video', 'audio', 'hr', 'table', 'thead', 'tbody', 'tr', 'td', 'th'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'], img: ['src', 'alt', 'loading'], iframe: ['src', 'allowfullscreen', 'frameborder', 'allow', 'referrerpolicy'],
    video: ['src', 'controls', 'preload', 'playsinline'], audio: ['src', 'controls', 'preload'], li: ['data-list'], td: ['data-row', 'colspan', 'rowspan'],
    th: ['colspan', 'rowspan'], pre: ['data-language'], '*': ['class', 'style'],
  },
  allowedClasses: { '*': [/^ql-(align|indent|size|direction)-[\w-]+$/, 'ql-syntax', 'ql-code-block', 'ql-code-block-container', /^ea-[\w-]+$/] },
  allowedStyles: { '*': { color: COLOR, 'background-color': COLOR, 'text-align': [/^(left|right|center|justify)$/] } },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'],
  allowedIframeDomains: [],
  transformTags: {
    a: (tag, attr) => ({ tagName: 'a', attribs: /^https?:\/\//i.test(attr.href || '') && !(attr.href || '').startsWith(SITE_URL) ? { ...attr, target: '_blank', rel: 'noopener' } : { href: attr.href || '#' } }),
    iframe: (tag, attr) => ({ tagName: 'iframe', attribs: { ...attr, referrerpolicy: 'strict-origin-when-cross-origin', allowfullscreen: 'true', frameborder: '0' } }),
    video: (tag, attr) => ({ tagName: 'video', attribs: localUrl(attr.src) ? { src: attr.src, controls: '', preload: 'metadata', playsinline: '' } : {} }),
    audio: (tag, attr) => ({ tagName: 'audio', attribs: localUrl(attr.src) ? { src: attr.src, controls: '', preload: 'none' } : {} }),
    img: (tag, attr) => ({ tagName: 'img', attribs: (localUrl(attr.src) || /^https:\/\//.test(attr.src || '')) ? { src: attr.src, alt: attr.alt || '', loading: 'lazy' } : {} }),
  },
  exclusiveFilter: f => ((f.tag === 'img' || f.tag === 'iframe') && !f.attribs.src) || ((f.tag === 'video' || f.tag === 'audio') && !f.attribs.src),
};
const cleanStory = html => sanitizeHtml(String(html || ''), SAFE_HTML).slice(0, 400000);
const plainText = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ');

/* ---------------- article shaping ---------------- */
const ART_SELECT = `SELECT a.*, u.name AS author_name, u.color AS author_color, u.avatar AS author_avatar, u.headline AS author_headline,
  (SELECT COUNT(*) FROM comments c WHERE c.article_id=a.id AND c.status='approved') AS comment_count,
  (SELECT AVG(stars) FROM comments c WHERE c.article_id=a.id AND c.status='approved' AND stars>0) AS rating,
  (SELECT COUNT(*) FROM comments c WHERE c.article_id=a.id AND c.status='approved' AND stars>0) AS rating_n
  FROM articles a JOIN users u ON u.id=a.author_id`;
function out(a, full = false) {
  if (!a) return null;
  const o = {
    id: a.id, slug: a.slug, title: a.title, excerpt: a.excerpt, category: a.category, tags: a.tags,
    cover: a.cover, video: a.video_src ? { type: a.video_type, src: a.video_src } : null, audio: a.audio,
    authorId: a.author_id, authorName: a.author_name, authorColor: a.author_color, authorAvatar: a.author_avatar || null, authorHeadline: a.author_headline || '',
    status: a.status, featured: !!a.featured, breaking: !!a.breaking, views: a.views,
    comments: a.comment_count || 0, rating: a.rating || 0, ratingN: a.rating_n || 0,
    createdAt: a.created_at, publishedAt: a.published_at, submittedAt: a.submitted_at, editorNote: a.editor_note,
    readTime: Math.max(1, Math.round(plainText(a.body).split(/\s+/).filter(Boolean).length / 200)),
    bodyFormat: a.body_format || 'text',
  };
  if (full) o.body = a.body;
  return o;
}
const PUB = `a.status='published'`;

/* ---------------- contributor scores ---------------- */
const TIERS = [[400, 'Platinum', '#0891b2'], [150, 'Gold', '#ca8a04'], [50, 'Silver', '#64748b'], [0, 'Bronze', '#b45309']];
function contributorStats(userId) {
  const q = `SELECT u.id,u.name,u.color,u.role,u.bio,u.avatar,u.headline,u.location,u.website,
   (SELECT COUNT(*) FROM articles a WHERE a.author_id=u.id AND ${PUB}) stories,
   (SELECT COALESCE(SUM(views),0) FROM articles a WHERE a.author_id=u.id AND ${PUB}) views,
   (SELECT COUNT(*) FROM comments c JOIN articles a ON a.id=c.article_id WHERE a.author_id=u.id AND ${PUB} AND c.status='approved') comments,
   (SELECT COUNT(*) FROM comments c JOIN articles a ON a.id=c.article_id WHERE a.author_id=u.id AND ${PUB} AND c.status='approved' AND c.stars>0) reviews,
   (SELECT AVG(c.stars) FROM comments c JOIN articles a ON a.id=c.article_id WHERE a.author_id=u.id AND ${PUB} AND c.status='approved' AND c.stars>0) avg
   FROM users u WHERE u.status='active' ${userId ? 'AND u.id=?' : ''}`;
  const rows = userId ? db.prepare(q).all(userId) : db.prepare(q).all();
  return rows.map(r => {
    const avg = r.avg || 0;
    const score = Math.round(r.views / 10 + r.comments * 3 + avg * r.reviews * 2);
    const t = TIERS.find(t => score >= t[0]);
    return { ...r, avg, score, tier: { name: t[1], color: t[2] } };
  });
}
const ranked = () => contributorStats().filter(r => r.stories > 0).sort((a, b) => b.score - a.score);

/* ---------------- breaking news ---------------- */
async function goLive(text, articleId) {
  let slug = null;
  if (articleId) slug = db.prepare('SELECT slug FROM articles WHERE id=? AND status=\'published\'').get(articleId)?.slug || null;
  const b = { active: true, id: crypto.randomBytes(5).toString('hex'), text: str(text, 200), articleId: slug ? +articleId : null, slug, at: now() };
  setSetting('breaking', b);
  pushAll({ title: 'BREAKING · Engineeria Africa', body: b.text, url: slug ? `/article/${slug}` : '/', tag: 'breaking-' + b.id })
    .then(n => n && console.log(`push: breaking sent to ${n} devices`));
  return b;
}

/* ================= PUBLIC API ================= */
app.get('/api/boot', (req, res) => {
  res.json({
    me: req.user || null,
    cats: CATS,
    settings: { tagline: getSetting('tagline'), moderate: getSetting('moderate'), flow: getSetting('flow') },
    breaking: getSetting('breaking', { active: false }),
    weather: { cities: db.prepare('SELECT city,temp,cond,hum,wind,updated_at FROM weather ORDER BY sort,id').all(), alerts: getSetting('alerts', []) },
    vapidKey: pushReady ? process.env.VAPID_PUBLIC_KEY : null,
    limits: limits(),
  });
});

app.get('/api/home', (req, res) => {
  const latest = db.prepare(`${ART_SELECT} WHERE ${PUB} ORDER BY a.published_at DESC LIMIT 16`).all().map(a => out(a));
  const featured = out(db.prepare(`${ART_SELECT} WHERE ${PUB} AND a.featured=1 ORDER BY a.published_at DESC LIMIT 1`).get()) || latest[0] || null;
  const mostRead = db.prepare(`${ART_SELECT} WHERE ${PUB} AND a.published_at > ? ORDER BY a.views DESC LIMIT 5`).all(now() - 60 * 864e5).map(a => out(a));
  res.json({
    featured, latest: latest.filter(a => a.id !== featured?.id), mostRead,
    events: db.prepare(`SELECT * FROM events WHERE date >= date('now') ORDER BY date LIMIT 4`).all(),
    top: ranked().slice(0, 3),
  });
});

app.get('/api/sidebar', (req, res) => {
  res.json({
    mostRead: db.prepare(`${ART_SELECT} WHERE ${PUB} AND a.published_at > ? ORDER BY a.views DESC LIMIT 5`).all(now() - 60 * 864e5).map(a => out(a)),
    events: db.prepare(`SELECT * FROM events WHERE date >= date('now') ORDER BY date LIMIT 3`).all(),
    top: ranked().slice(0, 3),
  });
});

app.get('/api/articles', (req, res) => {
  const limit = Math.min(+req.query.limit || 12, 50), offset = +req.query.offset || 0;
  const where = [PUB], args = [];
  if (req.query.cat && CAT_IDS.includes(req.query.cat)) { where.push('a.category=?'); args.push(req.query.cat); }
  if (req.query.q) {
    const q = '%' + str(req.query.q, 100).replace(/[%_]/g, '') + '%';
    where.push('(a.title LIKE ? OR a.excerpt LIKE ? OR a.body LIKE ? OR a.tags LIKE ?)'); args.push(q, q, q, q);
  }
  if (req.query.author) { where.push('a.author_id=?'); args.push(+req.query.author); }
  const rows = db.prepare(`${ART_SELECT} WHERE ${where.join(' AND ')} ORDER BY a.published_at DESC LIMIT ? OFFSET ?`).all(...args, limit + 1, offset);
  res.json({ items: rows.slice(0, limit).map(a => out(a)), more: rows.length > limit });
});

app.get('/api/articles/:slug', (req, res) => {
  const a = db.prepare(`${ART_SELECT} WHERE a.slug=?`).get(req.params.slug);
  if (!a) return bad(res, 'Story not found', 404);
  if (a.status !== 'published' && !(req.user && (isStaff(req.user) || req.user.id === a.author_id))) return bad(res, 'Story not found', 404);
  res.json({
    article: out(a, true),
    author: contributorStats(a.author_id)[0] || null,
    comments: db.prepare(`SELECT id,name,text,stars,created_at FROM comments WHERE article_id=? AND status='approved' ORDER BY created_at DESC`).all(a.id),
    related: db.prepare(`${ART_SELECT} WHERE ${PUB} AND a.category=? AND a.id<>? ORDER BY a.published_at DESC LIMIT 3`).all(a.category, a.id).map(x => out(x)),
  });
});

const seenViews = new Map(); setInterval(() => seenViews.clear(), 864e5);
app.post('/api/articles/:id/view', (req, res) => {
  const k = req.params.id + ':' + ipHash(req);
  if (!seenViews.has(k)) {
    seenViews.set(k, 1);
    const a = db.prepare('SELECT author_id FROM articles WHERE id=? AND status=\'published\'').get(+req.params.id);
    if (a && a.author_id !== req.user?.id) db.prepare('UPDATE articles SET views=views+1 WHERE id=?').run(+req.params.id);
  }
  res.json({ ok: true });
});

const commentLimiter = rateLimit({ windowMs: 10 * 60e3, limit: 8, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many comments — please wait a few minutes.' } });
app.post('/api/articles/:id/comments', commentLimiter, (req, res) => {
  if (req.body.website) return res.json({ ok: true, pending: true }); // honeypot
  const a = db.prepare('SELECT id FROM articles WHERE id=? AND status=\'published\'').get(+req.params.id);
  if (!a) return bad(res, 'Story not found', 404);
  const name = str(req.body.name, 60) || 'Reader', text = str(req.body.text, 1500);
  if (text.length < 2) return bad(res, 'Please write a comment');
  const stars = Math.max(0, Math.min(5, parseInt(req.body.stars) || 0));
  const pending = getSetting('moderate') && !isStaff(req.user);
  db.prepare('INSERT INTO comments(article_id,name,text,stars,status,created_at) VALUES(?,?,?,?,?,?)').run(a.id, name, text, stars, pending ? 'pending' : 'approved', now());
  res.json({ ok: true, pending });
});

app.get('/api/events', (req, res) => res.json(db.prepare('SELECT * FROM events ORDER BY date').all()));
app.get('/api/contributors', (req, res) => res.json(ranked()));
app.get('/api/ads', (req, res) => res.json(db.prepare(`SELECT id,advertiser,title,text,placement,color,image FROM ads WHERE active=1 AND (ends_on IS NULL OR ends_on='' OR ends_on >= date('now')) AND (starts_on IS NULL OR starts_on='' OR starts_on <= date('now'))`).all()));
app.post('/api/ads/impressions', (req, res) => {
  const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).slice(0, 6).map(Number).filter(Boolean);
  const st = db.prepare('UPDATE ads SET impressions=impressions+1 WHERE id=?');
  ids.forEach(id => st.run(id));
  res.json({ ok: true });
});
app.get('/go/ad/:id', (req, res) => {
  const ad = db.prepare('SELECT link FROM ads WHERE id=?').get(+req.params.id);
  if (!ad) return res.redirect('/');
  db.prepare('UPDATE ads SET clicks=clicks+1 WHERE id=?').run(+req.params.id);
  res.redirect(isUrl(ad.link) ? ad.link : '/');
});

app.post('/api/push/subscribe', (req, res) => {
  const s = req.body;
  if (!s?.endpoint || !/^https:\/\//.test(s.endpoint) || !s.keys?.p256dh) return bad(res, 'Invalid subscription');
  db.prepare('INSERT OR REPLACE INTO push_subs(endpoint,data,created_at) VALUES(?,?,?)').run(s.endpoint, JSON.stringify({ endpoint: s.endpoint, keys: s.keys }), now());
  res.json({ ok: true });
});
app.post('/api/push/unsubscribe', (req, res) => {
  db.prepare('DELETE FROM push_subs WHERE endpoint=?').run(str(req.body.endpoint, 1000));
  res.json({ ok: true });
});

/* ================= AUTH ================= */
const loginLimiter = rateLimit({ windowMs: 15 * 60e3, limit: 20, message: { error: 'Too many attempts — try again in 15 minutes.' } });
app.post('/api/auth/login', loginLimiter, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(str(req.body.email, 200));
  if (!u || !bcrypt.compareSync(String(req.body.password || ''), u.password_hash)) return bad(res, 'Wrong email or password', 401);
  if (u.status === 'pending') return bad(res, 'Your contributor application is awaiting admin approval.', 403);
  if (u.status === 'suspended') return bad(res, 'This account is suspended. Contact the administrator.', 403);
  signIn(res, u);
  res.json({ ok: true });
});
app.post('/api/auth/logout', (req, res) => { res.clearCookie('ea_token'); res.json({ ok: true }); });
app.post('/api/auth/apply', loginLimiter, (req, res) => {
  const name = str(req.body.name, 80), email = str(req.body.email, 200).toLowerCase(), pass = String(req.body.password || '');
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return bad(res, 'Enter your name and a valid email');
  if (pass.length < 8) return bad(res, 'Password must be at least 8 characters');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return bad(res, 'An account with this email already exists');
  const n = db.prepare('SELECT COUNT(*) n FROM users').get().n;
  db.prepare('INSERT INTO users(name,email,password_hash,role,status,bio,color,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(name, email, bcrypt.hashSync(pass, 10), 'contributor', 'pending', str(req.body.bio, 2000), COLORS[n % COLORS.length], now());
  res.json({ ok: true });
});
app.post('/api/auth/password', need(), (req, res) => {
  const u = db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.user.id);
  if (!bcrypt.compareSync(String(req.body.current || ''), u.password_hash)) return bad(res, 'Current password is wrong');
  if (String(req.body.next || '').length < 8) return bad(res, 'New password must be at least 8 characters');
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(String(req.body.next), 10), req.user.id);
  res.json({ ok: true });
});
function saveProfile(id, b, fallbackName) {
  const site = str(b.website, 300);
  db.prepare('UPDATE users SET name=?, headline=?, bio=?, location=?, website=?, avatar=? WHERE id=?').run(
    str(b.name, 80) || fallbackName, str(b.headline, 120), str(b.bio, 2000), str(b.location, 80),
    site && !/^https?:\/\//i.test(site) ? 'https://' + site : site, localUrl(b.avatar), id);
}
app.put('/api/me', need(), (req, res) => { saveProfile(req.user.id, req.body, req.user.name); res.json({ ok: true }); });
app.get('/api/authors/:id', (req, res) => {
  const u = db.prepare(`SELECT id,name,role,bio,color,avatar,headline,location,website,created_at FROM users WHERE id=? AND status='active'`).get(+req.params.id);
  if (!u) return bad(res, 'Profile not found', 404);
  const all = ranked(), st = contributorStats(u.id)[0];
  res.json({ ...u, stats: st, rank: all.findIndex(r => r.id === u.id) + 1, of: all.length,
    articles: db.prepare(`${ART_SELECT} WHERE ${PUB} AND a.author_id=? ORDER BY a.published_at DESC LIMIT 60`).all(u.id).map(a => out(a)) });
});

/* ================= UPLOADS ================= */
const UP_DIR = path.join(__dirname, 'uploads');
const maxBytes = kind => { const L = limits(); return (kind === 'video' ? L.videoMaxMB : kind === 'audio' ? L.audioMaxMB : L.imgMaxMB) * 1e6; };
const makeUpload = kind => multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const d = new Date(), dir = path.join(UP_DIR, String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'));
      fs.mkdirSync(dir, { recursive: true }); cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, crypto.randomBytes(10).toString('hex') + path.extname(file.originalname).toLowerCase().replace(/[^.\w]/g, '').slice(0, 6)),
  }),
  limits: { fileSize: Math.ceil(maxBytes(kind)) },
  fileFilter: (req, file, cb) => {
    const kind = req.query.kind;
    const ok = ((kind === 'image' || kind === 'avatar') && /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) ||
      (kind === 'video' && /^video\/(mp4|webm|quicktime)$/.test(file.mimetype)) ||
      (kind === 'audio' && /^audio\//.test(file.mimetype));
    cb(ok ? null : new Error('That file type is not allowed here'), ok);
  },
});
app.post('/api/upload', need(), (req, res) => {
  const kind = req.query.kind;
  if (!['image', 'avatar', 'video', 'audio'].includes(kind)) return bad(res, 'Unknown upload type');
  makeUpload(kind).single('file')(req, res, async err => {
    if (err) return bad(res, err.code === 'LIMIT_FILE_SIZE' ? `File is too large — the limit is ${+(maxBytes(kind) / 1e6).toFixed(1)} MB` : err.message);
    if (!req.file) return bad(res, 'No file received');
    const L = limits();
    let file = req.file.path;
    if ((kind === 'image' || kind === 'avatar') && sharp && !/\.gif$/.test(file)) {
      try {
        const outPath = file.replace(/\.[^.]+$/, '') + (file.endsWith('.webp') ? '-o' : '') + '.webp';
        let img = sharp(file).rotate();
        img = kind === 'avatar'
          ? img.resize({ width: L.avatarSize, height: L.avatarSize, fit: 'cover', position: 'attention' })
          : img.resize({ width: L.imgMaxWidth, height: L.imgMaxWidth, fit: 'inside', withoutEnlargement: true });
        await img.webp({ quality: L.imgQuality }).toFile(outPath);
        fs.unlinkSync(file);
        file = outPath;
      } catch (e) { console.warn('image optimise failed:', e.message); }
    }
    res.json({ url: '/uploads/' + path.relative(UP_DIR, file).split(path.sep).join('/') });
  });
});

/* ================= WRITING ================= */
function articleFields(b) {
  const vlink = str(b.videoLink, 500);
  const vfile = localUrl(b.videoFile);
  return {
    title: str(b.title, 160), excerpt: str(b.excerpt, 300),
    body: b.bodyFormat === 'html' ? cleanStory(b.body) : str(b.body, 60000), body_format: b.bodyFormat === 'html' ? 'html' : 'text',
    category: CAT_IDS.includes(b.category) ? b.category : 'civil', tags: str(b.tags, 200),
    cover: localUrl(b.cover), audio: localUrl(b.audio),
    video_type: vlink && isUrl(vlink) ? 'link' : vfile ? 'file' : null,
    video_src: vlink && isUrl(vlink) ? vlink : vfile || null,
  };
}
function applyPublish(user, a, opts = {}) {
  // returns the new status according to the publishing flow
  const flow = getSetting('flow');
  const t = now();
  const featured = opts.featured !== undefined ? (opts.featured ? 1 : 0) : a.featured;
  const breaking = opts.breaking !== undefined ? (opts.breaking ? 1 : 0) : a.breaking;
  if (user.role === 'admin' || flow === 'eic') {
    db.prepare(`UPDATE articles SET status='published', published_at=COALESCE(published_at,?), editor_note='', featured=?, breaking=?, updated_at=? WHERE id=?`).run(t, featured, breaking, t, a.id);
    if (featured) db.prepare('UPDATE articles SET featured=0 WHERE id<>?').run(a.id);
    if (breaking) goLive(a.title, a.id);
    return 'published';
  }
  db.prepare(`UPDATE articles SET status='approved', featured=?, breaking=?, updated_at=? WHERE id=?`).run(featured, breaking, t, a.id);
  return 'approved';
}
app.post('/api/articles', need(), (req, res) => {
  const f = articleFields(req.body);
  if (!f.title) return bad(res, 'A headline is required');
  const action = req.body.action, t = now();
  const status = action === 'submit' ? 'submitted' : 'draft';
  const r = db.prepare(`INSERT INTO articles(slug,title,excerpt,body,body_format,category,tags,cover,video_type,video_src,audio,author_id,status,created_at,updated_at,submitted_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('tmp-' + crypto.randomBytes(6).toString('hex'), f.title, f.excerpt, f.body, f.body_format, f.category, f.tags, f.cover, f.video_type, f.video_src, f.audio, req.user.id, status, t, t, status === 'submitted' ? t : null);
  const id = r.lastInsertRowid;
  db.prepare('UPDATE articles SET slug=? WHERE id=?').run(slugify(f.title) + '-' + id, id);
  let final = status;
  if (action === 'publish' && isStaff(req.user)) final = applyPublish(req.user, db.prepare('SELECT * FROM articles WHERE id=?').get(id));
  res.json({ ok: true, id, status: final });
});
app.put('/api/articles/:id', need(), (req, res) => {
  const a = db.prepare('SELECT * FROM articles WHERE id=?').get(+req.params.id);
  if (!a) return bad(res, 'Not found', 404);
  const staff = isStaff(req.user);
  if (!staff && a.author_id !== req.user.id) return bad(res, 'You can only edit your own stories', 403);
  if (!staff && !['draft', 'changes', 'rejected'].includes(a.status)) return bad(res, 'This story is locked while under review or live', 403);
  const f = articleFields(req.body);
  if (!f.title) return bad(res, 'A headline is required');
  const action = req.body.action, t = now();
  let status = a.status;
  if (action === 'draft' && a.status !== 'published') status = 'draft';
  if (action === 'submit') status = 'submitted';
  db.prepare(`UPDATE articles SET title=?,excerpt=?,body=?,body_format=?,category=?,tags=?,cover=?,video_type=?,video_src=?,audio=?,status=?,updated_at=?,
    submitted_at=CASE WHEN ?='submitted' THEN ? ELSE submitted_at END WHERE id=?`)
    .run(f.title, f.excerpt, f.body, f.body_format, f.category, f.tags, f.cover, f.video_type, f.video_src, f.audio, status, t, status, t, a.id);
  if (a.status !== 'published') db.prepare('UPDATE articles SET slug=? WHERE id=?').run(slugify(f.title) + '-' + a.id, a.id);
  if (action === 'publish' && staff) status = applyPublish(req.user, db.prepare('SELECT * FROM articles WHERE id=?').get(a.id));
  res.json({ ok: true, id: a.id, status });
});
app.get('/api/articles-by-id/:id', need(), (req, res) => {
  const a = db.prepare(`${ART_SELECT} WHERE a.id=?`).get(+req.params.id);
  if (!a || (!isStaff(req.user) && a.author_id !== req.user.id)) return bad(res, 'Not found', 404);
  res.json(out(a, true));
});
app.get('/api/my/articles', need(), (req, res) => {
  res.json(db.prepare(`${ART_SELECT} WHERE a.author_id=? ORDER BY a.updated_at DESC`).all(req.user.id).map(a => out(a)));
});
app.get('/api/my/stats', need(), (req, res) => {
  const all = ranked();
  const mine = contributorStats(req.user.id)[0];
  res.json({ ...mine, rank: all.findIndex(r => r.id === req.user.id) + 1, of: all.length });
});

/* ================= EDITORIAL (Editor-in-Chief + Admin) ================= */
const staffOnly = need('admin', 'eic');
const adminOnly = need('admin');

app.get('/api/admin/articles', staffOnly, (req, res) => {
  const st = str(req.query.status, 20);
  const rows = st && st !== 'all'
    ? db.prepare(`${ART_SELECT} WHERE a.status=? ORDER BY COALESCE(a.submitted_at,a.updated_at) DESC LIMIT 300`).all(st)
    : db.prepare(`${ART_SELECT} ORDER BY a.updated_at DESC LIMIT 300`).all();
  res.json(rows.map(a => out(a)));
});
app.get('/api/admin/queue', staffOnly, (req, res) => {
  const sts = req.user.role === 'admin' ? ['submitted', 'approved'] : ['submitted'];
  res.json(db.prepare(`${ART_SELECT} WHERE a.status IN (${sts.map(() => '?').join(',')}) ORDER BY a.submitted_at`).all(...sts).map(a => out(a)));
});
app.post('/api/admin/articles/:id/action', staffOnly, (req, res) => {
  const a = db.prepare('SELECT * FROM articles WHERE id=?').get(+req.params.id);
  if (!a) return bad(res, 'Not found', 404);
  const act = req.body.action, note = str(req.body.note, 600), t = now();
  switch (act) {
    case 'publish':
      if (req.user.role === 'eic' && getSetting('flow') !== 'eic') return bad(res, 'Only the Admin can publish under the current flow', 403);
      applyPublish(req.user, a, { featured: req.body.featured, breaking: req.body.breaking }); break;
    case 'approve':
      db.prepare(`UPDATE articles SET status='approved', featured=?, breaking=?, updated_at=? WHERE id=?`).run(req.body.featured ? 1 : 0, req.body.breaking ? 1 : 0, t, a.id); break;
    case 'changes':
      db.prepare(`UPDATE articles SET status='changes', editor_note=?, updated_at=? WHERE id=?`).run(note || 'Please revise and resubmit.', t, a.id); break;
    case 'reject':
      db.prepare(`UPDATE articles SET status='rejected', editor_note=?, updated_at=? WHERE id=?`).run(note || 'Not suitable for publication.', t, a.id); break;
    case 'unpublish': {
      db.prepare(`UPDATE articles SET status='unpublished', featured=0, updated_at=? WHERE id=?`).run(t, a.id);
      const b = getSetting('breaking'); if (b?.articleId === a.id) setSetting('breaking', { active: false }); break;
    }
    case 'feature':
      db.prepare('UPDATE articles SET featured=0').run();
      if (!a.featured) db.prepare('UPDATE articles SET featured=1 WHERE id=?').run(a.id); break;
    default: return bad(res, 'Unknown action');
  }
  res.json({ ok: true });
});
app.delete('/api/admin/articles/:id', adminOnly, (req, res) => {
  db.prepare('DELETE FROM articles WHERE id=?').run(+req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/comments', staffOnly, (req, res) => {
  res.json(db.prepare(`SELECT c.*, a.title AS article_title, a.slug AS article_slug FROM comments c JOIN articles a ON a.id=c.article_id
    ORDER BY CASE c.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, c.created_at DESC LIMIT 400`).all());
});
app.put('/api/admin/comments/:id', staffOnly, (req, res) => {
  const st = req.body.status;
  if (!['approved', 'rejected', 'pending'].includes(st)) return bad(res, 'Bad status');
  db.prepare('UPDATE comments SET status=? WHERE id=?').run(st, +req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/comments/:id', staffOnly, (req, res) => { db.prepare('DELETE FROM comments WHERE id=?').run(+req.params.id); res.json({ ok: true }); });

app.post('/api/admin/breaking', staffOnly, async (req, res) => {
  const text = str(req.body.text, 200);
  if (!text) return bad(res, 'Write the breaking headline');
  res.json(await goLive(text, req.body.articleId ? +req.body.articleId : null));
});
app.delete('/api/admin/breaking', staffOnly, (req, res) => {
  setSetting('breaking', { active: false });
  db.prepare('UPDATE articles SET breaking=0').run();
  res.json({ ok: true });
});

app.post('/api/admin/events', staffOnly, (req, res) => {
  const title = str(req.body.title, 160), date = str(req.body.date, 10);
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad(res, 'Title and date are required');
  const link = str(req.body.link, 500);
  db.prepare('INSERT INTO events(title,date,location,description,link,created_at) VALUES(?,?,?,?,?,?)')
    .run(title, date, str(req.body.location, 120), str(req.body.description, 400), isUrl(link) ? link : '', now());
  res.json({ ok: true });
});
app.delete('/api/admin/events/:id', staffOnly, (req, res) => { db.prepare('DELETE FROM events WHERE id=?').run(+req.params.id); res.json({ ok: true }); });

/* ================= ADMIN ONLY ================= */
app.get('/api/admin/overview', adminOnly, (req, res) => {
  const one = (q, ...a) => db.prepare(q).get(...a);
  res.json({
    published: one(`SELECT COUNT(*) n FROM articles WHERE status='published'`).n,
    views: one(`SELECT COALESCE(SUM(views),0) n FROM articles`).n,
    awaiting: one(`SELECT COUNT(*) n FROM articles WHERE status IN ('submitted','approved')`).n,
    pendingComments: one(`SELECT COUNT(*) n FROM comments WHERE status='pending'`).n,
    contributors: one(`SELECT COUNT(*) n FROM users WHERE role='contributor' AND status='active'`).n,
    applicants: one(`SELECT COUNT(*) n FROM users WHERE status='pending'`).n,
    impressions: one(`SELECT COALESCE(SUM(impressions),0) n FROM ads`).n,
    clicks: one(`SELECT COALESCE(SUM(clicks),0) n FROM ads`).n,
    subscribers: one(`SELECT COUNT(*) n FROM push_subs`).n,
    ranking: ranked(),
  });
});
app.get('/api/admin/counts', staffOnly, (req, res) => {
  const sts = req.user.role === 'admin' ? `('submitted','approved')` : `('submitted')`;
  res.json({
    queue: db.prepare(`SELECT COUNT(*) n FROM articles WHERE status IN ${sts}`).get().n,
    comments: db.prepare(`SELECT COUNT(*) n FROM comments WHERE status='pending'`).get().n,
    applicants: db.prepare(`SELECT COUNT(*) n FROM users WHERE status='pending'`).get().n,
  });
});

app.get('/api/admin/users', adminOnly, (req, res) => {
  const stats = Object.fromEntries(contributorStats().map(s => [s.id, s.score]));
  res.json(db.prepare('SELECT id,name,email,role,status,bio,color,avatar,headline,location,website,created_at FROM users ORDER BY CASE status WHEN \'pending\' THEN 0 ELSE 1 END, created_at DESC').all()
    .map(u => ({ ...u, score: stats[u.id] || 0 })));
});
app.post('/api/admin/users', adminOnly, (req, res) => {
  const name = str(req.body.name, 80), email = str(req.body.email, 200).toLowerCase(), role = req.body.role;
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return bad(res, 'Name and a valid email are required');
  if (!['admin', 'eic', 'contributor'].includes(role)) return bad(res, 'Bad role');
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return bad(res, 'Email already registered');
  const temp = crypto.randomBytes(5).toString('hex');
  const n = db.prepare('SELECT COUNT(*) n FROM users').get().n;
  db.prepare('INSERT INTO users(name,email,password_hash,role,status,bio,color,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(name, email, bcrypt.hashSync(temp, 10), role, 'active', str(req.body.bio, 2000), COLORS[n % COLORS.length], now());
  db.prepare('UPDATE users SET headline=? WHERE email=?').run(str(req.body.headline, 120), email);
  res.json({ ok: true, tempPassword: temp });
});
app.put('/api/admin/users/:id', adminOnly, (req, res) => {
  const id = +req.params.id;
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(id);
  if (!u) return bad(res, 'Not found', 404);
  if (id === req.user.id && (req.body.role || req.body.status)) return bad(res, 'You cannot change your own role or status');
  if (req.body.role && ['admin', 'eic', 'contributor'].includes(req.body.role)) db.prepare('UPDATE users SET role=? WHERE id=?').run(req.body.role, id);
  if (req.body.status && ['active', 'suspended'].includes(req.body.status)) db.prepare('UPDATE users SET status=? WHERE id=?').run(req.body.status, id);
  if (req.body.profile) saveProfile(id, req.body.profile, u.name);
  if (req.body.resetPassword) {
    const temp = crypto.randomBytes(5).toString('hex');
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(temp, 10), id);
    return res.json({ ok: true, tempPassword: temp });
  }
  res.json({ ok: true });
});
app.delete('/api/admin/users/:id', adminOnly, (req, res) => {
  const id = +req.params.id;
  if (id === req.user.id) return bad(res, 'You cannot delete yourself');
  if (db.prepare('SELECT 1 FROM articles WHERE author_id=?').get(id)) return bad(res, 'This person has articles — suspend them instead');
  db.prepare('DELETE FROM users WHERE id=?').run(id);
  res.json({ ok: true });
});

app.get('/api/admin/ads', adminOnly, (req, res) => res.json(db.prepare('SELECT * FROM ads ORDER BY created_at DESC').all()));
function adFields(b) {
  const link = str(b.link, 500), d = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null;
  return {
    advertiser: str(b.advertiser, 120), title: str(b.title, 120), text: str(b.text, 200), link: isUrl(link) ? link : '',
    placement: ['top', 'sidebar', 'inline'].includes(b.placement) ? b.placement : 'sidebar',
    color: /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : '#fe5800', image: localUrl(b.image),
    active: b.active === undefined ? 1 : (b.active && b.active !== '0' && b.active !== 'false' ? 1 : 0),
    starts_on: d(b.startsOn), ends_on: d(b.endsOn),
  };
}
app.post('/api/admin/ads', adminOnly, (req, res) => {
  const f = adFields(req.body);
  if (!f.title || !f.advertiser) return bad(res, 'Advertiser and headline are required');
  const r = db.prepare('INSERT INTO ads(advertiser,title,text,link,placement,color,image,active,starts_on,ends_on,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
    .run(f.advertiser, f.title, f.text, f.link, f.placement, f.color, f.image, f.active, f.starts_on, f.ends_on, now());
  res.json({ ok: true, id: r.lastInsertRowid });
});
app.put('/api/admin/ads/:id', adminOnly, (req, res) => {
  const id = +req.params.id;
  if (!db.prepare('SELECT 1 FROM ads WHERE id=?').get(id)) return bad(res, 'Advert not found', 404);
  if (Object.keys(req.body).length === 1 && typeof req.body.active === 'boolean') {
    db.prepare('UPDATE ads SET active=? WHERE id=?').run(req.body.active ? 1 : 0, id);
    return res.json({ ok: true });
  }
  const f = adFields(req.body);
  if (!f.title || !f.advertiser) return bad(res, 'Advertiser and headline are required');
  db.prepare('UPDATE ads SET advertiser=?,title=?,text=?,link=?,placement=?,color=?,image=?,active=?,starts_on=?,ends_on=? WHERE id=?')
    .run(f.advertiser, f.title, f.text, f.link, f.placement, f.color, f.image, f.active, f.starts_on, f.ends_on, id);
  if (req.body.resetStats) db.prepare('UPDATE ads SET impressions=0, clicks=0 WHERE id=?').run(id);
  res.json({ ok: true });
});
app.post('/api/admin/ads/:id/reuse', adminOnly, (req, res) => {
  const a = db.prepare('SELECT * FROM ads WHERE id=?').get(+req.params.id);
  if (!a) return bad(res, 'Advert not found', 404);
  const r = db.prepare('INSERT INTO ads(advertiser,title,text,link,placement,color,image,active,starts_on,ends_on,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
    .run(a.advertiser, a.title, a.text, a.link, a.placement, a.color, a.image, 0, null, null, now());
  res.json({ ok: true, id: r.lastInsertRowid });
});
app.delete('/api/admin/ads/:id', adminOnly, (req, res) => { db.prepare('DELETE FROM ads WHERE id=?').run(+req.params.id); res.json({ ok: true }); });

app.get('/api/admin/weather', adminOnly, (req, res) => res.json({
  cities: db.prepare('SELECT * FROM weather ORDER BY sort,id').all(), alerts: getSetting('alerts', []), live: !!process.env.OPENWEATHER_API_KEY,
}));
app.put('/api/admin/weather', adminOnly, async (req, res) => {
  const cities = Array.isArray(req.body.cities) ? req.body.cities.slice(0, 30) : [];
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM weather').run();
    const ins = db.prepare('INSERT INTO weather(city,lat,lon,temp,cond,hum,wind,sort,updated_at) VALUES(?,?,?,?,?,?,?,?,?)');
    cities.forEach((c, i) => {
      const city = str(c.city, 60); if (!city) return;
      const num = v => (v === '' || v == null || isNaN(+v)) ? null : +v;
      ins.run(city, num(c.lat), num(c.lon), num(c.temp), str(c.cond, 30), num(c.hum), num(c.wind), i, now());
    });
  });
  tx();
  const alerts = (Array.isArray(req.body.alerts) ? req.body.alerts : []).slice(0, 10)
    .map(a => ({ level: a.level === 'warning' ? 'warning' : 'info', text: str(a.text, 300) })).filter(a => a.text);
  setSetting('alerts', alerts);
  if (process.env.OPENWEATHER_API_KEY) await refreshWeather();
  res.json({ ok: true });
});

app.put('/api/admin/settings', adminOnly, (req, res) => {
  if (req.body.tagline !== undefined) setSetting('tagline', str(req.body.tagline, 120));
  if (['eic', 'eic+admin'].includes(req.body.flow)) setSetting('flow', req.body.flow);
  if (req.body.moderate !== undefined) setSetting('moderate', !!req.body.moderate);
  if (req.body.limits && typeof req.body.limits === 'object') {
    const cur = limits();
    for (const [k, [lo, hi]] of Object.entries(LIMIT_RULES)) {
      const v = Number(req.body.limits[k]);
      if (!isNaN(v) && req.body.limits[k] !== '') cur[k] = Math.min(hi, Math.max(lo, k === 'imgMaxMB' ? Math.round(v * 10) / 10 : Math.round(v)));
    }
    setSetting('limits', cur);
  }
  res.json({ ok: true });
});

app.use('/api', (req, res) => bad(res, 'Not found', 404));

/* ================= FEEDS & SEO ================= */
app.get('/rss.xml', (req, res) => {
  const items = db.prepare(`${ART_SELECT} WHERE ${PUB} ORDER BY a.published_at DESC LIMIT 30`).all();
  res.type('application/rss+xml').send(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Engineeria Africa</title><link>${SITE_URL}</link><description>${xml(getSetting('tagline'))}</description>
${items.map(a => `<item><title>${xml(a.title)}</title><link>${SITE_URL}/article/${a.slug}</link><guid>${SITE_URL}/article/${a.slug}</guid><pubDate>${new Date(a.published_at).toUTCString()}</pubDate><category>${xml(a.category)}</category><description>${xml(a.excerpt)}</description></item>`).join('\n')}
</channel></rss>`);
});
app.get('/sitemap.xml', (req, res) => {
  const items = db.prepare(`SELECT slug, updated_at FROM articles WHERE status='published' ORDER BY published_at DESC LIMIT 5000`).all();
  const urls = ['', '/weather', '/contributors', ...CAT_IDS.map(c => '/section/' + c)].map(p => `<url><loc>${SITE_URL}${p}</loc></url>`)
    .concat(items.map(a => `<url><loc>${SITE_URL}/article/${a.slug}</loc><lastmod>${new Date(a.updated_at).toISOString().slice(0, 10)}</lastmod></url>`));
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`);
});
app.get('/robots.txt', (req, res) => res.type('text/plain').send(`User-agent: *\nDisallow: /dashboard\nDisallow: /write\nDisallow: /api/\nSitemap: ${SITE_URL}/sitemap.xml\n`));

/* ================= STATIC + APP SHELL ================= */
app.use('/uploads', express.static(UP_DIR, { maxAge: '30d', immutable: true }));
app.get('/sw.js', (req, res) => { res.set('Cache-Control', 'no-cache'); res.sendFile(path.join(__dirname, 'public', 'sw.js')); });
app.use(express.static(path.join(__dirname, 'public'), { index: false, maxAge: PROD ? '1h' : 0 }));

const SHELL = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
function meta({ title, description, image, url, type = 'website' }) {
  const t = xml(title), d = xml(description);
  return `<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${xml(url)}">
<meta property="og:site_name" content="Engineeria Africa"><meta property="og:type" content="${type}">
<meta property="og:title" content="${t}"><meta property="og:description" content="${d}">
<meta property="og:url" content="${xml(url)}"><meta property="og:image" content="${xml(image)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}"><meta name="twitter:image" content="${xml(image)}">`;
}
app.get('*', (req, res) => {
  let m = { title: 'Engineering News & Magazine — Engineeria Africa', description: getSetting('tagline') + ' — engineering news, projects, events, weather and climate updates from across Africa.', image: SITE_URL + '/icons/og-default.png', url: SITE_URL + req.path };
  const am = req.path.match(/^\/article\/([\w-]+)$/);
  if (am) {
    const a = db.prepare(`SELECT title,excerpt,cover,slug FROM articles WHERE slug=? AND status='published'`).get(am[1]);
    if (a) m = { title: `${a.title} — Engineeria Africa`, description: a.excerpt, image: a.cover ? SITE_URL + a.cover : m.image, url: `${SITE_URL}/article/${a.slug}`, type: 'article' };
  }
  res.set('Cache-Control', 'no-cache').type('html').send(SHELL.replace('<!--META-->', meta(m)));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`✓ Engineeria Africa running on http://127.0.0.1:${PORT}  (public URL: ${SITE_URL})`);
  startWeather();
});
