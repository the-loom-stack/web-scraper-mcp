'use strict';

const helmet = require('helmet');
const cors = require('cors');

// MCP clients are diverse: Claude Desktop (null origin), Cursor, VS Code extensions,
// web-based tools (claude.ai). CORS restrictions break legitimate callers.
// Actual security comes from the Apify token, not from origin filtering.
const corsOptions = { origin: true, optionsSuccessStatus: 200 };

const helmetMiddleware = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'no-referrer' }
});

module.exports = [
  helmetMiddleware,
  cors(corsOptions),
  (req, res, next) => {
    res.removeHeader('X-Powered-By');
    next();
  }
];
