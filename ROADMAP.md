# Feature Roadmap: The Path Forward

## Effort vs Value Matrix

```
HIGH VALUE
    ▲
    │     📊 JSON          🔍 Search     📸 Screenshots
    │     Extraction       Integration   (High value, high effort)
    │
    │          ⭐ QUICK WINS ZONE ⭐
    │
    │          🎬 Video      🛒 E-comm
    │          (High value,  (Strategic)
    │          high effort)
    │
    │     📄 PDF
    │     (Medium value, medium effort)
    │
    └─────────────────────────────────────► EFFORT
LOW VALUE (Low effort)                  (High effort)

SIZE OF BUBBLE = Market Opportunity
```

---

## Realistic Roadmap (Next 6 Months)

### **Phase 1: Quick Wins (Weeks 1–3)**
Effort: 50 hours | ROI: 3x feature increase

#### **1.1 Search Integration** (10 hours)
```
NEW TOOL: search_web(query, limit, language)
├─ Returns: [{ title, url, snippet, position }]
├─ Uses: SerpAPI or Google Custom Search
├─ Auth: API key (env var)
└─ Tests: 10 tests (basic search, pagination, errors)

Added Value:
  ✅ Research use case unlocked
  ✅ Competitive with Firecrawl
  ✅ Trivial to implement
```

#### **1.2 JSON Extraction** (20 hours)
```
ENHANCED TOOL: scrape_url() + new option: extractJson
├─ Input: { url, fields: ["price", "title", "rating"] }
├─ Logic: Use Claude API to detect fields from HTML
├─ Returns: { price: "29.99", title: "Widget", rating: "4.5" }
├─ Auth: Uses APIFY_API_TOKEN + CLAUDE_API_KEY
└─ Tests: 20 tests (field detection, missing fields, errors)

Added Value:
  ✅ E-commerce scraping starts working
  ✅ Structured data capability
  ✅ Still AI-native (uses Claude for detection)
```

#### **1.3 Screenshot Capture** (30 hours)
```
NEW TOOL: capture_screenshot(url, wait_ms, full_page)
├─ Uses: Playwright Firefox (same as Apify)
├─ Returns: { base64_image, width, height, timestamp }
├─ Storage: S3 or return as base64
├─ Auth: Already has Apify token, adds SCREENSHOT_STORAGE
└─ Tests: 15 tests (rendering, timeout, missing URL)

Added Value:
  ✅ Visual verification use case
  ✅ QA/testing integration
  ✅ Differentiates from text-only competitors
```

**Phase 1 Result:**
```
BEFORE: 5 tools (content extraction only)
AFTER:  8 tools (content + search + JSON + screenshots)

Tools Added:
  ✅ search_web
  ✅ scrape_url (enhanced with JSON extraction)
  ✅ capture_screenshot

Test Coverage: +45 new tests
Deploy: Week 3
```

---

### **Phase 2: Expand Scope (Weeks 4–8)**
Effort: 120 hours | Create separate MCPs

#### **2.1 data-extractor-mcp** (50 hours)
```
PURPOSE: Specialized structured data extraction
TOOLS:
  1. extract_table(url, selector)    → CSV-like output
  2. extract_json_ld(url)            → Schema.org JSON-LD
  3. extract_microdata(url)          → RDFa/microdata
  4. extract_custom_fields(url, schema) → AI-powered

DEPLOYMENT: Separate npm package, separate Apify Actor
MARKET: Researchers, analysts, data engineers
REVENUE: Premium tier
```

#### **2.2 social-scraper-mcp** (60 hours)
```
PURPOSE: Social media data extraction
TOOLS:
  1. scrape_twitter(query, limit, date_range)
  2. scrape_linkedin(profile_url)
  3. scrape_tiktok(hashtag, limit)
  4. scrape_reddit(subreddit, post_type)

BACKEND: Apify Actors (Twitter Scraper, LinkedIn, etc.)
DEPLOYMENT: Separate npm package
MARKET: Market researchers, brand monitoring, sentiment analysis
REVENUE: High (popular use case)
```

