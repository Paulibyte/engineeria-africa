# Engineeria Africa — deploying to the Hostinger VPS

This puts Engineeria Africa on the same Hostinger VPS as Reseeti, Jobtins and BookVault (187.126.30.245). It runs as its own PM2 process called **engineeria** on port **4100**, in **/var/www/engineeria**, so it doesn't touch the other apps.

Wherever you see **engineeriaafrica.com** below, use the domain you want for the site, for example `engineeria.com`, or a subdomain such as `news.jobtins.com`.

---

## 1. Point the domain at the VPS (Hostinger DNS)

In hPanel → **Domains → DNS / Nameservers** for your domain, add:

| Type | Name | Points to | TTL |
|------|------|-----------|-----|
| A | `@` | `187.126.30.245` | 3600 |
| A | `www` | `187.126.30.245` | 3600 |

For a subdomain, such as `news.jobtins.com`, add one A record with Name `news` instead.

## 2. Put the code on GitHub (from your computer)

Unzip `engineeria-africa.zip`, open a terminal in the folder, then run:

```bash
git init
git add .
git commit -m "Engineeria Africa v1"
git branch -M main
git remote add origin https://github.com/Paulibyte/engineeria-africa.git
git push -u origin main
```

Create the **private** repo `engineeria-africa` on GitHub first.

## 3. Install on the VPS

SSH in (`ssh root@187.126.30.245`), then:

```bash
# check that port 4100 is free (no output = free)
sudo ss -ltnp | grep 4100

cd /var/www
git clone https://github.com/Paulibyte/engineeria-africa.git engineeria
cd engineeria
npm ci --omit=dev
npm run setup          # creates .env with secret keys
nano .env              # fill in the values below, then Ctrl+O, Enter, Ctrl+X
```

In `.env`, set:

```
SITE_URL=https://engineeriaafrica.com
ADMIN_NAME=Your Name
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=a-strong-password
OPENWEATHER_API_KEY=        # optional, see step 7
```

Start it:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 logs engineeria --lines 20     # should show "✓ Admin account created" and "running on …4100"
```

> **Important:** server-specific settings live only in `.env`, which git ignores. Don't edit `package.json` or other tracked files on the VPS. This prevents the `git pull` conflicts you had with Reseeti.

## 4. Nginx + HTTPS

```bash
sudo cp deploy/nginx-engineeria.conf /etc/nginx/sites-available/engineeria
sudo nano /etc/nginx/sites-available/engineeria      # replace engineeriaafrica.com
sudo ln -s /etc/nginx/sites-available/engineeria /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d engineeriaafrica.com -d www.engineeriaafrica.com
```

Open **https://engineeriaafrica.com**. It loads but shows "No stories have been published yet."

## 5. First sign-in

1. Go to **https://engineeriaafrica.com/login** and sign in with the ADMIN_EMAIL and ADMIN_PASSWORD you set.
2. Open **Dashboard → Users & roles** and add your Editor-in-Chief. Copy the temporary password it shows and send it to them privately.
3. Contributors apply at **/write-for-us**. You approve them under **Users & roles**.
4. Once signed in, remove `ADMIN_PASSWORD` from `.env`. It's only used the first time the app starts.

## 6. Installing the app on phones and computers

The site is an installable app (PWA). It needs HTTPS, which step 4 sets up.

- **Android (Chrome):** tap **⬇ Install app** in the top bar, or use the menu → *Install app*.
- **Windows / Mac (Chrome or Edge):** click **⬇ Install app**, or the install icon in the address bar. It then opens in its own window and shows up in the Start menu or Dock.
- **iPhone / iPad (Safari):** tap Share → **Add to Home Screen**.

**Breaking-news alerts:** readers tap **🔔 Alerts** and allow notifications. When you go live with breaking news, their phone or computer gets a push notification, even when the app is closed. On iPhone, this only works after the app has been added to the Home Screen (iOS 16.4 or later).

## 7. Live weather (optional)

1. Create a free account at **openweathermap.org** and copy your API key.
2. Put it in `.env` as `OPENWEATHER_API_KEY=…`, then run `pm2 restart engineeria`.
3. Weather for every city with a latitude and longitude (Dashboard → Weather & climate) then updates every 30 minutes. Without a key, admins type the readings in by hand.

## 8. Daily backups

```bash
crontab -e
# add this line (runs at 2:30 am every day):
30 2 * * * cd /var/www/engineeria && /usr/bin/node scripts/backup.js >> backups.log 2>&1
```

Backups go to `/var/www/engineeria/backups` (database plus uploads, last 14 days). Now and then, copy them off the server too.

## 9. Updating later

```bash
cd /var/www/engineeria && ./scripts/update.sh
```

## Where things are kept

| What | Where |
|------|-------|
| Database (articles, users, comments, ads…) | `data/engineeria.db` |
| Uploaded images, video, audio | `uploads/` |
| Settings and secret keys | `.env` |
| Logs | `pm2 logs engineeria` |

None of these go into git, so a `git pull` never overwrites your content.
