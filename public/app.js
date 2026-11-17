/* Engineeria Africa — front-end (installable PWA) */
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ROLE_NAMES = { admin: 'Administrator', eic: 'Editor-in-Chief', contributor: 'Contributor' };
const WX_ICON = { 'Sunny': '☀️', 'Partly cloudy': '⛅', 'Cloudy': '☁️', 'Rain': '🌧️', 'Thunderstorm': '⛈️', 'Haze': '🌫️' };

/* ---------------- state ---------------- */
const S = { boot: null, ads: [], shownAds: [], speaking: null, dashTab: null, artFilter: 'all', editing: null, confirmKey: null, msg: '', counts: {}, sidebar: null, sidebarAt: 0, routeId: 0, installEvt: null };
const P = (() => { let p = {}; try { p = JSON.parse(localStorage.getItem('ea_prefs')) || {}; } catch { } return { dark: false, sound: true, seenBreaking: null, ...p }; })();
const savePrefs = () => { try { localStorage.setItem('ea_prefs', JSON.stringify(P)); } catch { } };
const me = () => S.boot?.me || null;
const role = () => me()?.role || null;
const staff = () => ['admin', 'eic'].includes(role());
const cat = id => S.boot.cats.find(c => c.id === id) || S.boot.cats[0];

/* ---------------- api ---------------- */
async function api(method, url, body) {
  const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  let data = null; try { data = await r.json(); } catch { }
  if (!r.ok) throw new Error(data?.error || `Request failed (${r.status})`);
  return data;
}
const GET = u => api('GET', u), POST = (u, b) => api('POST', u, b || {}), PUT = (u, b) => api('PUT', u, b || {}), DEL = u => api('DELETE', u);
function uploadFile(file, kind, onProgress) {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest(), fd = new FormData();
    fd.append('file', file);
    x.open('POST', '/api/upload?kind=' + kind);
    x.upload.onprogress = e => e.lengthComputable && onProgress?.(e.loaded / e.total);
    x.onload = () => { let d = {}; try { d = JSON.parse(x.responseText); } catch { } x.status < 300 ? res(d.url) : rej(new Error(d.error || 'Upload failed')); };
    x.onerror = () => rej(new Error('Upload failed — check your connection'));
    x.send(fd);
  });
}

/* ---------------- helpers ---------------- */
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3200); }
function timeAgo(ts) { if (!ts) return ''; const s = (Date.now() - ts) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; if (s < 604800) return Math.floor(s / 86400) + 'd ago'; return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
const starStr = n => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
const tierBadge = t => t ? `<span class="tier" style="background:${t.color}">${t.name}</span>` : '';
const initials = n => String(n || '?').replace(/^(Engr\.|Dr\.|Prof\.)\s*/, '').split(' ').map(w => w[0]).slice(0, 2).join('');
const avatar = (name, color) => `<span class="av" style="background:${color || '#022455'}">${esc(initials(name))}</span>`;
const inline = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
const fmtBody = b => String(b || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => p.startsWith('## ') ? `<h2>${inline(p.slice(3))}</h2>` : p.startsWith('> ') ? `<blockquote>${inline(p.slice(2))}</blockquote>` : `<p>${inline(p)}</p>`);
const H2 = t => `<div class="sec-h"><h2>${t}</h2></div>`;
const fmtDate = ts => ts ? new Date(ts).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';

/* ---------------- generated cover art ---------------- */
const N = n => n.toFixed(0);
const arcV = () => { let s = ''; for (let x = 118; x <= 522; x += 34) { const t = (x - 80) / 480; s += `<path d="M${x} 250V${N(250 - 380 * t * (1 - t))}"/>`; } return s; };
const teeth = () => { let s = ''; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; s += `<path stroke-width="18" d="M${N(320 + 82 * Math.cos(a))} ${N(180 + 82 * Math.sin(a))}L${N(320 + 106 * Math.cos(a))} ${N(180 + 106 * Math.sin(a))}"/>`; } return s; };
const rays = () => { let s = ''; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; s += `<path d="M${N(470 + 54 * Math.cos(a))} ${N(110 + 54 * Math.sin(a))}L${N(470 + 74 * Math.cos(a))} ${N(110 + 74 * Math.sin(a))}"/>`; } return s; };
const pins = () => { let s = ''; for (let i = 0; i < 5; i++) { const v = 126 + i * 27; s += `<path d="M${v + 139} 110V88M${v + 139} 250V272M250 ${v}H228M390 ${v}H412"/>`; } return s; };
const SHAPES = {
  civil: `<path d="M50 250H590M80 250Q320 60 560 250"/>${arcV()}<path d="M80 250V300M560 250V300M320 250V300"/>`,
  mechanical: `<circle cx="320" cy="180" r="82"/><circle cx="320" cy="180" r="30"/>${teeth()}`,
  electrical: `<path d="M320 55L245 310M320 55L395 310M262 250H378M278 190H362M294 130H346M262 250L362 190M378 250L278 190M278 190L346 130M362 190L294 130"/><path d="M40 120Q180 165 294 130M346 130Q460 165 600 120"/><path stroke-width="5" d="M520 200l-24 44h22l-16 40 40-56h-22l16-28z"/>`,
  energy: `<circle cx="470" cy="110" r="40"/>${rays()}<path d="M110 305L190 175H390L340 305Z"/><path d="M130 262H357M152 218H374M257 175L223 305M323 175L290 305"/>`,
  construction: `<path d="M210 320V70M185 320H240M210 70H570M210 70L160 112H210M210 112L570 70M500 70V190M485 190H515V218H485Z"/><path d="M360 320V220H470V320M380 245H450M380 275H450"/><path d="M60 320H600"/>`,
  tech: `<rect x="250" y="110" width="140" height="140" rx="10"/><rect x="286" y="146" width="68" height="68"/>${pins()}<path d="M90 90H180V150M550 270H460V210"/><circle cx="90" cy="90" r="6"/><circle cx="550" cy="270" r="6"/>`,
  environment: `<path d="M215 175a50 50 0 0 1 95-22a42 42 0 0 1 72 26a36 36 0 0 1-6 72H228a44 44 0 0 1-13-76z"/><path d="M260 275l-12 26M300 275l-12 26M340 275l-12 26"/><path d="M60 320q40-24 80 0t80 0t80 0t80 0t80 0t80 0t80 0"/>`,
  events: `<rect x="230" y="85" width="180" height="185" rx="12"/><path d="M230 135H410M275 65V105M365 65V105"/><path d="M265 170h20M310 170h20M355 170h20M265 205h20M310 205h20M355 205h20M265 240h20M310 240h20"/>`
};
const coverCache = {};
function genCover(category, seed) {
  const k = category + seed; if (coverCache[k]) return coverCache[k];
  let h = 0; for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) % 997;
  const c = cat(category).color;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#022455"/></linearGradient><pattern id="p" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#fff" stroke-opacity=".13"/></pattern></defs><rect width="640" height="360" fill="url(#g)"/><rect width="640" height="360" fill="url(#p)"/><g fill="none" stroke="#fff" stroke-width="3.5" stroke-opacity=".8" stroke-linecap="round" stroke-linejoin="round" transform="translate(${(h % 80) - 40} ${(h % 30) - 15})">${SHAPES[category] || SHAPES.civil}</g></svg>`;
  return coverCache[k] = 'data:image/svg+xml,' + encodeURIComponent(svg);
}
const coverOf = a => a.cover || genCover(a.category, a.slug || a.id);

/* ---------------- sound, speech ---------------- */
let actx = null;
function chime(force) {
  if (!P.sound && !force) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const t0 = actx.currentTime;
    [988, 784, 988, 1175].forEach((f, i) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = 'triangle'; o.frequency.value = f; const s = t0 + i * .17; g.gain.setValueAtTime(.0001, s); g.gain.exponentialRampToValueAtTime(.35, s + .02); g.gain.exponentialRampToValueAtTime(.0001, s + .16); o.connect(g).connect(actx.destination); o.start(s); o.stop(s + .18); });
  } catch { }
}
function syncListen() {
  $$('[data-act=listen],[data-act=bulletin]').forEach(b => {
    const on = S.speaking === (b.dataset.act === 'bulletin' ? 'bulletin' : b.dataset.id);
    b.classList.toggle('on', on);
    b.textContent = b.dataset.act === 'bulletin' ? (on ? '■ Stop bulletin' : '🎧 Listen to headlines') : (on ? '■ Stop listening' : '🎧 Listen to this story');
  });
}
function speak(text, id) {
  if (!('speechSynthesis' in window)) return toast('Read-aloud is not supported in this browser');
  speechSynthesis.cancel();
  if (S.speaking === id) { S.speaking = null; return syncListen(); }
  const u = new SpeechSynthesisUtterance(text);
  const v = speechSynthesis.getVoices().find(v => /en[-_](NG|GB|ZA|KE)/i.test(v.lang)); if (v) u.voice = v;
  u.onend = u.onerror = () => { if (S.speaking === id) { S.speaking = null; syncListen(); } };
  S.speaking = id; speechSynthesis.speak(u); syncListen();
}

