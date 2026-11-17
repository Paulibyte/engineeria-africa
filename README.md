# Engineeria Africa

Africa's engineering news & magazine. It's an installable web app (PWA) for phones, tablets and computers.

**Readers** get:
- engineering news by section, with search
- featured images, video (uploaded, YouTube or Vimeo) and audio reports
- read-aloud of any story and a headline bulletin
- sharing to Facebook, X, WhatsApp, LinkedIn and Telegram
- comments with star reviews
- events calendar, plus weather and climate alerts
- a breaking-news flash with sound, and push notifications
- dark mode and offline reading

**Newsroom**, by role:
- **Contributors** apply, write, upload media, submit for review, and see their rating and rank.
- **Editor-in-Chief** reviews the queue: approve and publish, request changes, reject, feature, or flash as breaking. Also moderates comments and manages events.
- **Admin** can do everything above, plus manage users and roles, moderate comments, run adverts (with view and click counts), update weather and climate, and change settings, including whether publishing needs a second approval from the Admin.

**Contributor score:** views ÷ 10 + approved comments × 3 + (average stars × number of reviews) × 2. Tiers are Bronze, Silver (50+), Gold (150+) and Platinum (400+).

**Stack:** Node.js + Express, SQLite (single file, no separate database server), and plain JavaScript on the front end (no build step). Runs under PM2 behind Nginx.

To deploy, see **DEPLOY.md**.

Run locally:
```bash
npm install && npm run setup
# edit .env: NODE_ENV=development, SITE_URL=http://localhost:4100, ADMIN_EMAIL, ADMIN_PASSWORD
npm start   # http://localhost:4100
```
