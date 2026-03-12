/**
 * Simulates a real AI model using every MCP tool, end-to-end.
 * Uses vitest's infrastructure to get MSW working correctly.
 * Run with: npx vitest run tests/live-sim.mjs
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

const api = request(app);
const problems = [];

function record(msg) { problems.push(msg); }

describe('=== LIVE MCP SIMULATION ===', () => {

  // ── Tool 1: scrape_url ──
  describe('Tool: scrape_url', () => {
    it('scrapes a page and returns usable markdown', async () => {
      const res = await api.post('/api/scrape').send({
        url: 'https://example.com',
        outputFormat: 'markdown'
      });

      expect(res.status).toBe(200);
      const page = res.body.data.pages[0];

      // An AI needs these three fields to be useful
      expect(typeof page.url).toBe('string');
      expect(page.url.length).toBeGreaterThan(0);
      expect(typeof page.title).toBe('string');
      expect(typeof page.content).toBe('string');
      expect(page.content.length).toBeGreaterThan(10);

      // Content should actually be markdown, not HTML or empty
      // (our mock returns markdown with # headers)
      console.log(`    → Got ${page.content.length} chars, title: "${page.title}"`);
    });

    it('returns HTML when requested', async () => {
      const res = await api.post('/api/scrape').send({
        url: 'https://example.com',
        outputFormat: 'html'
      });

      expect(res.status).toBe(200);
      expect(res.body.data.pages[0].content).toContain('<');
    });

    it('returns plain text when requested', async () => {
      const res = await api.post('/api/scrape').send({
        url: 'https://example.com',
        outputFormat: 'text'
      });

      expect(res.status).toBe(200);
      const content = res.body.data.pages[0].content;
      expect(content).not.toContain('<h1>');
      expect(content).not.toContain('# ');
    });

    it('gives clear error for missing URL', async () => {
      const res = await api.post('/api/scrape').send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_URL');
      expect(res.body.error.message).toBeTruthy();
      console.log(`    → Error message AI sees: "${res.body.error.message}"`);
    });

    it('gives clear error for invalid URL', async () => {
      const res = await api.post('/api/scrape').send({ url: 'not-a-url' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_URL');
      // Message should hint at the fix
      expect(res.body.error.message).toMatch(/http/i);
    });
  });

  // ── Tool 2: scrape_urls ──
  describe('Tool: scrape_urls', () => {
    it('returns distinct content for each URL', async () => {
      const res = await api.post('/api/scrape/batch').send({
        urls: ['https://example.com', 'https://example.com/about', 'https://example.com/contact']
      });

      expect(res.status).toBe(200);
      expect(res.body.data.totalPages).toBe(3);

      // Verify each page is distinct and has content
      const pages = res.body.data.pages;
      const urls = pages.map(p => p.url);
      expect(new Set(urls).size).toBe(3);

      pages.forEach(p => {
        expect(p.content.length).toBeGreaterThan(0);
      });

      console.log(`    → ${pages.length} pages: ${urls.join(', ')}`);
    });

    it('rejects empty array with actionable error', async () => {
      const res = await api.post('/api/scrape/batch').send({ urls: [] });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('urls must be');
    });

    it('rejects >20 URLs with clear limit', async () => {
      const urls = Array.from({ length: 21 }, (_, i) => `https://ex${i}.com`);
      const res = await api.post('/api/scrape/batch').send({ urls });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('20');
    });
  });

  // ── Tool 3: crawl_site ──
  describe('Tool: crawl_site', () => {
    it('crawls and returns pages with startUrl in response', async () => {
      const res = await api.post('/api/crawl').send({
        url: 'https://example.com',
        maxCrawlDepth: 1,
        maxCrawlPages: 5
      });

      expect(res.status).toBe(200);
      expect(res.body.data.startUrl).toBe('https://example.com');
      expect(res.body.data.totalPages).toBeGreaterThanOrEqual(1);
      expect(res.body.data.pages[0].content.length).toBeGreaterThan(0);

      console.log(`    → Crawled ${res.body.data.totalPages} pages from ${res.body.data.startUrl}`);
    });
  });

  // ── Tool 4: get_run_status ──
  describe('Tool: get_run_status', () => {
    it('returns all fields AI needs for next step', async () => {
      const res = await api.get('/api/run/run_abc123def456');

      expect(res.status).toBe(200);

      const run = res.body.data;
      // AI MUST have these to continue the workflow
      expect(run.id).toBeTruthy();
      expect(run.status).toBeTruthy();
      expect(run.defaultDatasetId).toBeTruthy();

      console.log(`    → Run ${run.id}: ${run.status}, dataset: ${run.defaultDatasetId}`);
    });

    it('blocks path traversal on runId', async () => {
      const res = await api.get('/api/run/..%2F..%2Fsecret');
      expect(res.status).not.toBe(200);
    });
  });

  // ── Tool 5: get_dataset_items ──
  describe('Tool: get_dataset_items', () => {
    it('returns items with url, title, content', async () => {
      const res = await api.get('/api/dataset/dataset_xyz789');

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThan(0);

      const item = res.body.data.items[0];
      expect(typeof item.url).toBe('string');
      expect(typeof item.title).toBe('string');
      expect(typeof item.content).toBe('string');
      expect(item.content.length).toBeGreaterThan(0);
    });

    it('pagination actually returns different items', async () => {
      const p1 = await api.get('/api/dataset/dataset_xyz789?limit=1&offset=0');
      const p2 = await api.get('/api/dataset/dataset_xyz789?limit=1&offset=1');

      expect(p1.body.data.items[0].url).not.toBe(p2.body.data.items[0].url);
      console.log(`    → Page 1: ${p1.body.data.items[0].url}`);
      console.log(`    → Page 2: ${p2.body.data.items[0].url}`);
    });

    it('empty dataset returns empty array, not error', async () => {
      const res = await api.get('/api/dataset/dataset_empty');
      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.totalItems).toBe(0);
    });
  });

  // ── Cross-tool workflow ──
  describe('Full workflow: get_run_status → get_dataset_items', () => {
    it('chains tools like an AI would', async () => {
      // Step 1: Check run
      const statusRes = await api.get('/api/run/run_abc123def456');
      expect(statusRes.status).toBe(200);

      const datasetId = statusRes.body.data.defaultDatasetId;
      expect(datasetId).toBeTruthy();

      // Step 2: Fetch results using datasetId from step 1
      const dataRes = await api.get(`/api/dataset/${datasetId}?limit=10`);
      expect(dataRes.status).toBe(200);
      expect(dataRes.body.data.items.length).toBeGreaterThan(0);

      console.log(`    → Chained: run status → dataset ${datasetId} → ${dataRes.body.data.items.length} items`);
    });
  });

  // ── Response contract checks ──
  describe('Response contract (what AI models depend on)', () => {
    it('success responses always have {success, data, meta}', async () => {
      const res = await api.post('/api/scrape').send({ url: 'https://example.com' });

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toHaveProperty('requestId');
      expect(res.body.meta).toHaveProperty('processingTimeMs');
      expect(res.body.meta.requestId).toMatch(/^req_/);
    });

    it('error responses always have {success, error: {code, message, status}}', async () => {
      const res = await api.post('/api/scrape').send({});

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.error).toHaveProperty('code');
      expect(res.body.error).toHaveProperty('message');
      expect(res.body.error).toHaveProperty('status');
      expect(typeof res.body.error.code).toBe('string');
      expect(typeof res.body.error.message).toBe('string');
      expect(typeof res.body.error.status).toBe('number');
    });

    it('content is always a string, never undefined or object', async () => {
      const res = await api.post('/api/scrape/batch').send({
        urls: ['https://example.com', 'https://example.com/about']
      });

      res.body.data.pages.forEach((page, i) => {
        expect(typeof page.content).toBe('string');
        expect(typeof page.url).toBe('string');
        expect(typeof page.title).toBe('string');
      });
    });
  });
});
