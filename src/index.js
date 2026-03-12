'use strict';

require('dotenv').config();

const app = require('./app');
const config = require('./config');

// Apify injects ACTOR_STANDBY_PORT when running in Standby mode.
// Fall back to config.port for local development.
const port = parseInt(process.env.ACTOR_STANDBY_PORT, 10) || config.port;

const server = app.listen(port, () => {
  console.log(`content-toolkit-mcp running on port ${port} [${config.nodeEnv}]`);
});

module.exports = server;
