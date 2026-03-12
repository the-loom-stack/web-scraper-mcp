'use strict';

require('dotenv').config();

const app = require('./app');
const config = require('./config');

// Apify injects ACTOR_STANDBY_PORT when running in Standby mode.
// Fall back to config.port for local development.
const port = parseInt(process.env.ACTOR_STANDBY_PORT, 10) || config.port;

const server = app.listen(port, () => {
  console.log(`web-scraper-mcp running on port ${port} [${config.nodeEnv}]`);

  // Write a startup record so Apify's daily auto-test sees a non-empty dataset.
  // Without this the actor gets marked "under maintenance" after 3 test failures.
  if (process.env.APIFY_TOKEN) {
    const { Actor } = require('apify');
    Actor.init().then(() => {
      return Actor.pushData({
        status: 'running',
        startedAt: new Date().toISOString(),
        port,
        mode: process.env.ACTOR_STANDBY_PORT ? 'standby' : 'standard'
      });
    }).catch(() => {});
  }
});

module.exports = server;