/* ---------------- ads ---------------- */
function adSlot(pl) {
  const list = S.ads.filter(a => a.placement === pl);
  if (!list.length) return `<div class="ad"><span class="lbl">Advertise here</span><a class="unit" style="background:linear-gradient(135deg,#022455,#0b3a75)" href="/advertise"><h4>Your brand in front of Africa's engineers</h4><div style="opacity:.85;font-size:13.5px">Banner, sidebar and in-article placements available.</div></a></div>`;
  const a = list[Math.floor(Math.random() * list.length)];
  S.shownAds.push(a.id);
  const inner = a.image ? `<img src="${esc(a.image)}" alt="${esc(a.title)}" loading="lazy">` : `<h4>${esc(a.title)}</h4><div style="opacity:.9;font-size:14px;margin-top:4px">${esc(a.text)}</div><span class="cta">Learn more →</span>`;
  return `<div class="ad"><span class="lbl">Advertisement · ${esc(a.advertiser)}</span><a class="unit ${a.image ? 'img' : ''}" style="background:linear-gradient(135deg,${esc(a.color)},#022455)" href="/go/ad/${a.id}" target="_blank" rel="noopener sponsored">${inner}</a></div>`;
}
function flushAds() { if (S.shownAds.length) { POST('/api/ads/impressions', { ids: [...new Set(S.shownAds)] }).catch(() => { }); S.shownAds = []; } }

/* ---------------- header / footer / flash ---------------- */
const LOGO = `<img class="logo-mark" src="/icons/logo-badge.svg" alt="Engineeria Africa logo" width="52" height="52">`;
function renderTop() {
  const b = S.boot.breaking, w = S.boot.weather.cities[0], path = location.pathname, u = me();
  const nav = (href, label) => `<a href="${href}" class="${path === href ? 'on' : ''}">${label}</a>`;
  const bar = b.active ? `<div class="breaking"><div class="wrap"><span class="tag">BREAKING</span><span>${esc(b.text)}</span><span class="sp"></span>${b.slug ? `<a class="lk" href="/article/${b.slug}">Read</a>` : ''}<button data-act="playAlert" title="Play alert sound" aria-label="Play alert sound">🔊</button></div></div>`
    : (S.ticker?.length ? `<div class="ticker"><b>LATEST</b><div style="overflow:hidden;flex:1"><div class="tr">${[...S.ticker, ...S.ticker].map(a => `<a href="/article/${a.slug}">${esc(a.title)}</a>`).join('')}</div></div></div>` : '');
  const alertsOn = P.sound;
  $('#top').innerHTML = `<div class="topbar"><div class="wrap">
   <span class="hide-sm">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
   ${w && w.temp != null ? `<a href="/weather">${WX_ICON[w.cond] || '🌡️'} ${esc(w.city)} ${Math.round(w.temp)}°C</a>` : ''}
   <span class="sp"></span>
   ${S.installEvt || isIOS() ? `<button class="tb only-browser" data-act="install">⬇ Install app</button>` : ''}
   <button class="tb ${alertsOn ? 'on' : ''}" data-act="alerts" title="Breaking-news alerts">${alertsOn ? '🔔 Alerts on' : '🔕 Alerts off'}</button>
   <button class="tb" data-act="dark" title="Dark mode" aria-label="Toggle dark mode">${P.dark ? '☀︎' : '☾'}</button>
   ${u ? `<a class="tb" href="/dashboard" style="background:var(--accent);border-color:var(--accent)">Dashboard</a><button class="tb hide-sm" data-act="logout">Sign out</button>`
      : `<a class="tb" href="/login">Sign in</a><a class="tb hide-sm" href="/write-for-us">Write for us</a>`}
  </div></div>
  <header class="mast"><div class="wrap">
   <a class="logo" href="/">${LOGO}<div><h1>ENGINEERIA <span>AFRICA</span></h1><small>${esc(S.boot.settings.tagline)}</small></div></a>
   <span class="sp"></span>
   <button class="listen ${S.speaking === 'bulletin' ? 'on' : ''}" data-act="bulletin">🎧 Listen to headlines</button>
   <form class="search" data-form="search" role="search"><input name="q" placeholder="Search engineering news…" aria-label="Search" value="${esc(new URLSearchParams(location.search).get('q') || '')}"><button aria-label="Search">⌕</button></form>
  </div></header>
  <nav class="nav"><div class="wrap">${nav('/', 'Home')}${S.boot.cats.map(c => nav('/section/' + c.id, c.name)).join('')}${nav('/weather', 'Weather & Climate')}${nav('/contributors', 'Top Contributors')}</div></nav>${bar}`;
  syncListen();
}
function renderFoot() {
  $('#foot').innerHTML = `<footer><div class="wrap">
   <div><a class="logo" href="/" style="margin-bottom:10px">${LOGO}<div><h1 style="font-size:22px;color:#fff">ENGINEERIA <span>AFRICA</span></h1></div></a>
   <p>Engineering news, projects, events and ideas from across the continent.</p><p style="font-size:12.5px">© ${new Date().getFullYear()} Engineeria Africa · <a href="/rss.xml" style="display:inline">RSS feed</a></p></div>
   <div><h4>Sections</h4>${S.boot.cats.slice(0, 6).map(c => `<a href="/section/${c.id}">${c.name}</a>`).join('')}</div>
   <div><h4>More</h4><a href="/section/events">Events</a><a href="/weather">Weather & Climate</a><a href="/contributors">Top Contributors</a><a href="/write-for-us">Write for us</a><a href="/advertise">Advertise with us</a></div>
  </div></footer>`;
}
function renderFlash() {
  const b = S.boot.breaking;
  $('#flash').innerHTML = (!b.active || P.seenBreaking === b.id) ? '' :
    `<div class="flash" role="alert"><div class="wrap"><span class="tag">BREAKING NEWS</span><b>${esc(b.text)}</b><span class="sp"></span>${b.slug ? `<a href="/article/${b.slug}" data-act="closeFlash">Read story</a>` : ''}<button data-act="closeFlash">Dismiss</button></div></div>`;
}

/* ---------------- shared pieces ---------------- */
function card(a) {
  const c = cat(a.category);
  return `<a class="card" href="/article/${a.slug}"><img src="${coverOf(a)}" alt="" loading="lazy"><div class="bd"><span class="cat" style="color:${c.color}">${c.name}</span><h3>${esc(a.title)}</h3><p>${esc(a.excerpt)}</p><span class="meta">${esc(a.authorName)} · ${timeAgo(a.publishedAt)} · 👁 ${a.views.toLocaleString()}${a.video ? ' · ▶' : ''}${a.audio ? ' · 🎙' : ''}</span></div></a>`;
}
function evRow(e) {
  const d = new Date(e.date + 'T00:00');
  return `<div class="ev"><div class="dt"><b>${d.getDate()}</b><span>${d.toLocaleDateString('en-GB', { month: 'short' })}</span></div><div><h4>${esc(e.title)}</h4><div class="meta">📍 ${esc(e.location)}${e.description ? ' · ' + esc(e.description) : ''}</div>${e.link ? `<a href="${esc(e.link)}" target="_blank" rel="noopener" class="meta" style="color:var(--accent)">Details ↗</a>` : ''}</div></div>`;
}
async function getSidebar() {
  if (!S.sidebar || Date.now() - S.sidebarAt > 60e3) { S.sidebar = await GET('/api/sidebar'); S.sidebarAt = Date.now(); }
  return S.sidebar;
}
function sidebar(sb) {
  const wx = S.boot.weather.cities.filter(w => w.temp != null).slice(0, 5);
  return `<aside>
   ${wx.length ? `<div class="panel"><h3>Weather</h3>${wx.map(w => `<div class="wx"><span class="ic">${WX_ICON[w.cond] || '🌡️'}</span><div><b style="font:600 14px 'IBM Plex Sans';margin:0">${esc(w.city)}</b><div class="meta">${esc(w.cond || '')}${w.hum != null ? ' · 💧' + w.hum + '%' : ''}</div></div><b>${Math.round(w.temp)}°</b></div>`).join('')}<a href="/weather" class="meta" style="color:var(--accent);font-weight:600">All cities & climate alerts →</a></div>` : ''}
   ${adSlot('sidebar')}
   ${sb.mostRead.length ? `<div class="panel"><h3>Most read</h3>${sb.mostRead.map((a, i) => `<a class="mr" href="/article/${a.slug}"><span class="n">${i + 1}</span><div><h4>${esc(a.title)}</h4><span class="meta">👁 ${a.views.toLocaleString()} views</span></div></a>`).join('')}</div>` : ''}
   <div class="panel"><h3>Upcoming events</h3>${sb.events.length ? sb.events.map(evRow).join('') : '<div class="meta">No upcoming events listed.</div>'}<a href="/section/events" class="meta" style="color:var(--accent);font-weight:600">All events →</a></div>
   ${sb.top.length ? `<div class="panel"><h3>Top contributors</h3>${sb.top.map((r, i) => `<div class="mr"><span class="n">${i + 1}</span>${avatar(r.name, r.color)}<div><h4>${esc(r.name)}</h4><span class="meta">${tierBadge(r.tier)} ${r.score} pts</span></div></div>`).join('')}<a href="/contributors" class="meta" style="color:var(--accent);font-weight:600">Leaderboard →</a></div>` : ''}
  </aside>`;
}

