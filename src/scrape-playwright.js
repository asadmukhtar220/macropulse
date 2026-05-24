import { chromium } from 'playwright';
import { log, withRetry, writeOutput, parseRating, parsePrice, sleep } from './utils.js';

const BASE = 'https://books.toscrape.com';
const PAGES_TO_SCRAPE = parseInt(process.env.PAGES || '3', 10);
const OUT_DIR = './output';

async function extractBooksFromPage(page, pageNum) {
  await withRetry(async () => {
    await page.waitForSelector('article.product_pod', { timeout: 10000 });
  }, { label: `wait for products on page ${pageNum}` });

  return page.$$eval('article.product_pod', (cards) => {
    return cards.map(card => {
      const titleEl = card.querySelector('h3 a');
      const priceEl = card.querySelector('.price_color');
      const availEl = card.querySelector('.availability');
      const ratingEl = card.querySelector('p.star-rating');
      const imgEl = card.querySelector('img');
      return {
        title: titleEl?.getAttribute('title') ?? null,
        relativeUrl: titleEl?.getAttribute('href') ?? null,
        priceText: priceEl?.textContent?.trim() ?? '',
        availability: availEl?.textContent?.trim() ?? '',
        ratingClass: ratingEl?.getAttribute('class') ?? '',
        imageSrc: imgEl?.getAttribute('src') ?? null
      };
    });
  });
}

async function main() {
  log('INFO', `Starting Playwright scraper — ${PAGES_TO_SCRAPE} pages from ${BASE}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (compatible; PortfolioScraperPlaywright/1.0)'
  });
  const page = await context.newPage();

  const allBooks = [];
  const startedAt = Date.now();

  try {
    for (let p = 1; p <= PAGES_TO_SCRAPE; p++) {
      const url = `${BASE}/catalogue/page-${p}.html`;
      log('INFO', `Navigating to ${url}`);
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        const raw = await extractBooksFromPage(page, p);
        const books = raw.map(r => ({
          title: r.title,
          price_gbp: parsePrice(r.priceText),
          rating_out_of_5: parseRating(r.ratingClass),
          availability: r.availability,
          url: r.relativeUrl
            ? new URL(r.relativeUrl, `${BASE}/catalogue/`).href
            : null,
          image_url: r.imageSrc ? new URL(r.imageSrc, BASE).href : null,
          source_page: p,
          scraped_at: new Date().toISOString()
        }));
        log('INFO', `Page ${p}: extracted ${books.length} books`);
        allBooks.push(...books);
        await sleep(400);
      } catch (err) {
        log('ERROR', `Page ${p} failed: ${err.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  const durationMs = Date.now() - startedAt;
  log('INFO', `Scrape complete in ${durationMs}ms — total ${allBooks.length} books`);
  await writeOutput(OUT_DIR, 'books-playwright', allBooks);

  const summary = {
    scraper: 'playwright',
    target: BASE,
    pages_scraped: PAGES_TO_SCRAPE,
    total_records: allBooks.length,
    duration_ms: durationMs,
    avg_ms_per_page: Math.round(durationMs / PAGES_TO_SCRAPE),
    completed_at: new Date().toISOString()
  };
  await writeOutput(OUT_DIR, 'summary-playwright', [summary]);
  log('INFO', `Summary: ${JSON.stringify(summary)}`);
}

main().catch(err => {
  log('FATAL', err.stack || err.message);
  process.exit(1);
});
