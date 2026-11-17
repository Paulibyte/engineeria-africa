#!/usr/bin/env bash
# Pull the latest code and restart — run on the VPS from /var/www/engineeria
set -e
cd "$(dirname "$0")/.."
git pull
npm ci --omit=dev
pm2 restart engineeria
pm2 save
echo "✓ Engineeria Africa updated"