#### **2.3 ecommerce-crawler-mcp** (50 hours)
```
PURPOSE: E-commerce product scraping
TOOLS:
  1. scrape_amazon(search, limit)
  2. scrape_ebay(search, limit)
  3. scrape_shopify_store(store_url, product_limit)
  4. extract_product_data(url) → { price, reviews, stock }

BACKEND: Apify E-commerce Actors + structured extraction
DEPLOYMENT: Separate npm package
MARKET: Price monitoring, competitive analysis, dropshipping
REVENUE: Premium tier (highest demand)
```

**Phase 2 Result:**
```
Created 3 new MCPs, each best-in-class for its domain
Total: 8 MCPs in RapidAPI ecosystem

RapidAPI MCP Suite:
  ✅ content-toolkit-mcp (core)
  ✅ data-extractor-mcp (structured data)
  ✅ social-scraper-mcp (social media)
  ✅ ecommerce-crawler-mcp (e-commerce)

Deploy: Weeks 4–8 (can parallelize with contractors)
```

---

### **Phase 3: Ecosystem Control (Weeks 9–12)**
Effort: 40 hours | Create meta-orchestration

#### **3.1 Hybrid Wrapper** (40 hours)
```
PURPOSE: Single entry point to all MCPs
FEATURES:
  1. Auto-detect tool type (search, social, ecommerce, etc.)
  2. Route requests to correct MCP
  3. Unified auth (single RAPIDAPI_PROXY_SECRET)
  4. Caching across MCPs
  5. Usage analytics

RESULT: Users add 1 MCP, get access to all domain-specific tools
```

**Phase 3 Result:**
```
RapidAPI MCP Hub:
  - Users add: content-toolkit-mcp
  - They auto-get: all 4 MCPs + smart routing
  - Behaves like 1 unified tool (but 4 independent)

Positioning: "All-in-one scraping for AI"
```

---

## Timeline & Resource Allocation

### **Option 1: Solo (You)**
```
Phase 1 (Quick Wins):     3 weeks (50 hours)
Phase 2 (3 New MCPs):     8 weeks (120 hours) ← BOTTLENECK
Phase 3 (Hub):            2 weeks (40 hours)

Total: 13 weeks (~3 months full-time)
Burnout risk: ⚠️ MODERATE-HIGH (solo on 3 new projects)
```

### **Option 2: Outsource Phase 2** (Recommended)
```
Phase 1 (You):            3 weeks (50 hours)
Phase 2 (You + 2 contractors):  4 weeks (you: 20h oversight)
  ├─ Contractor 1: data-extractor-mcp (50h)
  ├─ Contractor 2: social-scraper-mcp (60h)
  └─ You: ecommerce-crawler-mcp (50h) OR manage both contractors
Phase 3 (You):            2 weeks (40 hours)

Total: 9 weeks (~2 months real time)
Burnout risk: ✅ LOW
Cost: ~$5-8K (contractors)
```

### **Option 3: Incremental (Best for Learning)**
```
Phase 1 (You):            3 weeks (50 hours) ← Deploy
↓
PAUSE. Get user feedback on quick wins.
↓
Phase 2.1 (You):          2 weeks (50 hours) → data-extractor-mcp
↓
MEASURE. See if users want more.
↓
Phase 2.2 & 2.3: Decide based on demand
```

---

## Financial Projections (Rough Estimates)

### **Current State (5 tools, website content only)**
```
Monthly Users:     ~50 (small AI community)
Avg Crawls/user:   100
Total Revenue:     ~$30/mo (Apify pass-through)
Team: 1 (you)
Status: Sustainable for hobby, not business
```

### **After Phase 1 (8 tools, +search +JSON +screenshots)**
```
Monthly Users:     ~200 (3–4x growth)
Avg Crawls/user:   150
Total Revenue:     ~$180/mo
New Use Cases:     Research, QA, data analysis
Status: Growing hobby project
```

