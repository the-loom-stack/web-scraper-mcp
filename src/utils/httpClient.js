'use strict';

const AppError = require('../errors/AppError');

const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404]);
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  const timeoutMs = options.timeoutMs || 30000;
  const method = (options.method || 'GET').toUpperCase();
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Only set Content-Type on requests with a body
    const headers = { ...(options.headers || {}) };
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }

    const requestOptions = {
      ...options,
      signal: controller.signal,
      headers
    };
    delete requestOptions.timeoutMs;

    let response;
    try {
      response = await fetch(url, requestOptions);
      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);

      const isAbort = err && err.name === 'AbortError';
      lastError = new AppError(
        'APIFY_UNAVAILABLE',
        isAbort ? 'Request to Apify timed out' : 'Failed to reach Apify',
        502
      );

      if (attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }
      throw lastError;
    }

    // 408 = Apify sync run exceeded time limit — not retryable, needs async fallback
    if (response.status === 408) {
      const body = await response.json().catch(() => ({}));
      const err = new AppError(
        'SYNC_RUN_TIMEOUT',
        'Actor run exceeded the synchronous time limit (300s)',
        408,
        { runId: body?.data?.id }
      );
      throw err;
    }

    if (NON_RETRYABLE_STATUSES.has(response.status)) {
      const body = await response.text().catch(() => '');
      if (response.status === 401) {
        throw new AppError(
          'AUTH_FAILED',
          'Apify API authentication failed. Your account may be out of credits, or the API token is invalid. Check your Apify account at https://console.apify.com/billing',
          401
        );
      }
      throw new AppError(
        'APIFY_ERROR',
        `Apify returned ${response.status}: ${body.slice(0, 200)}`,
        502
      );
    }

    if (RETRYABLE_STATUSES.has(response.status)) {
      lastError = new AppError('APIFY_UNAVAILABLE', `Apify returned ${response.status}, retrying`, 502);
      if (attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }
      throw lastError;
    }

    if (!response.ok) {
      throw new AppError('APIFY_UNAVAILABLE', `Apify returned unexpected status ${response.status}`, 502);
    }

    return response;
  }

  throw lastError || new AppError('APIFY_UNAVAILABLE', 'Apify request failed after retries', 502);
}

module.exports = { fetchWithRetry, sleep };
