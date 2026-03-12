'use strict';

const { v4: uuidv4 } = require('uuid');

function requestId(req, res, next) {
  req.requestId = `req_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  res.setHeader('X-Request-ID', req.requestId);
  next();
}

module.exports = requestId;
