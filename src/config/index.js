'use strict';

const nodeEnv = process.env.NODE_ENV || 'development';

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isDevelopment: nodeEnv === 'development',
  isTest: nodeEnv === 'test',
  rapidapiProxySecret: process.env.RAPIDAPI_PROXY_SECRET || '',
  rateLimit: {
    windowMs: 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 30
  },
  apify: {
    // Getter so tests can set APIFY_API_TOKEN after module load.
    // APIFY_TOKEN is auto-injected by the Apify platform; APIFY_API_TOKEN is for local dev.
    get apiToken() { return process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN || ''; },
    baseUrl: 'https://api.apify.com/v2',
    defaultActorId: 'apify~website-content-crawler',
    requestTimeoutMs: 310000,
    pollIntervalMs: 3000,
    maxPollTimeMs: 600000,
    maxContentLength: 50000,
    // Apify proxy costs extra credits. Enable only when needed (e.g. sites blocking datacenter IPs).
    useProxy: process.env.APIFY_USE_PROXY === 'true'
  }
};
