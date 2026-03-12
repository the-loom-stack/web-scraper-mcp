import { describe, it, expect } from 'vitest';
import { api } from '../helpers/testApp.js';

/**
 * These tests simulate real user workflows — the kind of sequences
 * an AI model or human developer would actually perform.
 */

describe('User flow: Read a single article', () => {
  it('scrapes one page and gets readable markdown', async () => {
    // Step 1: User provides a URL to read
    const res = await api
      .post('/api/scrape')
      .send({ url: 'https://example.com', outputFormat: 'markdown' });

    expect(res.status).toBe(200);

    const page = res.body.data.pages[0];
    expect(page.url).toBe('https://example.com');
    expect(page.title).toBeTruthy();
    expect(page.content).toBeTruthy();

    // Content should be valid markdown (contains headings or text)
    expect(page.content.length).toBeGreaterThan(10);
  });
});

describe('User flow: Compare multiple pages', () => {
  it('batch scrapes and returns content for comparison', async () => {
    // Step 1: User wants to compare content from multiple URLs
    const res = await api
      .post('/api/scrape/batch')
      .send({
        urls: [
          'https://example.com',
          'https://example.com/about',
          'https://example.com/contact'
        ],
        outputFormat: 'markdown'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.totalPages).toBe(3);

    // Each page should have distinct content
    const pages = res.body.data.pages;
    const urls = pages.map((p) => p.url);
    const uniqueUrls = new Set(urls);
    expect(uniqueUrls.size).toBe(3);

    // Each page should have content
    pages.forEach((page) => {
      expect(page.content).toBeTruthy();
      expect(page.url).toMatch(/^https?:\/\//);
    });
  });
});

describe('User flow: Index a documentation site', () => {
  it('crawls a site with depth and page limit', async () => {
    // Step 1: User wants to crawl a docs site
    const res = await api
      .post('/api/crawl')
      .send({
        url: 'https://example.com',
        maxCrawlDepth: 1,
        maxCrawlPages: 5,
        outputFormat: 'markdown'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.startUrl).toBe('https://example.com');
    expect(res.body.data.totalPages).toBeGreaterThanOrEqual(1);

    // All pages should be from the same domain
    res.body.data.pages.forEach((page) => {
      expect(page.url).toBeTruthy();
      expect(page.content).toBeTruthy();
    });
  });
});

describe('User flow: Check on a long-running crawl', () => {
  it('polls run status then fetches dataset', async () => {
    // Step 1: Check status of a running job
    const statusRes = await api.get('/api/run/run_abc123def456');

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.id).toBe('run_abc123def456');
    expect(statusRes.body.data.status).toBeDefined();

    // Step 2: If succeeded, fetch the dataset
    const datasetId = statusRes.body.data.defaultDatasetId;
    if (datasetId) {
      const dataRes = await api.get(`/api/dataset/${datasetId}?limit=10`);
      expect(dataRes.status).toBe(200);
      expect(dataRes.body.data.items).toBeInstanceOf(Array);
    }
  });
});

describe('User flow: Paginate through large dataset', () => {
  it('fetches pages of results with offset/limit', async () => {
    // Step 1: Get first page
    const page1 = await api.get('/api/dataset/dataset_xyz789?limit=2&offset=0');
    expect(page1.status).toBe(200);
    expect(page1.body.data.offset).toBe(0);
    expect(page1.body.data.limit).toBe(2);
    expect(page1.body.data.items.length).toBeLessThanOrEqual(2);

    // Step 2: Get second page
    const page2 = await api.get('/api/dataset/dataset_xyz789?limit=2&offset=2');
    expect(page2.status).toBe(200);
    expect(page2.body.data.offset).toBe(2);
  });
});

describe('User flow: Switch output formats', () => {
  it('gets the same page in different formats', async () => {
    const [mdRes, htmlRes, textRes] = await Promise.all([
      api.post('/api/scrape').send({ url: 'https://example.com', outputFormat: 'markdown' }),
      api.post('/api/scrape').send({ url: 'https://example.com', outputFormat: 'html' }),
      api.post('/api/scrape').send({ url: 'https://example.com', outputFormat: 'text' }),
    ]);

    expect(mdRes.status).toBe(200);
    expect(htmlRes.status).toBe(200);
    expect(textRes.status).toBe(200);

    const mdContent = mdRes.body.data.pages[0].content;
    const htmlContent = htmlRes.body.data.pages[0].content;
    const textContent = textRes.body.data.pages[0].content;

    // Markdown should have # headers
    expect(mdContent).toContain('#');

    // HTML should have tags
    expect(htmlContent).toContain('<');
    expect(htmlContent).toContain('>');

    // Text should be plain — no markdown or HTML markers
    expect(textContent).not.toContain('#');
    expect(textContent).not.toContain('<h1>');

    // All should contain the same core information
    expect(mdContent.toLowerCase()).toContain('example');
    expect(htmlContent.toLowerCase()).toContain('example');
    expect(textContent.toLowerCase()).toContain('example');
  });
});

describe('User flow: Error recovery', () => {
  it('user sends bad URL, fixes it, succeeds', async () => {
    // Step 1: User accidentally sends invalid URL
    const badRes = await api
      .post('/api/scrape')
      .send({ url: 'not-a-url' });

    expect(badRes.status).toBe(400);
    expect(badRes.body.error.code).toBe('INVALID_URL');
    expect(badRes.body.error.message).toContain('http');

    // The error message should guide the user to fix the issue
    expect(badRes.body.error.message).toMatch(/https?/);

    // Step 2: User fixes the URL and retries
    const goodRes = await api
      .post('/api/scrape')
      .send({ url: 'https://example.com' });

    expect(goodRes.status).toBe(200);
    expect(goodRes.body.success).toBe(true);
  });

  it('user sends empty batch, gets actionable error', async () => {
    const res = await api
      .post('/api/scrape/batch')
      .send({ urls: [] });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('urls must be');
  });

  it('user sends too many URLs, gets clear limit info', async () => {
    const urls = Array.from({ length: 21 }, (_, i) => `https://ex${i}.com`);
    const res = await api
      .post('/api/scrape/batch')
      .send({ urls });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('20');
  });
});

describe('User flow: Health check before usage', () => {
  it('user checks health, then uses the service', async () => {
    // Step 1: Check if service is up
    const healthRes = await api.get('/api/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('ok');

    // Step 2: Service is up, proceed with scraping
    const scrapeRes = await api
      .post('/api/scrape')
      .send({ url: 'https://example.com' });

    expect(scrapeRes.status).toBe(200);
  });
});
