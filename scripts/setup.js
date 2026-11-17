// One-time setup: creates .env with secure random secrets and push-notification keys.
// Safe to run again — it never overwrites values you have already set.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const webpush = require('web-push');

const envPath = path.join(__dirname, '..', '.env');
const examplePath = path.join(__dirname, '..', '.env.example');
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : fs.readFileSync(examplePath, 'utf8');

const setIfEmpty = (key, value) => {
  const re = new RegExp(`^${key}=(.*)$`, 'm');
  const m = env.match(re);
  if (m && m[1].trim()) return false;
  env = m ? env.replace(re, `${key}=${value}`) : env + `\n${key}=${value}\n`;
  return true;
};

const changed = [];
if (setIfEmpty('JWT_SECRET', crypto.randomBytes(32).toString('hex'))) changed.push('JWT_SECRET');
const hasVapid = /^VAPID_PUBLIC_KEY=\S+/m.test(env);
if (!hasVapid) {
  const keys = webpush.generateVAPIDKeys();
  setIfEmpty('VAPID_PUBLIC_KEY', keys.publicKey);
  setIfEmpty('VAPID_PRIVATE_KEY', keys.privateKey);
  changed.push('VAPID keys');
}
fs.writeFileSync(envPath, env);
console.log(changed.length ? `✓ .env ready (generated: ${changed.join(', ')})` : '✓ .env already set up — nothing changed');
console.log('→ Now open .env and fill in SITE_URL, ADMIN_EMAIL, ADMIN_PASSWORD (and OPENWEATHER_API_KEY if you have one).');
