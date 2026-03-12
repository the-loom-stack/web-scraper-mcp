import { describe, it, expect } from 'vitest';
import { api } from '../helpers/testApp.js';

describe('POST /api/scrape', () => {
  it('returns scraped content for valid URL', async () => {
    const res = await api
      .post('/api/scrape')
      .send({ url: 'https://example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.url).toBe('https://example.com');
    expect(res.body.data.totalPages).toBe(1);
    expect(res.body.data.pages).toHaveLength(1);
    expect(res.body.data.pages[0].url).toBe('https://example.com');
    expect(res.body.data.pages[0].title).toBe('Example Domain');
    expect(res.body.data.pages[0].content).toContain('Example Domain');
    expect(res.body.meta.processingTimeMs).toBeGreaterThanOrEqual(0);
    expect(res.body.meta.requestId).toMatch(/^req_/);
  });

  it('returns 400 for missing URL', async () => {
    const res = await api
      .post('/api/scrape')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('MISSING_URL');
  });

  it('returns 400 for invalid URL', async () => {
    const res = await api
      .post('/api/scrape')
      .send({ url: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_URL');
  });

  it('respects outputFormat parameter', async () => {
    const res = await api
      .post('/api/scrape')
      .send({ url: 'https://example.com', outputFormat: 'html' });

    expect(res.status).toBe(200);
    expect(res.body.data.pages[0].content).toContain('<h1>');
  });

  it('respects text outputFormat', async () => {
    const res = await api
      .post('/api/scrape')
      .send({ url: 'https://example.com', outputFormat: 'text' });

    expect(res.status).toBe(200);
    const content = res.body.data.pages[0].content;
    expect(content).not.toContain('#');
    expect(content).not.toContain('<');
  });
});

describe('POST /api/scrape/batch', () => {
  it('returns content for multiple URLs', async () => {
    const res = await api
      .post('/api/scrape/batch')
      .send({
        urls: ['https://example.com', 'https://example.com/about']
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalPages).toBe(2);
    expect(res.body.data.pages).toHaveLength(2);
  });

  it('returns 400 for empty urls array', async () => {
    const res = await api
      .post('/api/scrape/batch')
      .send({ urls: [] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_URLS');
  });

  it('returns 400 for more than 20 URLs', async () => {
    const urls = Array.from({ length: 21 }, (_, i) => `https://example${i}.com`);
    const res = await api
      .post('/api/scrape/batch')
      .send({ urls });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOO_MANY_URLS');
  });
});

describe('POST /api/crawl', () => {
  it('returns crawled pages for valid URL', async () => {
    const res = await api
      .post('/api/crawl')
      .send({ url: 'https://example.com', maxCrawlPages: 3 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.startUrl).toBe('https://example.com');
    expect(res.body.data.totalPages).toBeGreaterThanOrEqual(1);
  });

  it('returns 400 for missing URL', async () => {
    const res = await api
      .post('/api/crawl')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_URL');
  });
});
