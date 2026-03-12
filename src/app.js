'use strict';

const express = require('express');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const applyMiddleware = require('./middleware');
const mountRoutes = require('./routes');
const { createMcpServer } = require('./mcp/createServer.js');

const app = express();

// Apply all middleware, get error handler back
const errorHandler = applyMiddleware(app);

// Mount REST API routes
mountRoutes(app);

// MCP over HTTP (Streamable HTTP transport) — stateless, one server instance per request.
// This is the endpoint Apify Standby exposes to AI clients.
// Note: req.body already parsed by global express.json() middleware, so no need to parse again.
app.post('/mcp', async (req, res) => {
  try {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('finish', () => server.close().catch(() => {}));
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'MCP request failed' });
    }
  }
});

// Global error handler (must be after routes)
app.use(errorHandler);

module.exports = app;
