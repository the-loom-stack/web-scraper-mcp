'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config');
const AppError = require('../errors/AppError');

const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.isTest ? 10000 : config.rateLimit.max, // effectively unlimited in test
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    const err = new AppError('RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later', 429);
    res.status(429).json({
      success: false,
      error: err.toJSON(),
      meta: { requestId: req.requestId }
    });
  }
});

module.exports = rateLimiter;
