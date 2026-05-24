import Parser from 'rss-parser';
import axios from 'axios';
import { log, withRetry } from './utils.js';

const USER_AGENT = 'MacroPulse/1.0 (+https://github.com/asadmukhtar220/web-scraper-demo) Node.js';

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': USER_AGENT,
    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml'
  }
});

async function fetchRaw(url, timeout) {
  const res = await axios.get(url, {
    timeout: timeout || 15000,
    responseType: 'text',
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
    },
    validateStatus: s => s >= 200 && s < 400,
    maxRedirects: 5
  });
  return res.data;
}

export async function fetchFeed(feed, timeoutMs = 15000) {
  const xml = await withRetry(
    () => fetchRaw(feed.url, timeoutMs),
    { attempts: 2, baseDelayMs: 800, label: `GET ${feed.id}` }
  );
  const parsed = await parser.parseString(xml);
  return (parsed.items || []).map(item => ({
    feed_id: feed.id,
    feed_name: feed.name,
    feed_category: feed.category,
    feed_authority: feed.authority,
    title: item.title || '',
    link: item.link || '',
    pub_date: item.pubDate || item.isoDate || null,
    iso_date: item.isoDate || null,
    guid: item.guid || item.id || item.link || '',
    summary: item.contentSnippet || item.content || item.summary || ''
  }));
}

export async function fetchAll(feeds, opts = {}) {
  const enabled = feeds.filter(f => f.enabled);
  const results = await Promise.allSettled(
    enabled.map(f => fetchFeed(f, opts.timeoutMs))
  );
  const items = [];
  const stats = { ok: 0, failed: 0, failures: [] };
  results.forEach((r, i) => {
    const f = enabled[i];
    if (r.status === 'fulfilled') {
      stats.ok++;
      items.push(...r.value);
      log('INFO', `Feed ${f.id}: ${r.value.length} items`);
    } else {
      stats.failed++;
      stats.failures.push({ feed: f.id, error: r.reason.message });
      log('WARN', `Feed ${f.id} failed: ${r.reason.message}`);
    }
  });
  return { items, stats };
}
