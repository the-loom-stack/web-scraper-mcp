'use strict';

const config = require('../config');
const { fetchWithRetry, sleep } = require('../utils/httpClient');
const AppError = require('../errors/AppError');

// Read config lazily so test setup.js can set env vars before first call
function cfg() {
  return config.apify;
}

function authHeaders() {
  const token = cfg().apiToken;
  if (!token) {
    throw new AppError('MISSING_API_TOKEN', 'APIFY_API_TOKEN environment variable is not set', 500);
  }
  return { Authorization: `Bearer ${token}` };
}

/**
 * Build the standard actor input for website-content-crawler.
 */
function buildCrawlerInput(urls, options = {}) {
  const crawlerType = options.crawlerType || 'playwright:firefox';
  const maxCrawlPages = options.maxCrawlPages || urls.length;
  const maxCrawlDepth = options.maxCrawlDepth != null ? options.maxCrawlDepth : 0;
  const outputFormat = options.outputFormat || 'markdown';

  const input = {
    startUrls: urls.map((url) => ({ url })),
    crawlerType,
    maxCrawlPages,
    maxCrawlDepth,
    htmlTransformer: 'readableText',
    removeCookieWarnings: true,
    saveMarkdown: outputFormat === 'markdown' || outputFormat === 'all',
    saveHtml: outputFormat === 'html' || outputFormat === 'all',
  };

  // Only enable proxy when explicitly configured — it costs additional credits
  if (cfg().useProxy) {
    input.proxyConfiguration = { useApifyProxy: true };
  }

  return input;
}

/**
 * Run an actor synchronously and return dataset items directly.
 */
async function runActorSync(actorId, input, options = {}) {
  const { baseUrl, defaultActorId, requestTimeoutMs } = cfg();
  const actor = actorId || defaultActorId;
  const queryParams = new URLSearchParams();

  if (options.timeout) queryParams.set('timeout', String(options.timeout));
  if (options.memory) queryParams.set('memory', String(options.memory));
  if (options.maxItems) queryParams.set('maxItems', String(options.maxItems));
  if (options.limit) queryParams.set('limit', String(options.limit));
  if (options.clean) queryParams.set('clean', 'true');

  const qs = queryParams.toString();
  const url = `${baseUrl}/acts/${actor}/run-sync-get-dataset-items${qs ? '?' + qs : ''}`;

  const response = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(input),
      timeoutMs: requestTimeoutMs
    },
    1
  );

  const items = await response.json().catch(() => {
    throw new AppError('APIFY_ERROR', 'Invalid JSON response from Apify sync run', 502);
  });

  return Array.isArray(items) ? items : [];
}

/**
 * Start an actor run asynchronously. Returns the run object.
 */
async function startActorRun(actorId, input, options = {}) {
  const { baseUrl, defaultActorId } = cfg();
  const actor = actorId || defaultActorId;
  const queryParams = new URLSearchParams();

  if (options.timeout) queryParams.set('timeout', String(options.timeout));
  if (options.memory) queryParams.set('memory', String(options.memory));
  if (options.maxItems) queryParams.set('maxItems', String(options.maxItems));
  if (options.build) queryParams.set('build', options.build);

  const qs = queryParams.toString();
  const url = `${baseUrl}/acts/${actor}/runs${qs ? '?' + qs : ''}`;

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
    timeoutMs: 30000
  });

  const body = await response.json().catch(() => {
    throw new AppError('APIFY_ERROR', 'Invalid JSON response from Apify', 502);
  });

  if (!body?.data) {
    throw new AppError('APIFY_ERROR', 'Apify response missing expected data field', 502);
  }

  return body.data;
}

/**
 * Poll a run until it finishes or times out.
 */
async function waitForRun(runId) {
  const { baseUrl, pollIntervalMs, maxPollTimeMs } = cfg();
  const startTime = Date.now();

  while (Date.now() - startTime < maxPollTimeMs) {
    const url = `${baseUrl}/actor-runs/${runId}?waitForFinish=30`;

    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: authHeaders(),
      timeoutMs: 60000
    });

    const body = await response.json().catch(() => {
      throw new AppError('APIFY_ERROR', 'Invalid JSON response when polling run', 502);
    });

    const run = body.data;
    if (!run) {
      throw new AppError('APIFY_ERROR', 'Apify returned empty run data while polling', 502);
    }
    const status = run.status;

    if (status === 'SUCCEEDED') {
      return run;
    }

    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new AppError(
        'ACTOR_RUN_FAILED',
        `Actor run ${status.toLowerCase()}: ${runId}`,
        502,
        { runId, status }
      );
    }

    await sleep(pollIntervalMs);
  }

  throw new AppError('ACTOR_RUN_TIMEOUT', `Actor run did not finish within ${maxPollTimeMs / 1000}s`, 408, { runId });
}

/**
 * Fetch items from a dataset.
 */
async function getDatasetItems(datasetId, options = {}) {
  const { baseUrl } = cfg();
  const queryParams = new URLSearchParams();

  if (options.limit) queryParams.set('limit', String(options.limit));
  if (options.offset) queryParams.set('offset', String(options.offset));
  if (options.fields) queryParams.set('fields', options.fields);
  if (options.clean) queryParams.set('clean', 'true');

  const qs = queryParams.toString();
  const url = `${baseUrl}/datasets/${datasetId}/items${qs ? '?' + qs : ''}`;

  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: authHeaders(),
    timeoutMs: 30000
  });

  const items = await response.json().catch(() => {
    throw new AppError('APIFY_ERROR', 'Invalid JSON response from Apify dataset', 502);
  });

  return Array.isArray(items) ? items : [];
}

/**
 * High-level: scrape URLs and return content.
 * Tries sync endpoint first. If it times out (408), falls back to async polling.
 */
async function scrapeUrls(urls, options = {}) {
  const input = buildCrawlerInput(urls, options);

  try {
    return await runActorSync(null, input, {
      timeout: 300,
      limit: options.maxResults || 100,
      clean: true
    });
  } catch (err) {
    if (err.code === 'SYNC_RUN_TIMEOUT' && err.extras?.runId) {
      const finishedRun = await waitForRun(err.extras.runId);
      return getDatasetItems(finishedRun.defaultDatasetId, {
        limit: options.maxResults || 100,
        clean: true
      });
    }
    throw err;
  }
}

/**
 * Get the status of an existing actor run.
 */
async function getRunStatus(runId) {
  const { baseUrl } = cfg();
  const url = `${baseUrl}/actor-runs/${runId}`;
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: authHeaders(),
    timeoutMs: 15000
  });

  const body = await response.json().catch(() => {
    throw new AppError('APIFY_ERROR', 'Invalid JSON response from Apify', 502);
  });

  if (!body?.data) {
    throw new AppError('APIFY_ERROR', 'Apify response missing run data', 502);
  }

  return body.data;
}

module.exports = {
  runActorSync,
  startActorRun,
  waitForRun,
  getDatasetItems,
  scrapeUrls,
  getRunStatus
};
