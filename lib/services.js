// Weather refresh (OpenWeatherMap) and web-push breaking-news alerts
const webpush = require('web-push');
const { db } = require('../db');

/* ---------------- Weather ---------------- */
function mapCondition(w) {
  const main = w.weather?.[0]?.main || '';
  if (main === 'Clear') return 'Sunny';
  if (main === 'Clouds') return (w.clouds?.all ?? 100) < 60 ? 'Partly cloudy' : 'Cloudy';
  if (main === 'Rain' || main === 'Drizzle') return 'Rain';
  if (main === 'Thunderstorm') return 'Thunderstorm';
  return 'Haze'; // Mist, Haze, Dust, Fog, Smoke, Sand…
}
async function refreshWeather() {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return false;
  const cities = db.prepare('SELECT * FROM weather WHERE lat IS NOT NULL AND lon IS NOT NULL').all();
  const upd = db.prepare('UPDATE weather SET temp=?, cond=?, hum=?, wind=?, updated_at=? WHERE id=?');
  for (const c of cities) {
    try {
      const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${c.lat}&lon=${c.lon}&units=metric&appid=${key}`);
      if (!r.ok) { console.warn('weather', c.city, r.status); continue; }
      const w = await r.json();
      upd.run(Math.round(w.main.temp), mapCondition(w), Math.round(w.main.humidity), Math.round((w.wind?.speed || 0) * 3.6), Date.now(), c.id);
    } catch (e) { console.warn('weather fetch failed for', c.city, e.message); }
  }
  return true;
}
function startWeather() {
  if (!process.env.OPENWEATHER_API_KEY) {
    console.log('ℹ  OPENWEATHER_API_KEY not set — weather figures are entered by hand in Admin › Weather.');
    return;
  }
  refreshWeather();
  setInterval(refreshWeather, 30 * 60 * 1000);
}

/* ---------------- Push notifications ---------------- */
const pushReady = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (pushReady) {
  webpush.setVapidDetails('mailto:' + (process.env.VAPID_EMAIL || process.env.ADMIN_EMAIL || 'admin@example.com'),
    process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
}
async function pushAll(payload) {
  if (!pushReady) return 0;
  const subs = db.prepare('SELECT endpoint, data FROM push_subs').all();
  const del = db.prepare('DELETE FROM push_subs WHERE endpoint=?');
  let sent = 0;
  await Promise.all(subs.map(async s => {
    try { await webpush.sendNotification(JSON.parse(s.data), JSON.stringify(payload), { TTL: 6 * 3600, urgency: 'high' }); sent++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) del.run(s.endpoint); }
  }));
  return sent;
}

module.exports = { startWeather, refreshWeather, pushAll, pushReady };
