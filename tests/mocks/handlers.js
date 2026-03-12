import { http, HttpResponse } from 'msw';
import datasetItems from './fixtures/dataset-items.json';
import runSucceeded from './fixtures/run-succeeded.json';
import runRunning from './fixtures/run-running.json';
import runFailed from './fixtures/run-failed.json';

const BASE = 'https://api.apify.com/v2';

// Track how many times polling has been called per runId
const pollCounts = new Map();

export function resetPollCounts() {
  pollCounts.clear();
}

export const handlers = [
  // ── Sync run: returns dataset items directly ──
  http.post(`${BASE}/acts/:actorId/run-sync-get-dataset-items`, async ({ request, params }) => {
    const auth = request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const urls = (body.startUrls || []).map((u) => u.url);

    // Simulate 408 timeout for special test URL
    if (urls.some((u) => u.includes('slow-site.test'))) {
      return HttpResponse.json(
        { data: { id: 'run_slow_timeout' } },
        { status: 408 }
      );
    }

    // Simulate error for special test URL
    if (urls.some((u) => u.includes('error-site.test'))) {
      return HttpResponse.json(
        { error: { message: 'Actor run failed' } },
        { status: 400 }
      );
    }

    // Return matching items from fixtures based on requested URLs
    const searchParam = new URL(request.url).searchParams;
    const limit = parseInt(searchParam.get('limit')) || 100;

    let items;
    if (urls.length === 1) {
      // Single URL: return matching item or first fixture item with adjusted URL
      const match = datasetItems.find((item) => item.url === urls[0]);
      items = match ? [match] : [{ ...datasetItems[0], url: urls[0] }];
    } else {
      // Multiple URLs: return items for each, fallback to fixtures
      items = urls.map((url, i) => {
        const match = datasetItems.find((item) => item.url === url);
        return match || { ...datasetItems[i % datasetItems.length], url };
      });
    }

    return HttpResponse.json(items.slice(0, limit));
  }),

  // ── Async run start ──
  http.post(`${BASE}/acts/:actorId/runs`, async ({ request }) => {
    const auth = request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { message: 'Authentication required' } },
        { status: 401 }
      );
    }

    return HttpResponse.json(runRunning, { status: 201 });
  }),

  // ── Poll run status (with waitForFinish) ──
  http.get(`${BASE}/actor-runs/:runId`, ({ params, request }) => {
    const auth = request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { runId } = params;

    // Special failed run
    if (runId === 'run_failed789') {
      return HttpResponse.json(runFailed);
    }

    // Special non-existent run
    if (runId === 'run_nonexistent') {
      return HttpResponse.json(
        { error: { message: 'Run not found' } },
        { status: 404 }
      );
    }

    // Simulate polling: RUNNING on first call, SUCCEEDED on second
    const count = (pollCounts.get(runId) || 0) + 1;
    pollCounts.set(runId, count);

    if (count <= 1) {
      return HttpResponse.json({
        data: { ...runRunning.data, id: runId }
      });
    }

    return HttpResponse.json({
      data: { ...runSucceeded.data, id: runId }
    });
  }),

  // ── Get dataset items ──
  http.get(`${BASE}/datasets/:datasetId/items`, ({ params, request }) => {
    const auth = request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { datasetId } = params;

    if (datasetId === 'dataset_empty') {
      return HttpResponse.json([]);
    }

    if (datasetId === 'dataset_nonexistent') {
      return HttpResponse.json(
        { error: { message: 'Dataset not found' } },
        { status: 404 }
      );
    }

    const searchParam = new URL(request.url).searchParams;
    const limit = parseInt(searchParam.get('limit')) || 50;
    const offset = parseInt(searchParam.get('offset')) || 0;

    return HttpResponse.json(datasetItems.slice(offset, offset + limit));
  }),
];
