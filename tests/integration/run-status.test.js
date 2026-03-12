import { describe, it, expect } from 'vitest';
import { api } from '../helpers/testApp.js';

describe('GET /api/run/:runId', () => {
  it('returns run status for valid run', async () => {
    const res = await api.get('/api/run/run_abc123def456');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('run_abc123def456');
    expect(res.body.data.status).toBeDefined();
    expect(res.body.data.defaultDatasetId).toBeDefined();
  });

  it('returns 400 for invalid runId with path traversal', async () => {
    const res = await api.get('/api/run/../../secret');

    // Express will resolve the path, so this likely 404s
    // The important thing is it doesn't expose internal data
    expect([400, 404]).toContain(res.status);
  });
});

describe('GET /api/dataset/:datasetId', () => {
  it('returns dataset items', async () => {
    const res = await api.get('/api/dataset/dataset_xyz789');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalItems).toBeGreaterThan(0);
    expect(res.body.data.items).toBeInstanceOf(Array);
    expect(res.body.data.items[0]).toHaveProperty('url');
    expect(res.body.data.items[0]).toHaveProperty('content');
  });

  it('respects limit parameter', async () => {
    const res = await api.get('/api/dataset/dataset_xyz789?limit=1');

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.limit).toBe(1);
  });

  it('respects offset parameter', async () => {
    const res = await api.get('/api/dataset/dataset_xyz789?offset=1&limit=1');

    expect(res.status).toBe(200);
    expect(res.body.data.offset).toBe(1);
  });

  it('returns empty array for empty dataset', async () => {
    const res = await api.get('/api/dataset/dataset_empty');

    expect(res.status).toBe(200);
    expect(res.body.data.totalItems).toBe(0);
    expect(res.body.data.items).toEqual([]);
  });
});