/* ================= PUBLIC VIEWS ================= */
async function viewHome() {
  const [d, sb] = await Promise.all([GET('/api/home'), getSidebar()]);
  S.ticker = [d.featured, ...d.latest].filter(Boolean).slice(0, 8);
  if (!d.featured) return `<div class="wrap empty panel" style="margin-top:24px"><h3>Welcome to Engineeria Africa</h3><p>No stories have been published yet.</p>${me() ? '<a class="btn pri" href="/write">Write the first story</a>' : '<a class="btn pri" href="/login">Newsroom sign-in</a>'}</div>`;
  const m = d.featured, side = d.latest.slice(0, 2), latest = d.latest.slice(2), c = cat(m.category);
  return `<div class="wrap" style="padding-top:20px">${adSlot('top')}
   <div class="hero" ${side.length ? '' : 'style="grid-template-columns:1fr"'}><a class="hero-main" href="/article/${m.slug}"><img src="${coverOf(m)}" alt=""><div class="ov"><span class="cat" style="background:${c.color};color:#fff;padding:3px 8px;border-radius:4px">${c.name}</span><h2>${esc(m.title)}</h2><p>${esc(m.excerpt)}</p><span class="meta" style="color:#c9d3e2">By ${esc(m.authorName)} · ${timeAgo(m.publishedAt)} · ${m.readTime} min read</span></div></a>
   ${side.length ? `<div class="hero-side">${side.map(card).join('')}</div>` : ''}</div></div>
   <div class="wrap layout"><div>
    ${H2('Latest news')}<div class="cards">${latest.map(card).join('') || '<div class="meta">More stories coming soon.</div>'}</div>
    ${d.events.length ? H2('Engineering events') + `<div class="panel">${d.events.map(evRow).join('')}</div>` : ''}
   </div>${sidebar(sb)}</div>`;
}
async function viewList(title, query, intro = '') {
  const [d, sb] = await Promise.all([GET('/api/articles?limit=12&' + query), getSidebar()]);
  return `<div class="wrap layout"><div>${H2(title)}${intro}
   ${d.items.length ? `<div class="cards" id="list">${d.items.map(card).join('')}</div>` : '<div class="empty panel">No stories here yet.</div>'}
   ${d.more ? `<div class="more"><button class="btn" data-act="more" data-q="${esc(query)}" data-off="12">Load more stories</button></div>` : ''}
  </div>${sidebar(sb)}</div>`;
}
async function viewSection(id) {
  if (!S.boot.cats.some(c => c.id === id)) return notFound();
  if (id === 'events') {
    const ev = await GET('/api/events'), today = new Date().toISOString().slice(0, 10);
    const up = ev.filter(e => e.date >= today), past = ev.filter(e => e.date < today).reverse().slice(0, 6);
    return viewList('Events', 'cat=events', `<div class="panel"><h3>Upcoming</h3>${up.map(evRow).join('') || '<div class="meta">No upcoming events listed.</div>'}${past.length ? `<h3 style="margin-top:14px">Recent</h3>${past.map(evRow).join('')}` : ''}</div>${H2('Event news')}`);
  }
  return viewList(cat(id).name, 'cat=' + id);
}
function videoBlock(v) {
  if (!v?.src) return '';
  if (v.type === 'file') return `<div class="video"><video src="${esc(v.src)}" controls playsinline preload="metadata"></video></div>`;
  let m = v.src.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/), emb = null, label = 'Watch video';
  if (m) { emb = 'https://www.youtube-nocookie.com/embed/' + m[1]; label = 'Watch on YouTube'; }
  else if ((m = v.src.match(/vimeo\.com\/(\d+)/))) { emb = 'https://player.vimeo.com/video/' + m[1]; label = 'Watch on Vimeo'; }
  return `${emb ? `<div class="video"><iframe src="${emb}" allowfullscreen loading="lazy" title="Video" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"></iframe></div>` : ''}<p class="meta" style="margin:0 0 18px">▶ <a href="${esc(v.src)}" target="_blank" rel="noopener" style="color:var(--accent);font-weight:600">${label} ↗</a></p>`;
}
function shareBar(a) {
  const url = location.origin + '/article/' + a.slug, u = encodeURIComponent(url), t = encodeURIComponent(a.title);
  const s = [['f', '#1877f2', `https://www.facebook.com/sharer/sharer.php?u=${u}`, 'Facebook'], ['𝕏', '#000', `https://twitter.com/intent/tweet?url=${u}&text=${t}`, 'X'], ['W', '#25d366', `https://wa.me/?text=${t}%20${u}`, 'WhatsApp'], ['in', '#0a66c2', `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, 'LinkedIn'], ['✈', '#229ed9', `https://t.me/share/url?url=${u}&text=${t}`, 'Telegram']];
  return `<div class="share">${navigator.share ? `<button style="background:var(--accent)" data-act="nativeShare" data-id="${esc(a.slug)}" title="Share">⇪</button>` : ''}${s.map(([l, c, h, n]) => `<a href="${h}" target="_blank" rel="noopener" style="background:${c}" title="Share on ${n}" aria-label="Share on ${n}">${l}</a>`).join('')}<button style="background:#64748b" data-act="copy" data-id="${esc(a.slug)}" title="Copy link" aria-label="Copy link">🔗</button></div>`;
}
async function viewArticle(slug) {
  let d;
  try { d = await GET('/api/articles/' + encodeURIComponent(slug)); } catch { return notFound(); }
  const sb = await getSidebar();
  const a = d.article, c = cat(a.category), au = d.author;
  S.current = a;
  document.title = a.title + ' — Engineeria Africa';
  const paras = fmtBody(a.body); if (paras.length > 2) paras.splice(2, 0, adSlot('inline'));
  return `<div class="wrap layout"><article class="article">
   ${a.status !== 'published' ? `<div class="note"><b>Preview</b> — status: <span class="pill s-${a.status}">${a.status}</span>${a.editorNote ? ` · Editor note: ${esc(a.editorNote)}` : ''}</div>` : ''}
   <div class="crumb"><a href="/">Home</a> › <a href="/section/${c.id}" style="color:${c.color};font-weight:700">${c.name}</a></div>
   <h1>${esc(a.title)}</h1><p class="stand">${esc(a.excerpt)}</p>
   <div class="byline">${avatar(a.authorName, a.authorColor)}<div><b>${esc(a.authorName)}</b> ${tierBadge(au?.tier)}<div class="meta">${a.publishedAt ? fmtDate(a.publishedAt) : 'Not yet published'} · ${a.readTime} min read · 👁 ${a.views.toLocaleString()} views${a.ratingN ? ` · <span class="stars">${starStr(a.rating)}</span> ${a.rating.toFixed(1)} (${a.ratingN})` : ''}</div></div></div>
   <div class="toolrow"><button class="listen" data-act="listen" data-id="${a.id}">🎧 Listen to this story</button><span class="sp"></span>${shareBar(a)}</div>
   <figure class="figure"><img src="${coverOf(a)}" alt=""></figure>
   ${videoBlock(a.video)}
   ${a.audio ? `<div class="audio-box"><b>🎙 Audio report</b><audio controls preload="none" src="${esc(a.audio)}"></audio></div>` : ''}
   <div class="prose">${paras.join('')}</div>
   ${a.tags ? `<p>${a.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => `<a class="chip" href="/search?q=${encodeURIComponent(t)}"># ${esc(t)}</a>`).join('')}</p>` : ''}
   <div class="toolrow" style="border-top:1px solid var(--line);padding-top:14px"><b>Share this story</b><span class="sp"></span>${shareBar(a)}</div>
   ${H2(`Comments & reviews (${d.comments.length})`)}
   ${a.status === 'published' ? `<form class="panel" data-form="comment" data-id="${a.id}">
    <div class="grid2"><div><label style="margin-top:0">Your name</label><input name="name" required maxlength="60" value="${esc(me()?.name || '')}"></div>
    <div><label style="margin-top:0">Rate this story</label><select name="stars"><option value="0">No rating</option>${[5, 4, 3, 2, 1].map(n => `<option value="${n}">${'★'.repeat(n)} (${n})</option>`).join('')}</select></div></div>
    <input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
    <label>Comment</label><textarea name="text" required maxlength="1500" placeholder="Share your engineering insight…"></textarea>
    <div class="btns" style="margin-top:10px"><button class="btn pri">Post comment</button><span class="hint">${S.boot.settings.moderate ? 'Comments appear after moderation.' : ''}</span></div>
   </form>` : ''}
   ${d.comments.map(cm => `<div class="cm"><b>${esc(cm.name)}</b> ${cm.stars ? `<span class="stars">${starStr(cm.stars)}</span>` : ''} <span class="meta">· ${timeAgo(cm.created_at)}</span><p>${inline(cm.text)}</p></div>`).join('') || '<p class="meta">Be the first to comment.</p>'}
   ${d.related.length ? H2('More in ' + c.name) + `<div class="cards">${d.related.map(card).join('')}</div>` : ''}
  </article>${sidebar(sb)}</div>`;
}
function afterArticle() {
  const a = S.current; if (!a || a.status !== 'published') return;
  const k = 'ea_v_' + a.id;
  try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, 1); } catch { }
  POST(`/api/articles/${a.id}/view`).catch(() => { });
}
async function viewWeather() {
  const d = await GET('/api/articles?cat=environment&limit=6'), wx = S.boot.weather;
  const latest = Math.max(0, ...wx.cities.map(c => c.updated_at || 0));
  return `<div class="wrap" style="padding-block:24px">${H2('Weather & climate')}
   ${wx.alerts.map(al => `<div class="alert ${al.level}"><b>${al.level === 'warning' ? '⚠️ Warning' : 'ℹ️ Advisory'}</b><span>${esc(al.text)}</span></div>`).join('')}
   <div class="wxbig">${wx.cities.filter(w => w.temp != null).map(w => `<div class="wxc"><span class="ic">${WX_ICON[w.cond] || '🌡️'}</span><div style="font-weight:600">${esc(w.city)}</div><div class="t">${Math.round(w.temp)}°C</div><div>${esc(w.cond || '')}</div><div style="opacity:.8;font-size:13px;margin-top:6px">${w.hum != null ? '💧 Humidity ' + w.hum + '%' : ''}${w.wind != null ? ' · 🌬 ' + w.wind + ' km/h' : ''}</div></div>`).join('') || '<div class="meta">Weather readings will appear here.</div>'}</div>
   ${latest ? `<p class="meta">Updated ${timeAgo(latest)}.</p>` : ''}
   ${H2('Climate & environment news')}<div class="cards">${d.items.map(card).join('') || '<div class="meta">No stories yet.</div>'}</div></div>`;
}
async function viewContributors() {
  const list = await GET('/api/contributors');
  return `<div class="wrap" style="padding-block:24px">${H2('Top contributors')}
   <p class="meta" style="margin-top:-6px">Score = views ÷ 10 + approved comments × 3 + (average review stars × number of reviews) × 2. Tiers: Bronze, Silver (50+), Gold (150+), Platinum (400+).</p>
   <div class="lb">${list.map((r, i) => `<div class="lbc"><span class="rk">#${i + 1}</span><div style="display:flex;gap:10px;align-items:center">${avatar(r.name, r.color)}<div><b>${esc(r.name)}</b><div class="meta">${ROLE_NAMES[r.role] || ''}</div></div></div>
    <div style="display:flex;align-items:flex-end;gap:10px;margin-top:12px"><span class="score">${r.score}</span><span class="meta">points</span><span class="sp"></span>${tierBadge(r.tier)}</div>
    <div class="mini"><div><b>${r.stories}</b><span>Stories</span></div><div><b>${r.views.toLocaleString()}</b><span>Views</span></div><div><b>${r.comments}</b><span>Comments</span></div><div><b>${r.avg ? r.avg.toFixed(1) : '–'}</b><span>Rating</span></div></div>
    ${r.bio ? `<p class="meta" style="margin:10px 0 0">${esc(r.bio)}</p>` : ''}</div>`).join('') || '<div class="empty panel">Rankings appear once stories are published.</div>'}</div></div>`;
}
const viewSearch = q => q ? viewList(`Search: “${esc(q)}”`, 'q=' + encodeURIComponent(q)) : viewHome();
function viewLogin() {
  if (me()) { go('/dashboard', true); return ''; }
  return `<div class="auth"><form class="panel" data-form="login"><h2>Newsroom sign-in</h2><p class="meta">For administrators, editors and contributors.</p>
   <label>Email</label><input name="email" type="email" required autocomplete="email"><label>Password</label><input name="password" type="password" required autocomplete="current-password">
   <div id="formErr"></div><button class="btn pri" style="margin-top:16px;width:100%;justify-content:center">Sign in</button>
   <p class="meta" style="text-align:center;margin-bottom:0">Want to write for us? <a href="/write-for-us" style="color:var(--accent);font-weight:600">Apply as a contributor</a></p></form></div>`;
}
function viewApply() {
  return `<div class="auth"><form class="panel" data-form="apply"><h2>Write for Engineeria Africa</h2><p class="meta">Engineers, students and researchers are welcome. Your application is reviewed by our admin before you can publish.</p>
   <label>Full name</label><input name="name" required maxlength="80"><label>Email</label><input name="email" type="email" required>
   <label>Password (8+ characters)</label><input name="password" type="password" minlength="8" required autocomplete="new-password">
   <label>About you</label><textarea name="bio" maxlength="300" placeholder="e.g. Structural engineer in Enugu, 6 years in bridge design" style="min-height:80px"></textarea>
   <div id="formErr"></div><button class="btn pri" style="margin-top:16px;width:100%;justify-content:center">Submit application</button></form></div>`;
}
function viewAdvertise() {
  return `<div class="wrap" style="padding-block:24px;max-width:760px">${H2('Advertise with Engineeria Africa')}
   <div class="panel prose" style="font-size:17px"><p>Reach engineers, contractors, students and decision-makers across Africa.</p>
   <p><b>Placements:</b> top banner on the homepage, sidebar on every page, and in-article adverts inside stories. Every advert reports impressions and clicks.</p>
   <p>To book a campaign, contact the Engineeria Africa team.</p></div></div>`;
}
const notFound = () => `<div class="wrap empty panel" style="margin-top:24px"><h3>Page not found</h3><p>The story may have been moved or unpublished.</p><a class="btn pri" href="/">Back to home</a></div>`;

