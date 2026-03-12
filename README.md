# LoomStack Web Scraper MCP – Batch Scraping for Claude & Cursor

**Scrape up to 20 URLs in a single MCP call. Returns clean markdown, automatically truncated to fit AI context windows. Works with Claude Desktop, Cursor, Cline, Continue.dev, and any MCP-compatible client.**

This Actor runs as a persistent **MCP (Model Context Protocol) server** on Apify Standby. Your AI model connects to it directly over HTTP — no custom code, no Apify SDK, no subscriptions needed.

> **5 tools · 20 URLs per call · Real browser rendering · Auto context-window truncation**

---

## Why LoomStack?

- **Batch Power:** Scrape up to 20 URLs in one turn. Most scrapers only do 1.
- **AI-Native:** Returns clean markdown, not messy HTML.
- **Auto-Truncation:** Content over 50k characters is cut with a signal, preventing context overflow.
- **Stateless & Fast:** No database needed. Runs on Apify's world-class scraping infra.
- **MCP First:** Built from the ground up for the Model Context Protocol.

---

## Quick start — Claude Desktop

**Step 1:** Deploy this Actor on Apify Standby (Actor → Deploy → Standby)

**Step 2:** Copy your Standby URL — it looks like:
`https://loomstack--mcp-scraper.apify.actor`

**Step 3:** Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "loomstack-scraper": {
      "url": "https://loomstack--mcp-scraper.apify.actor/mcp"
    }
  }
}
```

**Step 4:** Restart Claude Desktop. You'll see 5 new tools available.

**Step 5:** Ask Claude: *"Read these 5 competitor pricing pages and compare them"* — Claude will call `scrape_urls` automatically.

---

## Quick start — Cursor

Settings → Features → MCP → Add new MCP server:
- **Name:** `web-scraper`
- **Type:** HTTP
- **URL:** `https://YOUR-USERNAME--content-toolkit-mcp.apify.actor/mcp`

---

## Quick start — Cline (VS Code)

In Cline settings → MCP Servers → Add:
```json
{
  "web-scraper": {
    "url": "https://YOUR-USERNAME--content-toolkit-mcp.apify.actor/mcp",
    "transport": "http"
  }
}
```

---

## Quick start — Continue.dev

In `.continue/config.json`:
```json
{
  "mcpServers": [
    {
      "name": "web-scraper",
      "url": "https://YOUR-USERNAME--content-toolkit-mcp.apify.actor/mcp"
    }
  ]
}
```

---

## Quick start — any MCP client

The MCP endpoint accepts standard JSON-RPC over HTTP POST:

```bash
# List available tools
curl -X POST https://YOUR-USERNAME--content-toolkit-mcp.apify.actor/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Scrape a page
curl -X POST https://YOUR-USERNAME--content-toolkit-mcp.apify.actor/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "id": 2,
    "params": {
      "name": "scrape_url",
      "arguments": { "url": "https://example.com" }
    }
  }'
```

---

## Real-world use cases

### Research assistant
*"Claude, compare the documentation of these 3 libraries and tell me which has the best TypeScript support"*
→ Claude calls `scrape_urls` with 3 docs URLs, reads them, and gives a structured comparison.

### Competitive intelligence
*"What are the pricing models of our top 10 competitors?"*
→ Claude calls `scrape_urls` with 10 pricing page URLs, extracts and compares plans.

### Documentation indexer
*"Index the entire Next.js docs so I can ask questions about it"*
→ Claude calls `crawl_site` on `nextjs.org/docs`, depth 2, gets all pages as markdown.

### Agent web research loop
AI agent searches for sources, scrapes them in batch with `scrape_urls`, synthesizes findings, repeats.

### RAG pipeline
Scrape target websites → feed markdown to embedding model → store in vector DB → answer questions over fresh data.

### Content monitoring
Regularly scrape competitor pages and alert when content changes.

---

## Pricing

This Actor uses **pay-per-use** billing through the Apify platform — you only pay for compute time when scraping actually runs. No monthly subscription.

Typical costs:
| Task | Approx. cost |
|---|---|
| Scrape 1 static page (cheerio) | ~$0.002 |
| Scrape 1 JS page (playwright) | ~$0.006 |
| Scrape 10 pages in one batch | ~$0.04–0.08 |
| Crawl 15-page docs site | ~$0.08–0.15 |

