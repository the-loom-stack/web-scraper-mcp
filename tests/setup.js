import { setupServer } from 'msw/node';
import { handlers, resetPollCounts } from './mocks/handlers.js';

export const server = setupServer(...handlers);

beforeAll(() => {
  // Set test env vars before any imports read them
  process.env.NODE_ENV = 'test';
  process.env.APIFY_API_TOKEN = 'test_token_abc123';
  process.env.RAPIDAPI_PROXY_SECRET = 'test_secret';

  server.listen({ onUnhandledRequest: 'bypass' });
});

afterEach(() => {
  server.resetHandlers();
  resetPollCounts();
});

afterAll(() => {
  server.close();
});
