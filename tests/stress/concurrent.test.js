import { describe, it, expect } from 'vitest';
import { api } from '../helpers/testApp.js';

describe('Stress: concurrent requests', () => {
  it('handles 10 concurrent scrape requests', async () => {
    const requests = Array.from({ length: 10 }, (_, i) =>
      api.post('/api/scrape').send({ url: `https://example${i}.com` })
    );

    const results = await Promise.all(requests);

    results.forEach((res) => {
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pages).toHaveLength(1);
    });
  });

  it('handles 5 concurrent batch scrape requests', async () => {
    const requests = Array.from({ length: 5 }, (_, batch) =>
      api.post('/api/scrape/batch').send({
        urls: Array.from({ length: 3 }, (_, i) =>
          `https://batch${batch}-page${i}.com`
        )
      })
    );

    const results = await Promise.all(requests);

    results.forEach((res) => {
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalPages).toBe(3);
    });
  });

  it('handles mixed endpoint requests concurrently', async () => {
    const requests = [
      api.get('/api/health'),
      api.post('/api/scrape').send({ url: 'https://example.com' }),
      api.post('/api/scrape/batch').send({ urls: ['https://a.com', 'https://b.com'] }),
      api.post('/api/crawl').send({ url: 'https://example.com', maxCrawlPages: 2 }),
      api.get('/api/dataset/dataset_xyz789'),
      api.get('/api/run/run_abc123def456'),
      api.get('/api/health'),
      api.post('/api/scrape').send({ url: 'https://other.com' }),
    ];

    const results = await Promise.all(requests);

    results.forEach((res) => {
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });
  });
});

describe('Stress: input edge cases', () => {
  it('handles URL with complex query parameters', async () => {
    const res = await api.post('/api/scrape').send({
      url: 'https://example.com/search?q=hello+world&page=1&lang=en&sort=desc&filter[type]=article'
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('handles URL with unicode characters', async () => {
    const res = await api.post('/api/scrape').send({
      url: 'https://example.com/café'
    });

    expect(res.status).toBe(200);
  });

  it('handles maximum URL length (2048 chars)', async () => {
    const url = 'https://example.com/' + 'a'.repeat(2020);
    const res = await api.post('/api/scrape').send({ url });

    expect(res.status).toBe(200);
  });

  it('rejects URL just over maximum length', async () => {
    const url = 'https://example.com/' + 'a'.repeat(2040);
    const res = await api.post('/api/scrape').send({ url });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_URL');
  });

  it('handles exactly 20 URLs in batch (max allowed)', async () => {
    const urls = Array.from({ length: 20 }, (_, i) => `https://example${i}.com`);
    const res = await api.post('/api/scrape/batch').send({ urls });

    expect(res.status).toBe(200);
    expect(res.body.data.totalPages).toBe(20);
  });

  it('handles rapid sequential requests to same endpoint', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await api.post('/api/scrape').send({ url: `https://rapid${i}.com` });
      expect(res.status).toBe(200);
    }
  });
});

describe('Stress: error resilience', () => {
  it('returns proper errors for all invalid inputs without crashing', async () => {
    const badRequests = [
      api.post('/api/scrape').send({}),
      api.post('/api/scrape').send({ url: '' }),
      api.post('/api/scrape').send({ url: 123 }),
      api.post('/api/scrape').send({ url: null }),
      api.post('/api/scrape/batch').send({}),
      api.post('/api/scrape/batch').send({ urls: 'not-array' }),
      api.post('/api/scrape/batch').send({ urls: [123] }),
      api.post('/api/crawl').send({}),
      api.post('/api/crawl').send({ url: '' }),
    ];

    const results = await Promise.all(badRequests);

    results.forEach((res) => {
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBeDefined();
      expect(res.body.error.message).toBeDefined();
    });
  });

  it('server stays alive after errors', async () => {
    // Send bad request
    await api.post('/api/scrape').send({});

    // Server should still work
    const res = await api.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('handles malformed JSON body gracefully', async () => {
    const res = await api
      .post('/api/scrape')
      .type('json')
      .send('{"broken json');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});