Enabling `APIFY_USE_PROXY=true` adds proxy costs (~$0.01–0.03 per page).

---

## Configuration

This Actor requires no input — it starts automatically as a server and waits for connections.

Advanced options are set via **Environment Variables** in Actor → Settings:

| Variable | Default | Description |
|---|---|---|
| `APIFY_USE_PROXY` | `false` | `true` = route through Apify Proxy. Helps with bot-protected sites. Costs extra. |
| `RATE_LIMIT_MAX` | `30` | Max MCP requests per minute per IP |
| `PORT` | `3000` | Local dev only. Apify injects `ACTOR_STANDBY_PORT` automatically. |

`APIFY_TOKEN` is injected automatically by the Apify platform — do not set it manually.

---

## Content safety

All URLs are validated before scraping:
- Private IP ranges blocked (127.x, 10.x, 192.168.x, 172.16–31.x)
- AWS metadata endpoint blocked (169.254.169.254)
- localhost and .local domains blocked
- URL format validated (must be http:// or https://)

This prevents SSRF attacks when the Actor is used in automated pipelines.

---

## Supported sites

Works on **any publicly accessible website**:
- ✅ JavaScript SPAs (React, Vue, Angular, Next.js)
- ✅ Server-side rendered sites
- ✅ Static HTML sites (use `cheerio` for fastest results)
- ✅ Paginated content (use `crawl_site` with depth)
- ✅ Multi-language sites

**Not supported:**
- ❌ Sites requiring login or authentication
- ❌ Sites with aggressive anti-scraping (enable proxy as a workaround)
- ❌ Private/internal network URLs (blocked for security)
- ❌ PDF, video, or binary file extraction

---

## Frequently asked questions

**Do I need a separate Apify account to use the scraped Actor inside this one?**
No. When you run this Actor on Apify, the platform automatically injects the necessary credentials. You use your existing Apify account.

**Can I use this without Claude? Does it work with GPT-4 or Gemini?**
Yes. Any MCP-compatible client works — the MCP protocol is model-agnostic. OpenAI's GPT-4, Google Gemini, and local models can use it through any MCP host that supports them (like LibreChat, or custom integrations).

**What happens if a page takes too long to scrape?**
For very large crawls, the sync call times out after 300 seconds. The Actor automatically falls back to async mode — it returns a `runId` you can poll with `get_run_status`, then fetch results with `get_dataset_items`.

**Is content truncated automatically?**
Yes. Pages over 50,000 characters are cut off. The response includes `"truncated": true` and `"originalLength": N` so your AI knows. This prevents LLM context window overflow silently.

**Can I run multiple scrape calls at the same time?**
Yes. The Actor handles concurrent MCP requests. Each request is stateless and independent.

**Does this work on Cloudflare-protected sites?**
Some Cloudflare-protected sites work with the default Playwright crawler. For heavy bot protection, enable `APIFY_USE_PROXY=true` to route through Apify's residential proxy network.

**What's the maximum number of pages I can crawl?**
`scrape_urls`: up to 20 URLs per call. `crawl_site`: up to 50 pages per call (configurable via `maxCrawlPages`). For larger crawls, run multiple calls or use the async flow with `get_run_status`.

**Is this open source?**
Yes, the source is on GitHub. Pull requests welcome.

---

## Troubleshooting

**"No content extracted"**
The page may require login, execute content only after user interaction, or block scrapers. Try:
1. Switching to `playwright:firefox` if using `cheerio`
2. Enabling `APIFY_USE_PROXY=true`
3. Verifying the URL is publicly accessible

**Response is very slow (>30s)**
JavaScript-heavy pages take 15–30s each. Switch to `crawlerType: "cheerio"` for static pages — it's 5× faster.

**"Error in scrape_url: SSRF_BLOCKED"**
The URL points to a private or internal network address. Only public internet URLs are allowed.

**"Error in scrape_url: MISSING_API_TOKEN"**
The Apify token isn't configured. On Apify Standby this is injected automatically. For local dev, set `APIFY_API_TOKEN` in your `.env` file.

**Content is cut off mid-sentence**
This is expected for pages over 50,000 characters. The `truncated: true` field in the response tells your AI the content was cut. If you need the full content, use `crawl_site` with `maxCrawlPages: 1` — though very large pages will still be truncated to protect your LLM's context window.
