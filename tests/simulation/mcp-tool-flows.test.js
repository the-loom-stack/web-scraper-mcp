import { describe, it, expect } from 'vitest';

const { validateUrl, validateUrls, validateApifyId } = require('../../src/utils/validators');
const { formatItems } = require('../../src/utils/formatItems');
const apifyService = require('../../src/services/apify.service');

/**
 * These tests simulate how an AI model interacts with the MCP tools:
 * - It calls scrapeUrls, gets raw items, formats them
 * - It checks run status, fetches datasets
 * - It handles errors gracefully
 *
 * This tests the EXACT code path that mcp.js uses.
 */

describe('MCP flow: AI scrapes a single page', () => {
  it('validates input, scrapes, formats — full pipeline', async () => {
    // AI provides a URL
    const url = validateUrl('https://example.com');
    expect(url).toBe('https://example.com');

    // AI calls the scrape service
    const items = await apifyService.scrapeUrls([url], {
      outputFormat: 'markdown',
      crawlerType: 'playwright:firefox',
      maxCrawlDepth: 0,
      maxCrawlPages: 1,
    });

    expect(items).toHaveLength(1);

    // MCP formats the response
    const formatted = formatItems(items, 'markdown');
    expect(formatted).toHaveLength(1);

    const page = formatted[0];
    expect(page).toHaveProperty('url');
    expect(page).toHaveProperty('title');
    expect(page).toHaveProperty('content');
    expect(typeof page.content).toBe('string');
    expect(page.content.length).toBeGreaterThan(0);
  });
});

describe('MCP flow: AI scrapes multiple pages', () => {
  it('validates array, scrapes all, formats correctly', async () => {
    const urls = validateUrls([
      'https://example.com',
      'https://example.com/about'
    ]);

    const items = await apifyService.scrapeUrls(urls, {
      outputFormat: 'markdown',
      maxCrawlDepth: 0,
      maxCrawlPages: urls.length,
    });

    const formatted = formatItems(items, 'markdown');

    // AI receives structured data it can parse
    expect(formatted.length).toBeGreaterThanOrEqual(2);
    formatted.forEach((page) => {
      expect(page.url).toMatch(/^https?:\/\//);
      expect(typeof page.content).toBe('string');
    });
  });
});

describe('MCP flow: AI crawls a site', () => {
  it('crawls with depth and formats all pages', async () => {
    const url = validateUrl('https://example.com');

    const items = await apifyService.scrapeUrls([url], {
      outputFormat: 'markdown',
      maxCrawlDepth: 1,
      maxCrawlPages: 10,
    });

    const formatted = formatItems(items, 'markdown');

    // Response should be JSON-serializable (what MCP returns)
    const serialized = JSON.stringify({ startUrl: url, totalPages: formatted.length, pages: formatted });
    const parsed = JSON.parse(serialized);

    expect(parsed.startUrl).toBe('https://example.com');
    expect(parsed.totalPages).toBeGreaterThanOrEqual(1);
    expect(parsed.pages).toBeInstanceOf(Array);
  });
});

describe('MCP flow: AI checks run status then fetches data', () => {
  it('get_run_status → get_dataset_items pipeline', async () => {
    // Step 1: AI checks run status
    const runId = validateApifyId('run_abc123def456', 'runId');
    const run = await apifyService.getRunStatus(runId);

    expect(run.id).toBeDefined();
    expect(run.defaultDatasetId).toBeDefined();

    // Step 2: AI fetches dataset items
    const datasetId = validateApifyId(run.defaultDatasetId, 'datasetId');
    const items = await apifyService.getDatasetItems(datasetId, {
      limit: 50,
      offset: 0,
    });

    const formatted = formatItems(items, 'markdown');

    // The full response an AI would see
    const response = {
      totalItems: formatted.length,
      offset: 0,
      limit: 50,
      items: formatted,
    };

    expect(response.totalItems).toBeGreaterThan(0);
    expect(response.items[0]).toHaveProperty('url');
    expect(response.items[0]).toHaveProperty('content');
  });
});

describe('MCP flow: AI handles errors', () => {
  it('returns clear error for invalid URL', () => {
    try {
      validateUrl('not-a-url');
      expect.fail('should have thrown');
    } catch (err) {
      // AI sees this error message — it should be actionable
      expect(err.message).toContain('http');
      expect(err.code).toBe('INVALID_URL');

      // Simulate MCP error response
      const errorText = `Error scraping URL: ${err.message}`;
      expect(errorText).toContain('http');
    }
  });

  it('returns clear error for empty URL list', () => {
    try {
      validateUrls([]);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err.message).toContain('urls must be');
      expect(err.code).toBe('MISSING_URLS');
    }
  });

  it('returns clear error for path traversal attempt', () => {
    try {
      validateApifyId('../secret', 'runId');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err.code).toBe('INVALID_RUNID');
      expect(err.message).toContain('invalid characters');
    }
  });

  it('handles non-existent run gracefully', async () => {
    try {
      await apifyService.getRunStatus('run_nonexistent');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err.code).toBeDefined();
      expect(err.message).toBeDefined();
    }
  });

  it('handles failed actor run', async () => {
    try {
      await apifyService.waitForRun('run_failed789');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err.code).toBe('ACTOR_RUN_FAILED');
      expect(err.extras.status).toBe('FAILED');
    }
  });
});

describe('MCP flow: Response serialization', () => {
  it('all responses are valid JSON', async () => {
    const items = await apifyService.scrapeUrls(['https://example.com'], {
      outputFormat: 'markdown',
      maxCrawlPages: 1,
    });

    const formatted = formatItems(items, 'markdown');

    // Test scrape_url response shape
    const singleResponse = JSON.stringify(formatted[0], null, 2);
    const parsedSingle = JSON.parse(singleResponse);
    expect(parsedSingle).toHaveProperty('url');
    expect(parsedSingle).toHaveProperty('title');
    expect(parsedSingle).toHaveProperty('content');

    // Test scrape_urls response shape
    const multiResponse = JSON.stringify({ totalPages: formatted.length, pages: formatted }, null, 2);
    const parsedMulti = JSON.parse(multiResponse);
    expect(parsedMulti).toHaveProperty('totalPages');
    expect(parsedMulti).toHaveProperty('pages');

    // No undefined values (would disappear in JSON)
    expect(singleResponse).not.toContain('undefined');
    expect(multiResponse).not.toContain('undefined');
  });

  it('truncated content includes metadata for AI awareness', async () => {
    // Simulate a very large page
    const hugeItems = [{
      url: 'https://huge.com',
      metadata: { title: 'Huge Page' },
      markdown: 'x'.repeat(60000),
    }];

    const formatted = formatItems(hugeItems, 'markdown');
    const page = formatted[0];

    // AI should see truncation signals
    expect(page.truncated).toBe(true);
    expect(page.originalLength).toBe(60000);
    expect(page.content.length).toBe(50000);

    // Full response should serialize cleanly
    const json = JSON.stringify(page);
    expect(JSON.parse(json).truncated).toBe(true);
  });
});
