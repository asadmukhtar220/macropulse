# Web Scraper Demo — Playwright + Cheerio

A production-ready web scraper showcase with two interchangeable engines: a fast static-HTML scraper (Cheerio) and a real-browser dynamic scraper (Playwright). Extracts a 100-record book catalog from `books.toscrape.com` and outputs clean CSV and JSON.

Built as a portfolio demonstration of browser-automation and data-extraction work, using the same Playwright toolkit I use for end-to-end QA testing.

## Highlights

- **Two scraper engines**, one shared schema
  - **Cheerio + Axios** — ~70ms per page, ideal for static HTML
  - **Playwright (Chromium)** — handles JS-rendered pages, click flows, auth-walled content
- **Production patterns** — exponential-backoff retries, structured timestamped logging, configurable page count via env var, polite delays between requests
- **Dual output** — JSON for programmatic consumers, CSV for spreadsheets and BI tools
- **Run summary file** — duration, page count, throughput metrics on every run
- **Respectful crawling** — custom User-Agent identifying the bot, request delays, only targets publicly accessible pages

## Sample run results

| Engine | Pages | Records | Duration | Avg/page |
|--------|-------|---------|----------|----------|
| Cheerio | 5 | 100 | 6.7 s | 1.3 s |
| Playwright | 3 | 60 | 9.6 s | 3.2 s |

Cheerio is ~2.5x faster per page; Playwright wins when the target site requires JavaScript execution or login flows.

## Data schema

Each scraped record:

```json
{
  "title": "A Light in the Attic",
  "price_gbp": 51.77,
  "rating_out_of_5": 3,
  "availability": "In stock",
  "url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
  "image_url": "https://books.toscrape.com/media/cache/2c/da/...jpg",
  "source_page": 1,
  "scraped_at": "2026-05-24T08:37:01.434Z"
}
```

## Running locally

**Prerequisites**: Node.js 18+.

```bash
git clone https://github.com/asadmukhtar220/web-scraper-demo.git
cd web-scraper-demo
npm install
npx playwright install chromium

# Run both engines back-to-back
npm run scrape

# Or run individually
npm run scrape:fast         # Cheerio only
npm run scrape:playwright   # Playwright only

# Scrape more pages
PAGES=10 npm run scrape:fast
```

Output is written to `./output/`:

- `books-cheerio.json` / `books-cheerio.csv`
- `books-playwright.json` / `books-playwright.csv`
- `summary-cheerio.json` + `summary-playwright.json` — run metrics

## When to use which engine

| Use Cheerio when... | Use Playwright when... |
|--------------------|----------------------|
| Target serves HTML directly | Site is React/Vue/Angular SPA |
| Speed and low resource use matter | Content loads after JS execution |
| You're scraping at large scale | You need click flows, form fills, scroll loads |
| Site doesn't need a real browser | Site has aggressive bot detection that headless requests fail |

## Architecture

```
src/
├── utils.js              Shared: retry logic, CSV writer, rating/price parsers, logger
├── scrape-cheerio.js     Static HTTP scraper using axios + cheerio
├── scrape-playwright.js  Real-browser scraper using Chromium
└── scrape.js             Orchestrator — runs both back-to-back
```

The two scrapers normalize their output to the same schema so downstream consumers don't care which engine produced the data.

## Production notes

- **Retries**: `withRetry` wraps every network call with exponential backoff (500ms → 1s → 2s, 3 attempts)
- **Rate limiting**: 300-400ms delay between page requests to be polite to the source server
- **Error isolation**: A failed page logs and continues — one bad page never kills the whole run
- **CSV escaping**: Handles commas, quotes, and newlines in field values per RFC 4180
- **Timestamping**: Every record carries a `scraped_at` ISO 8601 timestamp for downstream auditing

## Ethics and ToS

This scraper targets `books.toscrape.com`, a site explicitly built by scrapinghub.com for scraping practice. For real-world projects I only scrape publicly accessible data and respect each site's `robots.txt` and Terms of Service. Requests that cross those lines (scraping logged-in content, bypassing paywalls, ignoring robots.txt directives) are politely declined.

## Tech stack

- **Node.js 18+** (ES modules)
- **Playwright** — Chromium automation
- **Cheerio** — server-side jQuery-like HTML parsing
- **Axios** — HTTP client
- No build step, no transpilation, no framework overhead

## Author

**Asad Mukhtar** — QA Automation Engineer

- Fiverr: [asadmukhtar464](https://www.fiverr.com/asadmukhtar464)
- GitHub: [asadmukhtar220](https://github.com/asadmukhtar220)

Services: end-to-end test automation, API testing, manual QA, web scraping, and browser-automation projects. Reach out for a free 15-minute project scoping call.

## License

MIT
