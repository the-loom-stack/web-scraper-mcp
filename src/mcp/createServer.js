'use strict';

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { validateUrl, validateUrls, validateApifyId } = require('../utils/validators.js');
const { formatItems } = require('../utils/formatItems.js');
const apifyService = require('../services/apify.service.js');

// ---------------------------------------------------------------------------
// Server-level instructions — sent to the agent on connect via MCP initialize.
// Agents read these once and use them to make tool-selection decisions.
// ---------------------------------------------------------------------------

const AGENT_INSTRUCTIONS = `
You have 5 web scraping tools. Read these rules before picking a tool:

TOOL SELECTION:
• scrape_url   — fetch exactly ONE page
• scrape_urls  — fetch 2–20 pages IN ONE PARALLEL CALL (always prefer over calling scrape_url repeatedly)
• crawl_site   — explore a site by following links when you don't know the URLs in advance
• get_run_status + get_dataset_items — secondary tools, only needed when a very large crawl returns a runId

BATCH RULE (most important): If you need more than one page, use scrape_urls with ALL the URLs at once.
Never call scrape_url in a loop — scrape_urls is faster, cheaper, and uses one API call instead of many.

CRAWLER CHOICE:
• crawlerType:"cheerio" — 5× faster for static HTML (Wikipedia, GitHub, news articles, docs)
• crawlerType:"playwright:firefox" — default, works on all sites including React/Vue/Angular SPAs

CONTENT TRUNCATION: Every page is capped at 50,000 characters. Pages that were cut will have
truncated:true and originalLength in the result. The first 50k chars are preserved.

EMPTY PAGES: If a page has isEmpty:true in the result, the scraper loaded it but found no content.
This usually means the page requires login or blocks scrapers.

ASYNC FLOW (rare): If a very large crawl exceeds 10 minutes, the tool returns a structured response
with status:"ASYNC_RUNNING" and a runId. Follow the next_steps instructions in that response.
`.trim();

