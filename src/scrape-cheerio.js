import axios from 'axios';
import { load } from 'cheerio';
import { log, withRetry, writeOutput, parseRating, parsePrice, sleep } from './utils.js';

const BASE = 'https://books.toscrape.com';
const PAGES_TO_SCRAPE = parseInt(process.env.PAGES || '5', 10);
const OUT_DIR = './output';

const http = axios.create({
  baseURL: BASE,
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; PortfolioScraper/1.0; +https://github.com/asadmukhtar220)',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9'
  }
});

async function fetchPage(pageNum) {
  const url = pageNum === 1
    ? '/catalogue/page-1.html'
    : `/catalogue/page-${pageNum}.html`;
  return withRetry(async () => {
    const { data } = await http.get(url);
    return data;
  }, { label: `fetch page ${pageNum}` });
}

function parseBooksFromHtml(html, pageNum) {
  const $ = load(html);
  const books = [];
  $('article.product_pod').each((_, el) => {
    const title = $(el).find('h3 a').attr('title');
    const relativeUrl = $(el).find('h3 a').attr('href');
    const url = relativeUrl
      ? new URL(relativeUrl, `${BASE}/catalogue/`).href
      : null;
    const priceText = $(el).find('.price_color').text();
    const availability = $(el).find('.availability').text().trim();
    const ratingClass = $(el).find('p.star-rating').attr('class') || '';
    const rating = parseRating(ratingClass);
    const imageUrl = $(el).find('img').attr('src');
    books.push({
      title,
      price_gbp: parsePrice(priceText),
      rating_out_of_5: rating,
      availability,
      url,
      image_url: imageUrl ? new URL(imageUrl, BASE).href : null,
      source_page: pageNum,
      scraped_at: new Date().toISOString()
    });
  });
  return books;
}

async function main() {
  log('INFO', `Starting Cheerio scraper — ${PAGES_TO_SCRAPE} pages from ${BASE}`);
  const allBooks = [];
  const startedAt = Date.now();

  for (let p = 1; p <= PAGES_TO_SCRAPE; p++) {
    try {
      const html = await fetchPage(p);
      const books = parseBooksFromHtml(html, p);
      log('INFO', `Page ${p}: extracted ${books.length} books`);
      allBooks.push(...books);
      await sleep(300);
    } catch (err) {
      log('ERROR', `Page ${p} failed after retries: ${err.message}`);
    }
  }

  const durationMs = Date.now() - startedAt;
  log('INFO', `Scrape complete in ${durationMs}ms — total ${allBooks.length} books`);
  await writeOutput(OUT_DIR, 'books-cheerio', allBooks);

  const summary = {
    scraper: 'cheerio',
    target: BASE,
    pages_scraped: PAGES_TO_SCRAPE,
    total_records: allBooks.length,
    duration_ms: durationMs,
    avg_ms_per_page: Math.round(durationMs / PAGES_TO_SCRAPE),
    completed_at: new Date().toISOString()
  };
  await writeOutput(OUT_DIR, 'summary-cheerio', [summary]);
  log('INFO', `Summary: ${JSON.stringify(summary)}`);
}

main().catch(err => {
  log('FATAL', err.stack || err.message);
  process.exit(1);
});
