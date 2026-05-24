import fs from 'fs/promises';
import path from 'path';
import { log, readJson, sleep } from './utils.js';
import { fetchAll } from './fetcher.js';
import { buildSignal } from './signal.js';
import { writeFeed, writeAlerts, writeDigest, appendLiveLog } from './output.js';
import { loadSeen, saveSeen, itemKey } from './dedupe.js';

const CONFIG_DIR = path.resolve('config');
const FEED_FILE = path.resolve('output/feed.json');
let stopping = false;

async function loadExistingFeed() {
  try {
    const data = await fs.readFile(FEED_FILE, 'utf8');
    const arr = JSON.parse(data);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function poll(feedsCfg, impactMap, seen, allSignals) {
  const pollStart = Date.now();
  const { items, stats } = await fetchAll(feedsCfg.feeds, {
    timeoutMs: feedsCfg.request_timeout_ms
  });

  const fresh = [];
  for (const item of items) {
    const k = itemKey(item);
    if (!seen.has(k)) {
      seen.add(k);
      fresh.push(item);
    }
  }

  log('INFO', `Poll cycle: ${items.length} items total, ${fresh.length} new (${stats.failed} feed failures)`);

  let newMatchedCount = 0;
  for (const item of fresh) {
    const signal = buildSignal(item, impactMap);
    allSignals.push(signal);

    if (signal.matched) {
      newMatchedCount++;
      const tag = `[${signal.severity.toUpperCase()}] [${signal.primary_event_label}]`;
      log('ALERT', `${tag} ${signal.title}`);
      if (signal.example_tickers_bullish.length > 0) {
        log('ALERT', `   ↑ bullish candidates: ${signal.example_tickers_bullish.join(', ')}`);
      }
      if (signal.example_tickers_bearish.length > 0) {
        log('ALERT', `   ↓ bearish candidates: ${signal.example_tickers_bearish.join(', ')}`);
      }
      log('ALERT', `   ${signal.url}`);
    }
    await appendLiveLog(signal);
  }

  if (fresh.length > 0) {
    await writeFeed(allSignals);
    const critical = allSignals.filter(s => s.severity === 'critical' || s.severity === 'high');
    await writeAlerts(critical);
    await writeDigest(allSignals);
    await saveSeen(seen);
    log('INFO', `Persisted: total signals=${allSignals.length}, new matched=${newMatchedCount}, alerts total=${critical.length}`);
  } else {
    log('INFO', 'No new items — outputs unchanged');
  }

  return Date.now() - pollStart;
}

async function main() {
  log('INFO', 'MacroPulse starting in WATCH mode');
  const feedsCfg = await readJson(path.join(CONFIG_DIR, 'feeds.json'));
  const impactMap = await readJson(path.join(CONFIG_DIR, 'event-impact-map.json'));
  const intervalSec = feedsCfg.poll_interval_seconds || 120;
  log('INFO', `Poll interval: ${intervalSec}s. Monitoring ${feedsCfg.feeds.filter(f => f.enabled).length} feeds. Ctrl+C to stop.`);

  const seen = await loadSeen();
  log('INFO', `Loaded ${seen.size} previously-seen items for dedup`);

  const allSignals = await loadExistingFeed();
  const existingMatched = allSignals.filter(s => s.matched).length;
  log('INFO', `Loaded ${allSignals.length} existing signals from prior runs (${existingMatched} classified)`);

  let cycle = 0;
  while (!stopping) {
    cycle++;
    log('INFO', `=== Poll cycle #${cycle} ===`);
    try {
      const elapsed = await poll(feedsCfg, impactMap, seen, allSignals);
      log('INFO', `Cycle #${cycle} done in ${elapsed}ms`);
    } catch (err) {
      log('ERROR', `Cycle #${cycle} fatal: ${err.message}`);
    }
    if (stopping) break;
    await sleep(intervalSec * 1000);
  }
  log('INFO', 'MacroPulse stopped');
}

process.on('SIGINT', () => {
  log('INFO', 'SIGINT received, shutting down after current cycle');
  stopping = true;
});
process.on('SIGTERM', () => {
  log('INFO', 'SIGTERM received, shutting down after current cycle');
  stopping = true;
});

main().catch(err => {
  log('FATAL', err.stack || err.message);
  process.exit(1);
});