// ---------------------------------------------------------------------------
// Tool definitions — written as decision rules, not documentation.
// Agents read these to choose which tool to call and how.
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: 'scrape_url',
    description: [
      'Fetch a single web page and return its content.',
      '',
      'USE WHEN: You need exactly one specific page.',
      'DO NOT USE WHEN: You need 2 or more pages — use scrape_urls instead (same cost, runs in parallel, one call).',
      '',
      'Returns: { url, title, content, truncated?, originalLength?, isEmpty? }',
      '  content — page body as markdown (default), HTML, or plain text',
      '  truncated:true — content was cut at 50,000 chars; originalLength shows the actual page size',
      '  isEmpty:true — page loaded but returned no content (login wall, bot block, or JS-only page)',
      '',
      'TIP: Use crawlerType:"cheerio" for static pages (5× faster). Default playwright:firefox handles all JS sites.',
    ].join('\n'),
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Full URL starting with http:// or https://',
        },
        outputFormat: {
          type: 'string',
          enum: ['markdown', 'html', 'text'],
          description: 'markdown (default) — clean, ideal for summarizing. html — raw structure. text — stripped plain text.',
        },
        crawlerType: {
          type: 'string',
          enum: ['playwright:firefox', 'playwright:chrome', 'cheerio'],
          description: 'playwright:firefox (default) — all sites including JS-rendered. cheerio — static HTML only, 5× faster.',
        },
      },
      required: ['url'],
    },
  },

  {
    name: 'scrape_urls',
    description: [
      'Fetch 2–20 URLs in a single parallel call. Always use this when you have multiple URLs.',
      '',
      'USE WHEN: You need 2 or more specific pages. This is the primary scraping tool.',
      'DO NOT USE WHEN: You need to explore a site by following links — use crawl_site instead.',
      '',
      'Returns: { totalPages, pages: [{ url, title, content, truncated?, originalLength?, isEmpty? }] }',
      '  totalPages — number of pages actually returned (may be less than requested if some failed)',
      '  pages — array of results; order may differ from input URL order',
      '',
      'MAX: 20 URLs per call. If you have more, split into multiple calls of up to 20.',
      'TIP: Use crawlerType:"cheerio" for static HTML pages (5× faster, lower cost).',
    ].join('\n'),
    inputSchema: {
      type: 'object',
      properties: {
        urls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of full URLs to scrape in parallel. Maximum 20 per call.',
        },
        outputFormat: {
          type: 'string',
          enum: ['markdown', 'html', 'text'],
          description: 'Output format applied to all pages. Defaults to markdown.',
        },
        crawlerType: {
          type: 'string',
          enum: ['playwright:firefox', 'playwright:chrome', 'cheerio'],
          description: 'playwright:firefox (default) handles all sites. cheerio is 5× faster for static HTML.',
        },
      },
      required: ['urls'],
    },
  },

  {
    name: 'crawl_site',
    description: [
      'Crawl a website by following internal links from a starting URL.',
      '',
      'USE WHEN: You want to discover and read multiple pages on a site without knowing the exact URLs in advance.',
      '  Examples: index all pages of a docs site, read all blog posts, explore a knowledge base.',
      'DO NOT USE WHEN: You already have specific URLs — use scrape_urls instead (faster, more predictable).',
      '',
      'Returns: { startUrl, totalPages, pages: [{ url, title, content, truncated?, originalLength?, isEmpty? }] }',
      '',
      'DEPTH GUIDE:',
      '  maxCrawlDepth:0 — start page only (same as scrape_url)',
      '  maxCrawlDepth:1 — start page + all pages linked from it (default, recommended)',
      '  maxCrawlDepth:2 — one more level deeper (can return many pages, use a low maxCrawlPages cap)',
      '',
      'PERFORMANCE: Keep maxCrawlPages at 10–20 for fast sync results. Very large crawls (>10 min)',
      'return status:"ASYNC_RUNNING" with a runId — follow the next_steps in that response.',
    ].join('\n'),
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Starting URL. The crawler follows links found on this page.',
        },
        maxCrawlDepth: {
          type: 'number',
          description: '0=start page only, 1=start + linked pages (default), 2=one level deeper. Keep low to avoid timeouts.',
        },
        maxCrawlPages: {
          type: 'number',
          description: 'Hard cap on total pages. Defaults to 10, maximum 50. Use 10–20 for reliable sync responses.',
        },
        outputFormat: {
          type: 'string',
          enum: ['markdown', 'html', 'text'],
          description: 'Output format for all pages. Defaults to markdown.',
        },
        crawlerType: {
          type: 'string',
          enum: ['playwright:firefox', 'playwright:chrome', 'cheerio'],
          description: 'playwright:firefox (default). Use cheerio for static HTML sites (5× faster).',
        },
      },
      required: ['url'],
    },
  },

  {
    name: 'get_run_status',
    description: [
      'Check the status of a long-running crawl that returned a runId.',
      '',
      'USE WHEN: A crawl_site or scrape_urls call returned status:"ASYNC_RUNNING" with a runId.',
      'DO NOT USE for normal scraping — scrape_url, scrape_urls, and crawl_site return results directly.',
      '',
      'Returns: { id, status, startedAt, finishedAt, defaultDatasetId, usageTotalUsd }',
      '  status values:',
      '    "RUNNING"   — still in progress, check again in 10–30 seconds',
      '    "SUCCEEDED" — done, call get_dataset_items with defaultDatasetId to get results',
      '    "FAILED"    — run failed, try again with fewer pages or simpler parameters',
      '    "ABORTED" / "TIMED-OUT" — run was stopped',
      '',
      'WORKFLOW: get_run_status(runId) → if SUCCEEDED → get_dataset_items(defaultDatasetId)',
    ].join('\n'),
    inputSchema: {
      type: 'object',
      properties: {
        runId: {
          type: 'string',
          description: 'The runId from a previous ASYNC_RUNNING response',
        },
      },
      required: ['runId'],
    },
  },

  {
    name: 'get_dataset_items',
    description: [
      'Fetch scraped pages from a completed async run.',
      '',
      'USE WHEN: get_run_status returned status:"SUCCEEDED". Use the defaultDatasetId from that response.',
      'DO NOT USE before confirming status is "SUCCEEDED" — results will be incomplete.',
      '',
      'Returns: { totalItems, offset, limit, items: [{ url, title, content, truncated?, isEmpty? }] }',
      '',
      'PAGINATION: For large datasets, use offset to page through results.',
      '  First call: offset:0, limit:50',
      '  Next call:  offset:50, limit:50  (repeat until offset >= totalItems)',
    ].join('\n'),
    inputSchema: {
      type: 'object',
      properties: {
        datasetId: {
          type: 'string',
          description: 'The defaultDatasetId from a get_run_status response with status SUCCEEDED',
        },
        limit: {
          type: 'number',
          description: 'Max results per call (1–100). Defaults to 50.',
        },
        offset: {
          type: 'number',
          description: 'Number of items to skip. Use for pagination. Defaults to 0.',
        },
        outputFormat: {
          type: 'string',
          enum: ['markdown', 'html', 'text'],
          description: 'Output format. Defaults to markdown.',
        },
      },
      required: ['datasetId'],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

const toolHandlers = {
  async scrape_url(args) {
    const url = validateUrl(args.url);
    const outputFormat = args.outputFormat || 'markdown';
    const items = await apifyService.scrapeUrls([url], {
      outputFormat,
      crawlerType: args.crawlerType,
      maxCrawlDepth: 0,
      maxCrawlPages: 1,
    });

    if (!items.length) {
      return errorResult(
        `No response received from ${url}. ` +
        'The page may be down, require login, or block automated access. ' +
        'Try a different URL or enable proxy by setting APIFY_USE_PROXY=true on the server.'
      );
    }

    const page = formatItems(items, outputFormat)[0];

    if (page.isEmpty) {
      page._hint = 'Page loaded but returned no content. This usually means: (1) the page requires login, (2) content only appears after user interaction, or (3) the site blocks scrapers. Try crawlerType:"playwright:firefox" or enable proxy.';
    } else if (page.truncated) {
      page._hint = `Content was truncated at 50,000 characters. Original length: ${page.originalLength.toLocaleString()} chars. The most prominent content at the top of the page is preserved.`;
    }

    return textResult(JSON.stringify(page, null, 2));
  },

  async scrape_urls(args) {
    const urls = validateUrls(args.urls);
    const outputFormat = args.outputFormat || 'markdown';
    const items = await apifyService.scrapeUrls(urls, {
      outputFormat,
      crawlerType: args.crawlerType,
      maxCrawlDepth: 0,
      maxCrawlPages: urls.length,
    });

    const pages = formatItems(items, outputFormat);
    const emptyCount = pages.filter((p) => p.isEmpty).length;
    const truncatedCount = pages.filter((p) => p.truncated).length;

    const result = { totalPages: pages.length, pages };

    if (emptyCount > 0) {
      result._hint = `${emptyCount} of ${pages.length} pages returned no content (isEmpty:true). Those pages may require login or block scrapers.`;
    } else if (truncatedCount > 0) {
      result._hint = `${truncatedCount} of ${pages.length} pages were truncated at 50,000 characters (truncated:true). Truncated pages were larger than the limit.`;
    }

    return textResult(JSON.stringify(result, null, 2));
  },

  async crawl_site(args) {
    const url = validateUrl(args.url);
    const outputFormat = args.outputFormat || 'markdown';
    const maxCrawlPages = Math.min(Math.max(args.maxCrawlPages || 10, 1), 50);
    const maxCrawlDepth = Math.max(args.maxCrawlDepth != null ? args.maxCrawlDepth : 1, 0);

    // Warn the agent if they're requesting a cap that was silently reduced
    const wasCapped = args.maxCrawlPages && args.maxCrawlPages > 50;

    const items = await apifyService.scrapeUrls([url], {
      outputFormat,
      crawlerType: args.crawlerType,
      maxCrawlDepth,
      maxCrawlPages,
    });

    const pages = formatItems(items, outputFormat);
    const result = { startUrl: url, totalPages: pages.length, pages };

    if (wasCapped) {
      result._hint = `maxCrawlPages was capped at 50 (you requested ${args.maxCrawlPages}). For larger crawls, make multiple calls.`;
    }

    return textResult(JSON.stringify(result, null, 2));
  },

  async get_run_status(args) {
    const runId = validateApifyId(args.runId, 'runId');
    const run = await apifyService.getRunStatus(runId);

    const result = {
      id: run.id,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      defaultDatasetId: run.defaultDatasetId,
      usageTotalUsd: run.usageTotalUsd,
    };

    if (run.status === 'SUCCEEDED') {
      result._next = `Run complete. Call get_dataset_items with datasetId:"${run.defaultDatasetId}" to fetch the results.`;
    } else if (run.status === 'RUNNING') {
      result._next = 'Run is still in progress. Wait 10–30 seconds and call get_run_status again.';
    } else if (run.status === 'FAILED' || run.status === 'TIMED-OUT' || run.status === 'ABORTED') {
      result._next = 'Run did not complete successfully. Try again with a lower maxCrawlPages (e.g. 10) or simpler parameters.';
    }

    return textResult(JSON.stringify(result, null, 2));
  },

  async get_dataset_items(args) {
    const datasetId = validateApifyId(args.datasetId, 'datasetId');
    const limit = Math.min(Math.max(args.limit || 50, 1), 100);
    const offset = Math.max(args.offset || 0, 0);
    const outputFormat = args.outputFormat || 'markdown';

    const items = await apifyService.getDatasetItems(datasetId, { limit, offset });
    const pages = formatItems(items, outputFormat);

    const result = { totalItems: pages.length, offset, limit, items: pages };

    if (pages.length === limit) {
      result._hint = `Returned ${limit} items starting at offset ${offset}. If you need more, call again with offset:${offset + limit}.`;
    }

    return textResult(JSON.stringify(result, null, 2));
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textResult(text) {
  return { content: [{ type: 'text', text }] };
}

function errorResult(message) {
  return { content: [{ type: 'text', text: message }], isError: true };
}

/**
 * Converts an error into an actionable MCP error response.
 * For ACTOR_RUN_TIMEOUT specifically, returns a structured async-workflow response
 * instead of an error — the run is still going and the agent can poll it.
 */
function handleToolError(toolName, error) {
  // Async fallback: crawl exceeded 10 min polling window but the run is still alive.
  // Return a workflow response so the agent knows how to continue.
  if (error.code === 'ACTOR_RUN_TIMEOUT' && error.extras?.runId) {
    return textResult(JSON.stringify({
      status: 'ASYNC_RUNNING',
      message: 'The crawl is still running after the maximum wait time. Use get_run_status to track it.',
      runId: error.extras.runId,
      next_steps: [
        `1. Call get_run_status with runId: "${error.extras.runId}"`,
        '2. Repeat until status is "SUCCEEDED" (check every 15–30 seconds)',
        '3. Call get_dataset_items with the defaultDatasetId from the status response',
      ],
    }, null, 2));
  }

  const detail = error.extras && Object.keys(error.extras).length
    ? '\nDetails: ' + JSON.stringify(error.extras)
    : '';

  return errorResult(`${error.message}${detail}`);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function createMcpServer() {
  const server = new Server(
    { name: 'LoomStack MCP Scraper', version: '1.0.0' },
    { capabilities: { tools: {} }, instructions: AGENT_INSTRUCTIONS }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = toolHandlers[name];

    if (!handler) {
      return errorResult(
        `Unknown tool: "${name}". Available tools: ${Object.keys(toolHandlers).join(', ')}`
      );
    }

    try {
      return await handler(args || {});
    } catch (error) {
      return handleToolError(name, error);
    }
  });

  return server;
}

module.exports = { createMcpServer };