/* ================= DASHBOARD ================= */
async function viewDash() {
  const u = me(); if (!u) { go('/login', true); return ''; }
  const r = u.role;
  if (staff()) { try { S.counts = await GET('/api/admin/counts'); } catch { S.counts = {}; } }
  const c = S.counts;
  const tabs = r === 'admin' ? [['overview', 'Overview'], ['queue', 'Approvals', c.queue], ['articles', 'All articles'], ['comments', 'Comments', c.comments], ['users', 'Users & roles', c.applicants], ['ads', 'Advertising'], ['events', 'Events'], ['weather', 'Weather & climate'], ['breaking', 'Breaking news'], ['settings', 'Settings'], ['mine', 'My articles'], ['account', 'My account']]
    : r === 'eic' ? [['queue', 'Review queue', c.queue], ['articles', 'All articles'], ['comments', 'Comments', c.comments], ['breaking', 'Breaking news'], ['events', 'Events'], ['mine', 'My articles'], ['account', 'My account']]
      : [['mine', 'My articles'], ['rating', 'My rating'], ['account', 'My account']];
  if (!tabs.some(t => t[0] === S.dashTab)) S.dashTab = tabs[0][0];
  const T = { overview: tabOverview, queue: tabQueue, articles: tabArticles, comments: tabComments, users: tabUsers, ads: tabAds, events: tabEvents, weather: tabWeather, breaking: tabBreaking, settings: tabSettings, mine: tabMine, rating: tabRating, account: tabAccount };
  let content; try { content = await T[S.dashTab](); } catch (e) { content = `<div class="err">${esc(e.message)}</div>`; }
  const msg = S.msg ? `<div class="okbox">${S.msg}</div>` : ''; S.msg = '';
  return `<div class="wrap dash"><aside class="side"><div class="who">${avatar(u.name, u.color)}<div><b>${esc(u.name)}</b><br><span class="meta">${ROLE_NAMES[r]}</span></div></div>
   ${tabs.map(([k, l, n]) => `<a class="${k === S.dashTab ? 'on' : ''}" data-act="tab" data-id="${k}" href="#">${l}${n ? `<span class="badge">${n}</span>` : ''}</a>`).join('')}
   <a href="/write" style="background:var(--accent);color:#fff;margin-top:8px;text-align:center">+ New article</a></aside><section>${msg}${content}</section></div>`;
}
async function tabOverview() {
  const o = await GET('/api/admin/overview');
  const stats = [[o.published, 'Published stories'], [o.views.toLocaleString(), 'Total views'], [o.awaiting, 'Awaiting approval'], [o.pendingComments, 'Comments to moderate'], [o.contributors, 'Active contributors'], [o.applicants, 'Contributor applications'], [o.impressions.toLocaleString(), 'Ad impressions'], [o.clicks, 'Ad clicks'], [o.subscribers, 'Alert subscribers']];
  return H2('Overview') + `<div class="stats">${stats.map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('')}</div>
   ${H2('Contributor ranking')}<div class="tw"><table class="tbl"><tr><th>#</th><th>Contributor</th><th>Stories</th><th>Views</th><th>Comments</th><th>Avg rating</th><th>Score</th></tr>
   ${o.ranking.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)} ${tierBadge(r.tier)}</td><td>${r.stories}</td><td>${r.views.toLocaleString()}</td><td>${r.comments}</td><td>${r.avg ? r.avg.toFixed(1) + ' ★' : '–'}</td><td><b>${r.score}</b></td></tr>`).join('') || '<tr><td colspan="7" class="empty">No published stories yet.</td></tr>'}</table></div>`;
}
async function tabQueue() {
  const list = await GET('/api/admin/queue'), flow = S.boot.settings.flow, r = role();
  const canPub = r === 'admin' || flow === 'eic';
  return H2(r === 'admin' ? 'Approvals' : 'Review queue') + `<p class="meta">Publishing flow: <b>${flow === 'eic' ? 'Editor-in-Chief approves and publishes' : 'Editor-in-Chief approves, then Admin publishes'}</b>${r === 'admin' ? ' (change in Settings)' : ''}.</p>` +
    (list.length ? list.map(a => `<div class="qcard"><img src="${coverOf(a)}" alt=""><div>
     <span class="pill s-${a.status}">${a.status === 'approved' ? 'EIC approved' : 'Submitted'}</span> <span class="cat" style="color:${cat(a.category).color}">${cat(a.category).name}</span>
     <h3 style="margin:6px 0 4px;font-size:18px">${esc(a.title)}</h3><div class="meta">By ${esc(a.authorName)} · submitted ${timeAgo(a.submittedAt)} · ${a.readTime} min${a.video ? ' · ▶ video' : ''}${a.audio ? ' · 🎙 audio' : ''}</div>
     <p style="margin:8px 0;font-size:14px">${esc(a.excerpt)}</p>
     <div class="btns" style="margin:8px 0"><label class="ck" style="margin:0"><input type="checkbox" id="feat-${a.id}" ${a.featured ? 'checked' : ''}> Feature on homepage</label><label class="ck" style="margin:0"><input type="checkbox" id="brk-${a.id}" ${a.breaking ? 'checked' : ''}> Flash as breaking news</label></div>
     <input id="note-${a.id}" placeholder="Note to the contributor (used when requesting changes or rejecting)">
     <div class="btns" style="margin-top:10px">${canPub ? `<button class="btn ok sm" data-act="artAct" data-do="publish" data-id="${a.id}">✓ Approve & publish</button>` : `<button class="btn ok sm" data-act="artAct" data-do="approve" data-id="${a.id}">✓ Approve → send to Admin</button>`}
     <a class="btn sm" href="/article/${a.slug}">Preview</a><a class="btn sm" href="/write/${a.id}">Edit</a>
     <button class="btn sm" data-act="artAct" data-do="changes" data-id="${a.id}">↺ Request changes</button><button class="btn sm no" data-act="artAct" data-do="reject" data-id="${a.id}">✕ Reject</button></div></div></div>`).join('') : `<div class="empty panel">Nothing waiting for review. 🎉</div>`);
}
async function tabArticles() {
  const list = await GET('/api/admin/articles?status=' + S.artFilter), r = role(), canPub = r === 'admin' || S.boot.settings.flow === 'eic';
  const sts = ['all', 'published', 'submitted', 'approved', 'changes', 'draft', 'rejected', 'unpublished'];
  return H2('All articles') + `<div class="btns" style="margin-bottom:12px">${sts.map(s => `<button class="btn sm ${S.artFilter === s ? 'dk' : ''}" data-act="filter" data-id="${s}">${s}</button>`).join('')}</div>
   <div class="tw"><table class="tbl"><tr><th>Story</th><th>Author</th><th>Status</th><th>Views</th><th>Actions</th></tr>
   ${list.map(a => `<tr><td><a href="/article/${a.slug}" style="font-weight:600">${esc(a.title)}</a><div class="meta">${cat(a.category).name}${a.featured ? ' · ⭐ Featured' : ''}${a.breaking ? ' · 🔴 Breaking' : ''}</div></td><td>${esc(a.authorName)}</td><td><span class="pill s-${a.status}">${a.status}</span></td><td>${a.views.toLocaleString()}</td>
   <td><div class="btns"><a class="btn sm" href="/write/${a.id}">Edit</a>
   ${a.status === 'published' ? `<button class="btn sm" data-act="artAct" data-do="unpublish" data-id="${a.id}">Unpublish</button><button class="btn sm" data-act="artAct" data-do="feature" data-id="${a.id}">${a.featured ? 'Unfeature' : 'Feature'}</button>` : canPub && a.status !== 'draft' ? `<button class="btn sm ok" data-act="artAct" data-do="publish" data-id="${a.id}">Publish</button>` : ''}
   ${r === 'admin' ? `<button class="btn sm no" data-act="artDel" data-id="${a.id}">${S.confirmKey === 'del' + a.id ? 'Confirm delete?' : 'Delete'}</button>` : ''}</div></td></tr>`).join('') || '<tr><td colspan="5" class="empty">No articles.</td></tr>'}</table></div>`;
}
async function tabComments() {
  const list = await GET('/api/admin/comments');
  return H2('Comment moderation') + `<div class="tw"><table class="tbl"><tr><th>Comment</th><th>On story</th><th>Status</th><th>Actions</th></tr>
   ${list.map(c => `<tr><td><b>${esc(c.name)}</b> ${c.stars ? `<span class="stars">${starStr(c.stars)}</span>` : ''}<div>${inline(c.text)}</div><div class="meta">${timeAgo(c.created_at)}</div></td><td><a href="/article/${c.article_slug}">${esc(c.article_title)}</a></td><td><span class="pill s-${c.status === 'approved' ? 'published' : c.status}">${c.status}</span></td>
   <td><div class="btns">${c.status !== 'approved' ? `<button class="btn sm ok" data-act="cm" data-st="approved" data-id="${c.id}">Approve</button>` : ''}${c.status !== 'rejected' ? `<button class="btn sm" data-act="cm" data-st="rejected" data-id="${c.id}">Reject</button>` : ''}<button class="btn sm no" data-act="cmDel" data-id="${c.id}">Delete</button></div></td></tr>`).join('') || '<tr><td colspan="4" class="empty">No comments yet.</td></tr>'}</table></div>`;
}
async function tabUsers() {
  const list = await GET('/api/admin/users');
  return H2('Users & roles') + `<div class="tw"><table class="tbl"><tr><th>Name</th><th>Role</th><th>Status</th><th>Score</th><th>Actions</th></tr>
   ${list.map(u => { const self = u.id === me().id; return `<tr><td><div style="display:flex;gap:8px;align-items:center">${avatar(u.name, u.color)}<div><b>${esc(u.name)}</b><div class="meta">${esc(u.email)}</div>${u.bio ? `<div class="meta">${esc(u.bio)}</div>` : ''}</div></div></td>
   <td><select data-ch="userRole" data-id="${u.id}" ${self ? 'disabled' : ''}>${['contributor', 'eic', 'admin'].map(x => `<option value="${x}" ${u.role === x ? 'selected' : ''}>${ROLE_NAMES[x]}</option>`).join('')}</select></td>
   <td><span class="pill ${u.status === 'active' ? 's-published' : u.status === 'pending' ? 's-pending' : 's-rejected'}">${u.status === 'pending' ? 'applied' : u.status}</span></td><td>${u.score}</td>
   <td>${self ? '<span class="meta">You</span>' : `<div class="btns">${u.status === 'pending' ? `<button class="btn sm ok" data-act="userSt" data-st="active" data-id="${u.id}">Approve</button><button class="btn sm no" data-act="userDel" data-id="${u.id}">Decline</button>` : u.status === 'active' ? `<button class="btn sm no" data-act="userSt" data-st="suspended" data-id="${u.id}">Suspend</button>` : `<button class="btn sm" data-act="userSt" data-st="active" data-id="${u.id}">Reactivate</button>`}
    <button class="btn sm" data-act="userReset" data-id="${u.id}">Reset password</button></div>`}</td></tr>`; }).join('')}</table></div>
   ${H2('Add a team member')}<form class="panel" data-form="user"><div class="grid2"><div><label style="margin-top:0">Full name</label><input name="name" required></div><div><label style="margin-top:0">Email</label><input name="email" type="email" required></div></div>
   <div class="grid2"><div><label>Role</label><select name="role"><option value="contributor">Contributor</option><option value="eic">Editor-in-Chief</option><option value="admin">Administrator</option></select></div><div><label>Short bio</label><input name="bio" placeholder="e.g. Water resources engineer, Abuja"></div></div>
   <p class="hint">A temporary password is shown after you add them — share it privately; they can change it under My account.</p><button class="btn pri">Add user</button></form>`;
}
async function tabAds() {
  const list = await GET('/api/admin/ads');
  const where = { top: 'Top banner', sidebar: 'Sidebar', inline: 'In-article' };
  return H2('Advertising') + `<div class="tw"><table class="tbl"><tr><th>Advert</th><th>Placement</th><th>Impressions</th><th>Clicks</th><th>CTR</th><th></th></tr>
   ${list.map(a => `<tr><td><b>${esc(a.title)}</b><div class="meta">${esc(a.advertiser)}${a.ends_on ? ' · ends ' + a.ends_on : ''}${a.link ? ` · <a href="${esc(a.link)}" target="_blank" rel="noopener">${esc(a.link)}</a>` : ''}</div></td><td>${where[a.placement]}</td><td>${a.impressions.toLocaleString()}</td><td>${a.clicks}</td><td>${a.impressions ? (a.clicks / a.impressions * 100).toFixed(1) + '%' : '–'}</td>
   <td><div class="btns"><button class="btn sm ${a.active ? '' : 'ok'}" data-act="adToggle" data-on="${a.active ? 0 : 1}" data-id="${a.id}">${a.active ? 'Pause' : 'Activate'}</button><button class="btn sm no" data-act="adDel" data-id="${a.id}">Delete</button></div></td></tr>`).join('') || '<tr><td colspan="6" class="empty">No adverts yet.</td></tr>'}</table></div>
   ${H2('New advert')}<form class="panel" data-form="ad"><div class="grid2"><div><label style="margin-top:0">Advertiser</label><input name="advertiser" required></div><div><label style="margin-top:0">Placement</label><select name="placement"><option value="top">Top banner (homepage)</option><option value="sidebar">Sidebar (all pages)</option><option value="inline">In-article</option></select></div></div>
   <label>Headline</label><input name="title" required maxlength="120"><label>Supporting text</label><input name="text" maxlength="200">
   <div class="grid2"><div><label>Destination link</label><input name="link" type="url" placeholder="https://"></div><div><label>Campaign end date (optional)</label><input name="endsOn" type="date"></div></div>
   <div class="grid2"><div><label>Brand colour</label><input name="color" type="color" value="#f26a1b" style="height:42px"></div><div><label>Banner image (optional)</label><input type="file" accept="image/*" data-up="adimg"><input type="hidden" name="image" id="adimgUrl"><div class="prev" id="adimgPrev"></div></div></div>
   <div style="margin-top:14px"><button class="btn pri">Create advert</button></div></form>`;
}
async function tabEvents() {
  const list = await GET('/api/events');
  return H2('Events') + `<div class="tw"><table class="tbl"><tr><th>Date</th><th>Event</th><th>Location</th><th></th></tr>${list.map(e => `<tr><td>${e.date}</td><td><b>${esc(e.title)}</b><div class="meta">${esc(e.description)}</div></td><td>${esc(e.location)}</td><td><button class="btn sm no" data-act="evDel" data-id="${e.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="4" class="empty">No events yet.</td></tr>'}</table></div>
   ${H2('Add event')}<form class="panel" data-form="event"><label style="margin-top:0">Event title</label><input name="title" required><div class="grid2"><div><label>Date</label><input type="date" name="date" required></div><div><label>Location</label><input name="location" required placeholder="City, Country or Online"></div></div><label>Short description</label><input name="description"><label>Registration / details link</label><input name="link" type="url" placeholder="https://"><div style="margin-top:12px"><button class="btn pri">Add event</button></div></form>`;
}
async function tabWeather() {
  const d = await GET('/api/admin/weather');
  S.wxRows = d.cities;
  return H2('Weather & climate') + `<form class="panel" data-form="weather">
   <p class="meta" style="margin-top:0">${d.live ? '✓ Live weather is on — temperatures refresh every 30 minutes for cities with latitude and longitude.' : 'Live weather is off (no OpenWeatherMap key in .env), so type the readings yourself.'}</p>
   <div class="tw"><table class="tbl" id="wxTable"><tr><th>City</th><th>Lat</th><th>Lon</th><th>°C</th><th>Condition</th><th>Hum %</th><th>Wind km/h</th><th></th></tr>${d.cities.map(wxRow).join('')}</table></div>
   <button type="button" class="btn sm" data-act="wxAdd" style="margin-top:10px">+ Add city</button>
   <label>Climate alerts (one per line — start a line with ! to mark it as a warning)</label><textarea name="alerts">${esc(d.alerts.map(a => (a.level === 'warning' ? '!' : '') + a.text).join('\n'))}</textarea>
   <div style="margin-top:12px"><button class="btn pri">Save weather</button></div></form>`;
}
const wxRow = (w = {}) => `<tr class="wxrow"><td><input data-k="city" value="${esc(w.city || '')}"></td><td><input data-k="lat" value="${w.lat ?? ''}" style="width:80px"></td><td><input data-k="lon" value="${w.lon ?? ''}" style="width:80px"></td><td><input data-k="temp" type="number" value="${w.temp ?? ''}" style="width:70px"></td><td><select data-k="cond">${Object.keys(WX_ICON).map(k => `<option ${w.cond === k ? 'selected' : ''}>${k}</option>`).join('')}</select></td><td><input data-k="hum" type="number" value="${w.hum ?? ''}" style="width:70px"></td><td><input data-k="wind" type="number" value="${w.wind ?? ''}" style="width:70px"></td><td><button type="button" class="btn sm no" data-act="wxDel">✕</button></td></tr>`;
async function tabBreaking() {
  const b = S.boot.breaking;
  const pub = await GET('/api/articles?limit=30');
  return H2('Breaking news flash') + `<div class="panel">${b.active ? `<div class="alert warning"><b>LIVE</b><span>${esc(b.text)}</span></div><button class="btn no" data-act="brkOff">Stop breaking news</button>` : '<p class="meta" style="margin:0">No breaking news is live. The header shows the scrolling “Latest” ticker instead.</p>'}</div>
   <form class="panel" data-form="breaking"><label style="margin-top:0">Breaking headline</label><input name="text" required maxlength="160" placeholder="e.g. Bridge closed after structural alert on…">
   <label>Link to story (optional)</label><select name="articleId"><option value="">— none —</option>${pub.items.map(a => `<option value="${a.id}">${esc(a.title)}</option>`).join('')}</select>
   <p class="hint">Going live shows a red flash banner with an alert chime to everyone reading, and sends a push notification to phones and computers that turned on alerts.</p>
   <div class="btns" style="margin-top:12px"><button class="btn pri" style="background:var(--red);border-color:var(--red)">🔴 Go live</button><button type="button" class="btn" data-act="playAlert">🔊 Preview alert sound</button></div></form>`;
}
async function tabSettings() {
  const s = S.boot.settings;
  return H2('Settings') + `<form class="panel" data-form="settings"><label style="margin-top:0">Tagline</label><input name="tagline" value="${esc(s.tagline)}">
   <label>Publishing flow</label><select name="flow"><option value="eic" ${s.flow === 'eic' ? 'selected' : ''}>Contributor → Editor-in-Chief publishes</option><option value="eic+admin" ${s.flow !== 'eic' ? 'selected' : ''}>Contributor → Editor-in-Chief approves → Admin publishes</option></select>
   <label class="ck"><input type="checkbox" name="moderate" ${s.moderate ? 'checked' : ''}> Hold reader comments for moderation before they appear</label>
   <div style="margin-top:12px"><button class="btn pri">Save settings</button></div></form>`;
}
async function tabMine() {
  const list = await GET('/api/my/articles');
  return H2('My articles') + `<div class="tw"><table class="tbl"><tr><th>Story</th><th>Status</th><th>Views</th><th>Comments</th><th>Rating</th><th></th></tr>
   ${list.map(a => { const editable = staff() || ['draft', 'changes', 'rejected'].includes(a.status); return `<tr><td><a href="/article/${a.slug}" style="font-weight:600">${esc(a.title)}</a><div class="meta">${cat(a.category).name} · ${timeAgo(a.createdAt)}</div>${a.editorNote && a.status !== 'published' ? `<div class="note" style="margin:6px 0 0">Editor: ${esc(a.editorNote)}</div>` : ''}</td><td><span class="pill s-${a.status}">${a.status === 'changes' ? 'changes requested' : a.status}</span></td><td>${a.views.toLocaleString()}</td><td>${a.comments}</td><td>${a.ratingN ? a.rating.toFixed(1) + ' ★' : '–'}</td>
   <td>${editable ? `<a class="btn sm" href="/write/${a.id}">Edit</a>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">You have not written anything yet. Click “+ New article”.</td></tr>'}</table></div>`;
}
async function tabRating() {
  const s = await GET('/api/my/stats');
  const tiers = [[50, 'Silver'], [150, 'Gold'], [400, 'Platinum']], next = tiers.find(t => t[0] > s.score);
  return H2('My rating') + `<div class="panel" style="display:flex;gap:24px;flex-wrap:wrap;align-items:center"><div><span class="score">${s.score}</span> <span class="meta">points</span><div style="margin-top:6px">${tierBadge(s.tier)} ${s.rank ? `<span class="meta">Rank #${s.rank} of ${s.of}</span>` : ''}</div>${next ? `<div class="meta" style="margin-top:6px">${next[0] - s.score} points to ${next[1]}</div>` : ''}</div>
   <div class="mini" style="flex:1;min-width:260px;margin:0"><div><b>${s.stories}</b><span>Published</span></div><div><b>${s.views.toLocaleString()}</b><span>Views</span></div><div><b>${s.comments}</b><span>Comments</span></div><div><b>${s.avg ? s.avg.toFixed(1) : '–'}</b><span>Avg ★ (${s.reviews})</span></div></div></div>
   <p class="meta">Score = views ÷ 10 + approved comments × 3 + (average review stars × number of reviews) × 2. Only approved comments count.</p>`;
}
async function tabAccount() {
  const u = me();
  return H2('My account') + `<form class="panel" data-form="profile"><label style="margin-top:0">Display name</label><input name="name" value="${esc(u.name)}" required><label>Short bio (shown on the leaderboard)</label><input name="bio" value="${esc(u.bio || '')}" maxlength="300"><div style="margin-top:12px"><button class="btn pri">Save profile</button></div></form>
   <form class="panel" data-form="password"><h3>Change password</h3><label>Current password</label><input name="current" type="password" required autocomplete="current-password"><label>New password (8+ characters)</label><input name="next" type="password" minlength="8" required autocomplete="new-password"><div style="margin-top:12px"><button class="btn pri">Change password</button> <button type="button" class="btn" data-act="logout">Sign out</button></div></form>`;
}

/* ================= ARTICLE EDITOR ================= */
async function viewWrite(id) {
  if (!me()) { go('/login', true); return ''; }
  if (!S.editing || S.editing._key !== (id || 'new')) {
    if (id) {
      let a; try { a = await GET('/api/articles-by-id/' + id); } catch { return notFound(); }
      if (!staff() && !['draft', 'changes', 'rejected'].includes(a.status)) return `<div class="wrap empty panel" style="margin-top:24px">This story is ${a.status} and locked for editing. Contact the Editor-in-Chief for corrections.</div>`;
      S.editing = { ...a, videoFile: a.video?.type === 'file' ? a.video.src : null, videoLink: a.video?.type === 'link' ? a.video.src : '', _key: id };
    } else S.editing = { title: '', excerpt: '', body: '', category: 'civil', tags: '', cover: null, audio: null, videoFile: null, videoLink: '', _key: 'new' };
  }
  const e = S.editing, isNew = !e.id, isStaff = staff(), live = e.status === 'published';
  return `<div class="wrap" style="padding-block:24px;max-width:880px"><div class="crumb"><a href="/dashboard">Dashboard</a> › ${isNew ? 'New article' : 'Edit article'}</div>
   ${e.editorNote && e.status === 'changes' ? `<div class="note"><b>Editor's note:</b> ${esc(e.editorNote)}</div>` : ''}
   <form class="panel" data-form="article">
    <label style="margin-top:0">Headline</label><input name="title" required maxlength="160" value="${esc(e.title)}" placeholder="Clear, specific headline">
    <div class="grid2"><div><label>Section</label><select name="category">${S.boot.cats.map(c => `<option value="${c.id}" ${e.category === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div><div><label>Tags (comma separated)</label><input name="tags" value="${esc(e.tags)}" placeholder="roads, geotechnics"></div></div>
    <label>Summary / standfirst</label><input name="excerpt" required maxlength="300" value="${esc(e.excerpt)}">
    <label>Story</label><textarea name="body" required style="min-height:300px" placeholder="Separate paragraphs with a blank line. Use ## for a sub-heading, > for a quote and **bold** for emphasis.">${esc(e.body)}</textarea>
    <div class="hint">Formatting: blank line = new paragraph · ## Sub-heading · > Quote · **bold**</div>
    ${H2('Media')}
    <label style="margin-top:0">Featured image (JPG/PNG/WebP, up to 8 MB)</label><input type="file" accept="image/*" data-up="cover"><div class="prev" id="coverPrev">${prevHTML('cover')}</div>
    <label>Video — paste a YouTube / Vimeo link</label><input name="videoLink" type="url" placeholder="https://www.youtube.com/watch?v=…" value="${esc(e.videoLink || '')}">
    <label>…or upload a video file (MP4/WebM, up to 250 MB)</label><input type="file" accept="video/mp4,video/webm,video/quicktime" data-up="videoFile"><div class="prev" id="videoFilePrev">${prevHTML('videoFile')}</div>
    <label>Audio report (optional — e.g. a recorded voice version, up to 40 MB)</label><input type="file" accept="audio/*" data-up="audio"><div class="prev" id="audioPrev">${prevHTML('audio')}</div>
    <div class="hint">Every published story also gets a “Listen” button that reads it aloud automatically.</div>
    <div id="formErr"></div>
    <div class="btns" style="margin-top:20px;border-top:1px solid var(--line);padding-top:16px">
     ${isStaff ? (live ? `<button class="btn pri" name="go" value="save">Save changes</button>` : `<button class="btn pri" name="go" value="publish">${role() === 'eic' && S.boot.settings.flow !== 'eic' ? 'Approve → send to Admin' : 'Publish now'}</button><button class="btn" name="go" value="draft">Save draft</button>${!isNew && e.status !== 'draft' ? `<button class="btn" name="go" value="save">Save without publishing</button>` : ''}`)
      : `<button class="btn pri" name="go" value="submit">Submit for review</button><button class="btn" name="go" value="draft">Save draft</button>`}
     <a class="btn" href="/dashboard" data-act="cancelEdit">Cancel</a></div>
   </form></div>`;
}
function prevHTML(k) {
  const v = S.editing[k]; if (!v) return k === 'cover' ? '<span class="hint">No image — a branded engineering graphic will be used.</span>' : '';
  const rm = `<button type="button" class="btn sm no" data-act="rmMedia" data-id="${k}" style="margin-top:6px">Remove</button>`;
  if (k === 'cover') return `<img src="${esc(v)}" alt="">${rm}`;
  if (k === 'videoFile') return `<video src="${esc(v)}" controls preload="metadata"></video>${rm}`;
  if (k === 'audio') return `<audio controls src="${esc(v)}"></audio>${rm}`;
  return '';
}

/* ================= ROUTER ================= */
function go(path, replace) {
  if (replace) history.replaceState(null, '', path); else history.pushState(null, '', path);
  route();
}
async function route(opts = {}) {
  const id = ++S.routeId, path = location.pathname.replace(/\/+$/, '') || '/', q = new URLSearchParams(location.search);
  if (S.speaking) { speechSynthesis.cancel(); S.speaking = null; }
  if (!path.startsWith('/write')) S.editing = null;
  S.confirmKey = null; S.current = null; S.shownAds = [];
  document.title = 'Engineeria Africa — Engineering News & Magazine';
  renderTop();
  const main = $('#main');
  if (!opts.silent) main.innerHTML = '<div class="loading">Loading…</div>';
  let html, m;
  try {
    if (path === '/') html = await viewHome();
    else if ((m = path.match(/^\/section\/([\w-]+)$/))) html = await viewSection(m[1]);
    else if ((m = path.match(/^\/article\/([\w-]+)$/))) html = await viewArticle(m[1]);
    else if (path === '/search') html = await viewSearch(q.get('q') || '');
    else if (path === '/weather') html = await viewWeather();
    else if (path === '/contributors') html = await viewContributors();
    else if (path === '/login') html = viewLogin();
    else if (path === '/write-for-us') html = viewApply();
    else if (path === '/advertise') html = viewAdvertise();
    else if (path === '/dashboard') html = await viewDash();
    else if (path === '/write') html = await viewWrite(null);
    else if ((m = path.match(/^\/write\/(\d+)$/))) html = await viewWrite(m[1]);
    else html = notFound();
  } catch (e) {
    html = `<div class="wrap empty panel" style="margin-top:24px"><h3>${navigator.onLine ? 'Something went wrong' : 'You are offline'}</h3><p>${esc(e.message)}</p><button class="btn pri" data-act="retry">Try again</button></div>`;
  }
  if (id !== S.routeId || html === '') return;
  main.innerHTML = html;
  renderTop(); // ticker may have loaded
  flushAds();
  if (path.startsWith('/article/')) afterArticle();
}
async function refreshMain() { const y = scrollY; await route({ silent: true }); scrollTo(0, y); }

/* ================= ACTIONS ================= */
async function reloadBoot() { S.boot = await GET('/api/boot'); }
const ACT = {
  retry: () => route(),
  dark() { P.dark = !P.dark; savePrefs(); document.body.classList.toggle('dark', P.dark); renderTop(); },
  async alerts() {
    P.sound = !P.sound; savePrefs(); renderTop();
    if (P.sound) { chime(); await subscribePush(); toast('Breaking-news alerts on'); }
    else { await unsubscribePush(); toast('Breaking-news alerts off'); }
  },
  install() {
    if (S.installEvt) { S.installEvt.prompt(); S.installEvt.userChoice.finally(() => { S.installEvt = null; renderTop(); }); return; }
    $('#tip').innerHTML = `<div class="install-tip"><b>Install Engineeria Africa</b><p style="margin:6px 0 0;font-size:14px">On iPhone or iPad: tap the <b>Share</b> button <span style="font-size:18px">⇪</span> in Safari, then <b>Add to Home Screen</b>.</p><button class="btn sm" data-act="closeTip">Got it</button></div>`;
  },
  closeTip() { $('#tip').innerHTML = ''; },
  async logout() { await POST('/api/auth/logout'); await reloadBoot(); S.dashTab = null; go('/'); toast('Signed out'); },
  bulletin() { const items = S.ticker || []; speak('Engineeria Africa news bulletin. ' + items.slice(0, 5).map((a, i) => `Story ${i + 1}. ${a.title}. ${a.excerpt}`).join(' ') + ' That is the bulletin. Read more on Engineeria Africa.', 'bulletin'); },
  listen(id) { const a = S.current; if (!a) return; speak(`${a.title}. By ${a.authorName}. ${a.body.replace(/^## |^> /gm, '').replace(/\*\*/g, '')}`, String(id)); },
  async copy(slug) { const url = location.origin + '/article/' + slug; try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { toast(url); } },
  nativeShare(slug) { const a = S.current; navigator.share({ title: a?.title, text: a?.excerpt, url: location.origin + '/article/' + slug }).catch(() => { }); },
  playAlert() { chime(true); },
  closeFlash() { P.seenBreaking = S.boot.breaking.id; savePrefs(); renderFlash(); },
  async more(_, el) {
    const off = +el.dataset.off, d = await GET(`/api/articles?limit=12&offset=${off}&${el.dataset.q}`);
    $('#list').insertAdjacentHTML('beforeend', d.items.map(card).join(''));
    if (d.more) el.dataset.off = off + 12; else el.parentElement.remove();
  },
  tab(id) { S.dashTab = id; S.confirmKey = null; route().then(() => scrollTo(0, 0)); },
  filter(id) { S.artFilter = id; refreshMain(); },
  async artAct(id, el) {
    const act = el.dataset.do;
    const body = { action: act, note: $('#note-' + id)?.value || '' };
    const f = $('#feat-' + id), b = $('#brk-' + id); if (f) body.featured = f.checked; if (b) body.breaking = b.checked;
    await POST(`/api/admin/articles/${id}/action`, body);
    toast({ publish: 'Published ✓', approve: 'Approved — sent to Admin', changes: 'Sent back to the contributor', reject: 'Rejected', unpublish: 'Unpublished', feature: 'Homepage feature updated' }[act]);
    if (body.breaking && act === 'publish') { await reloadBoot(); chime(); renderFlash(); }
    S.sidebar = null; refreshMain();
  },
  async artDel(id) {
    if (S.confirmKey !== 'del' + id) { S.confirmKey = 'del' + id; const b = $(`[data-act=artDel][data-id="${id}"]`); if (b) b.textContent = 'Confirm delete?'; return; }
    await DEL('/api/admin/articles/' + id); S.confirmKey = null; toast('Deleted'); refreshMain();
  },
  async cm(id, el) { await PUT('/api/admin/comments/' + id, { status: el.dataset.st }); refreshMain(); },
  async cmDel(id) { await DEL('/api/admin/comments/' + id); refreshMain(); },
  async userSt(id, el) { await PUT('/api/admin/users/' + id, { status: el.dataset.st }); toast(el.dataset.st === 'active' ? 'Account active' : 'Account suspended'); refreshMain(); },
  async userDel(id) { await DEL('/api/admin/users/' + id); toast('Application declined'); refreshMain(); },
  async userReset(id) { const r = await PUT('/api/admin/users/' + id, { resetPassword: true }); S.msg = `Temporary password: <b style="font-family:monospace;font-size:16px">${esc(r.tempPassword)}</b> — share it privately; they should change it under My account.`; refreshMain(); },
  async adToggle(id, el) { await PUT('/api/admin/ads/' + id, { active: el.dataset.on === '1' }); S.ads = await GET('/api/ads'); refreshMain(); },
  async adDel(id) { await DEL('/api/admin/ads/' + id); S.ads = await GET('/api/ads'); refreshMain(); },
  async evDel(id) { await DEL('/api/admin/events/' + id); S.sidebar = null; refreshMain(); },
  wxAdd() { $('#wxTable').insertAdjacentHTML('beforeend', wxRow()); },
  wxDel(_, el) { el.closest('tr').remove(); },
  async brkOff() { await DEL('/api/admin/breaking'); await reloadBoot(); renderFlash(); toast('Breaking news stopped'); refreshMain(); },
  rmMedia(k) { S.editing[k] = null; $('#' + k + 'Prev').innerHTML = prevHTML(k); },
  cancelEdit() { S.editing = null; },
};
const FORM = {
  search(fd) { const q = String(fd.get('q') || '').trim(); if (q) go('/search?q=' + encodeURIComponent(q)); },
  async login(fd) { await POST('/api/auth/login', { email: fd.get('email'), password: fd.get('password') }); await reloadBoot(); S.dashTab = null; go('/dashboard'); toast('Welcome, ' + me().name); },
  async apply(fd, f) { await POST('/api/auth/apply', Object.fromEntries(fd)); f.outerHTML = `<div class="panel"><div class="okbox">✓ Application received. The Engineeria Africa admin will review it — once approved you can sign in with your email and password.</div><a class="btn" href="/">Back to the news</a></div>`; },
  async comment(fd, f) {
    const r = await POST(`/api/articles/${f.dataset.id}/comments`, Object.fromEntries(fd));
    toast(r.pending ? 'Thanks! Your comment will appear after moderation.' : 'Comment posted');
    if (r.pending) f.reset(); else refreshMain();
  },
  async article(fd, f, sub) {
    const e = S.editing, action = sub?.value || 'draft';
    const body = { title: fd.get('title'), excerpt: fd.get('excerpt'), body: fd.get('body'), category: fd.get('category'), tags: fd.get('tags'), videoLink: fd.get('videoLink'), cover: e.cover, audio: e.audio, videoFile: e.videoFile, action };
    const r = e.id ? await PUT('/api/articles/' + e.id, body) : await POST('/api/articles', body);
    S.editing = null; S.sidebar = null;
    S.dashTab = role() === 'contributor' ? 'mine' : (staff() ? 'articles' : null);
    toast({ draft: 'Draft saved', submit: 'Submitted to the Editor-in-Chief', publish: r.status === 'published' ? 'Published ✓' : 'Approved — awaiting Admin', save: 'Changes saved' }[action]);
    if (r.status === 'published') await reloadBoot();
    go('/dashboard');
  },
  async user(fd, f) { const r = await POST('/api/admin/users', Object.fromEntries(fd)); S.msg = `✓ ${esc(fd.get('name'))} added. Temporary password: <b style="font-family:monospace;font-size:16px">${esc(r.tempPassword)}</b> — share it privately; they can sign in at /login and change it.`; refreshMain(); },
  async ad(fd) { await POST('/api/admin/ads', Object.fromEntries(fd)); S.ads = await GET('/api/ads'); toast('Advert created and live'); refreshMain(); },
  async event(fd) { await POST('/api/admin/events', Object.fromEntries(fd)); S.sidebar = null; toast('Event added'); refreshMain(); },
  async weather(fd, f) {
    const cities = [...f.querySelectorAll('.wxrow')].map(tr => Object.fromEntries([...tr.querySelectorAll('[data-k]')].map(i => [i.dataset.k, i.value])));
    const alerts = String(fd.get('alerts') || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => l.startsWith('!') ? { level: 'warning', text: l.slice(1).trim() } : { level: 'info', text: l });
    await PUT('/api/admin/weather', { cities, alerts }); await reloadBoot(); toast('Weather updated'); refreshMain();
  },
  async breaking(fd) { await POST('/api/admin/breaking', { text: fd.get('text'), articleId: fd.get('articleId') || null }); await reloadBoot(); chime(); renderFlash(); toast('Breaking news is live'); refreshMain(); },
  async settings(fd) { await PUT('/api/admin/settings', { tagline: fd.get('tagline'), flow: fd.get('flow'), moderate: !!fd.get('moderate') }); await reloadBoot(); toast('Settings saved'); refreshMain(); },
  async profile(fd) { await PUT('/api/me', Object.fromEntries(fd)); await reloadBoot(); toast('Profile saved'); refreshMain(); },
  async password(fd, f) { await POST('/api/auth/password', Object.fromEntries(fd)); f.reset(); toast('Password changed'); },
};

/* ---------------- uploads in forms ---------------- */
async function onUpload(input) {
  const k = input.dataset.up, file = input.files[0]; if (!file) return;
  const kind = k === 'cover' || k === 'adimg' ? 'image' : k === 'videoFile' ? 'video' : 'audio';
  const prev = $('#' + k + 'Prev');
  prev.innerHTML = `<div class="hint">Uploading ${esc(file.name)}…</div><div class="progress"><i></i></div>`;
  input.disabled = true;
  try {
    const url = await uploadFile(file, kind, p => { const bar = prev.querySelector('.progress i'); if (bar) bar.style.width = Math.round(p * 100) + '%'; });
    if (k === 'adimg') { $('#adimgUrl').value = url; prev.innerHTML = `<img src="${esc(url)}" alt="">`; }
    else {
      S.editing[k] = url; prev.innerHTML = prevHTML(k);
      if (k === 'videoFile') { const l = document.querySelector('[name=videoLink]'); if (l) l.value = ''; }
    }
  } catch (e) { prev.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  input.disabled = false; input.value = '';
}

/* ---------------- push notifications ---------------- */
const urlB64 = b => { const p = '='.repeat((4 - b.length % 4) % 4), s = atob((b + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...s].map(c => c.charCodeAt(0))); };
async function subscribePush() {
  try {
    if (!S.boot.vapidKey || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const perm = await Notification.requestPermission(); if (perm !== 'granted') return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(S.boot.vapidKey) });
    await POST('/api/push/subscribe', sub.toJSON());
  } catch (e) { console.warn('push', e); }
}
async function unsubscribePush() {
  try { const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription(); if (sub) { await POST('/api/push/unsubscribe', { endpoint: sub.endpoint }); await sub.unsubscribe(); } } catch { }
}
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone;

/* ---------------- wiring ---------------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el) {
    const isNavLink = el.tagName === 'A' && el.getAttribute('href') && el.getAttribute('href') !== '#';
    if (!isNavLink) e.preventDefault();
    Promise.resolve(ACT[el.dataset.act]?.(el.dataset.id, el, e)).catch(err => toast(err.message));
    if (!isNavLink) return;
  }
  const a = e.target.closest('a');
  if (!a || e.defaultPrevented || a.target || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin || /^\/(go|uploads|api)\//.test(u.pathname) || /\.(xml|txt)$/.test(u.pathname)) return;
  e.preventDefault();
  if (u.pathname + u.search !== location.pathname + location.search) { go(u.pathname + u.search); scrollTo(0, 0); }
});
document.addEventListener('submit', async e => {
  const f = e.target.closest('[data-form]'); if (!f) return;
  e.preventDefault();
  const btns = [...f.querySelectorAll('button')]; btns.forEach(b => b.disabled = true);
  const err = f.querySelector('#formErr'); if (err) err.innerHTML = '';
  try { await FORM[f.dataset.form](new FormData(f), f, e.submitter); }
  catch (x) { if (err) err.innerHTML = `<div class="err">${esc(x.message)}</div>`; else toast(x.message); }
  btns.forEach(b => b.disabled = false);
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset.up) return onUpload(t);
  if (t.dataset.ch === 'userRole') { try { await PUT('/api/admin/users/' + t.dataset.id, { role: t.value }); toast('Role updated'); } catch (x) { toast(x.message); } }
});
window.addEventListener('popstate', () => route());
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; renderTop(); });
window.addEventListener('appinstalled', () => { S.installEvt = null; renderTop(); toast('Engineeria Africa installed'); });
// play the chime on first interaction if a breaking story is live and unseen (browsers block sound before a tap)
document.addEventListener('pointerdown', () => { const b = S.boot?.breaking; if (b?.active && S.chimed !== b.id && P.seenBreaking !== b.id) { S.chimed = b.id; chime(); } }, { capture: true });

async function pollBreaking() {
  try {
    const prev = S.boot.breaking?.id; const d = await GET('/api/boot');
    S.boot.breaking = d.breaking; S.boot.weather = d.weather;
    if (d.breaking.active && d.breaking.id !== prev) { S.chimed = d.breaking.id; chime(); }
    if (d.breaking.id !== prev || (!d.breaking.active && prev)) { renderTop(); renderFlash(); }
  } catch { }
}

(async function start() {
  document.body.classList.toggle('dark', P.dark);
  try { [S.boot, S.ads] = await Promise.all([GET('/api/boot'), GET('/api/ads').catch(() => [])]); }
  catch { $('#main').innerHTML = '<div class="wrap empty panel" style="margin-top:24px"><h3>Cannot reach Engineeria Africa</h3><p>Check your internet connection and try again.</p><a class="btn pri" href="/" target="_self">Reload</a></div>'; return; }
  renderFoot(); renderFlash();
  await route();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { });
  setInterval(pollBreaking, 45000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pollBreaking(); });
})();
