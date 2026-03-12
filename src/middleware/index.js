'use strict';

const express = require('express');
const morgan = require('morgan');
const security = require('./security');
const requestId = require('./requestId');
const rateLimiter = require('./rateLimiter');
const errorHandler = require('./errorHandler');

function applyMiddleware(app) {
  // Security headers first
  security.forEach((mw) => app.use(mw));

  // Request ID before anything else that touches req
  app.use(requestId);

  // Logging
  app.use(morgan('combined'));

  // Body parsing — 50kb covers worst-case MCP requests (20 long URLs + metadata)
  app.use(express.json({ limit: '50kb' }));
  app.use(express.urlencoded({ extended: false, limit: '50kb' }));

  // Rate limiting on both REST API and MCP endpoint
  app.use('/api', rateLimiter);
  app.use('/mcp', rateLimiter);

  return errorHandler;
}

module.exports = applyMiddleware;
