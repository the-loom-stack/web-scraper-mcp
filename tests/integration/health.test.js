import { describe, it, expect } from 'vitest';
import { api } from '../helpers/testApp.js';

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await api.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.uptime).toBeGreaterThan(0);
    expect(res.body.timestamp).toBeGreaterThan(0);
  });
});
