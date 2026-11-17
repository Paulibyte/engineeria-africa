// Daily backup: safe copy of the database + uploads archive, keeps the last 14 days.
// Run by cron (see DEPLOY.md):  node scripts/backup.js
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const Database = require('better-sqlite3');

const root = path.join(__dirname, '..');
const dir = process.env.BACKUP_DIR || path.join(root, 'backups');
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);

(async () => {
  const db = new Database(path.join(root, 'data', 'engineeria.db'), { readonly: true });
  await db.backup(path.join(dir, `engineeria-${stamp}.db`));
  db.close();
  if (fs.existsSync(path.join(root, 'uploads'))) {
    execSync(`tar -czf "${path.join(dir, `uploads-${stamp}.tar.gz`)}" -C "${root}" uploads`);
  }
  const cutoff = Date.now() - 14 * 864e5;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p);
  }
  console.log(`✓ backup ${stamp} saved to ${dir}`);
})().catch(e => { console.error('backup failed:', e.message); process.exit(1); });
