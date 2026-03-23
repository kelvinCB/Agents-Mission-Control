module.exports = {
  apps: [
    {
      name: 'agents-mission-control-api',
      cwd: '/home/kelvin/.openclaw/workspace/Agents-Mission-Control',
      script: 'backend/dist/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        CORS_ORIGINS: 'https://kelvin-control.site,https://www.kelvin-control.site,https://app.kelvin-control.site',
        ENABLE_GOOGLE_CALENDAR_MODULE: 'true',
        GOOGLE_CALENDAR_SCRIPT: '/home/kelvin/.clawdbot/workspace/scripts/google-calendar/gcal.js'
      }
    }
  ]
};
