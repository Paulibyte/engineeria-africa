// PM2 process file — start with:  pm2 start ecosystem.config.js
module.exports = {
  apps: [{
    name: 'engineeria',
    script: 'server.js',
    cwd: __dirname,
    instances: 1,            // SQLite: keep a single instance
    autorestart: true,
    max_memory_restart: '400M',
    time: true,
  }],
};