### **After Phase 2 (4 MCPs, domain-specific)**
```
Monthly Users:     ~1000 (5x from Phase 1)
Breakdown:
  - content-toolkit: 300 users
  - data-extractor: 200 users
  - social-scraper: 350 users (highest demand)
  - ecommerce: 150 users

Total Revenue:     ~$1200/mo (varied by domain)
Status: Small but real business ($14K/year)
```

### **After Phase 3 (Unified Hub)**
```
Monthly Users:     ~2000 (2x from Phase 2)
"Sticky" users:    ~400 (use multiple MCPs)
Total Revenue:     ~$3000/mo (increased retention)
Churn Rate:        Drops (users invested in ecosystem)
Status: Legit SaaS ($36K/year)
```

---

## Decision Tree

```
START HERE

Are you building a business?
├─ YES, want premium features quickly
│  └─ → Choose OPTION 2 (Outsource Phase 2)
│     Do Phase 1 yourself, hire contractors for 3 new MCPs
│     Timeline: 2 months, $5–8K
│     Result: 4 MCPs, real revenue potential
│
├─ YES, but limited budget
│  └─ → Choose OPTION 3 (Incremental)
│     Do Phase 1 now, wait for user feedback
│     Roll out Phase 2 as demand appears
│     Timeline: 3+ months, $0–2K
│     Result: Right-sized products, no wasted effort
│
├─ NO, just want a better feature-set
│  └─ → Choose OPTION 1 (Phase 1 Only)
│     Add search + JSON + screenshots
│     Timeline: 3 weeks
│     Result: Competitive with Firecrawl
│
└─ UNSURE, want to stay focused
   └─ → Stay with current 5 tools
      Market as "best batch MCP for AI"
      Revisit in 6 months
```

---

## Recommendation: Go With **OPTION 2**

**Why:**
1. **Phase 1 (You do)**: Get quick wins on board (search, JSON, screenshots)
   - Validates market interest
   - Proves you can ship
   - Gets feedback for Phase 2

2. **Phase 2 (Outsource)**: Hire 1–2 contractors for new MCPs
   - data-extractor and social-scraper are highest ROI
   - ecommerce can be you (your core strength)
   - They follow your architecture, you review PRs

3. **Phase 3 (You do)**: Build unified hub
   - Tie everything together
   - "All-in-one MCP for web scraping"

**Cost-Benefit:**
```
Investment:     $5-8K (contractor costs)
Timeline:       2 months real time
Result:         4 MCPs, 5x user growth, real revenue
Alternative:    Solo for 3 months, burnout risk, slower
```

---

## Concrete Action Plan

### **This Week**
```
1. Decide: Which path resonates most?
   - [ ] Phase 1 only (quick wins)
   - [ ] Outsource Phase 2 (growth)
   - [ ] Incremental Phase 3 (safe)

2. If Phase 1: Start search integration
   - [ ] Pick SerpAPI or Google Custom Search
   - [ ] Implement search_web tool
   - [ ] Write 10 tests

3. If Phase 2: Draft contractor roles
   - [ ] Write job descriptions
   - [ ] Post on Arc.dev, Toptal, or Upwork
   - [ ] Target: Node.js + Express + MCP experience

Ready to move?
```

---

## Bottom Line

**You built a focused, reliable tool. It works.**

Now the question is: **Do you want to build a business around it?**

- **Path A (Stay Focused):** You = best batch MCP for AI. Own that niche. Revenue: ~$2-5K/year.
- **Path B (Expand Carefully):** You = competitive general-purpose MCP. Revenue: ~$20-50K/year.
- **Path C (Build Ecosystem):** You = MCP suite for web scraping. Revenue: $50K+/year, requires team.

All three are viable. Pick the one that aligns with your goals.

**My bet:** Path B (Phase 1 + outsourced Phase 2). Best ROI, manageable, and you stay hands-on.

Ready to start?
