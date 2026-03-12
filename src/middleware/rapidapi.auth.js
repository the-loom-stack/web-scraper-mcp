'use strict';

const crypto = require('crypto');
const AppError = require('../errors/AppError');
const config = require('../config');

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function rapidApiAuth(req, res, next) {
  // Allow skip during tests and development
  if (config.isTest || config.isDevelopment) {
    return next();
  }

  // 1. Check RapidAPI secret (for RapidAPI users)
  const secret = req.headers['x-rapidapi-proxy-secret'];
  if (secret && config.rapidapiProxySecret && timingSafeEqual(secret, config.rapidapiProxySecret)) {
    return next();
  }

  // 2. Check Apify Auth (for Apify platform users)
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const apifyToken = config.apify.apiToken;

  if (token && apifyToken && timingSafeEqual(token, apifyToken)) {
    return next();
  }

  // 3. Optional: if running in Standby, Apify might already handle proxy-level auth
  // But for a REST API, it's safer to require the token.

  return next(new AppError('UNAUTHORIZED', 'Missing or invalid authentication credentials', 401));
}

module.exports = rapidApiAuth;
