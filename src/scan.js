import path from 'path';
import { log, readJson } from './utils.js';
import { fetchAll } from './fetcher.js';
import { buildSignal } from './signal.js';
import { writeFeed, writeAlerts, writeDigest } from './output.js';

const CONFIG_DIR = path.resolve('config');

async function main() {
  const startedAt = Date.now();
  log('INFO', 'MacroPulse scan starting (one-shot mode)');
  const feedsCfg = await readJson(path.join(CONFIG_DIR, 'feeds.json'));
  const impactMap = await readJson(path.join(CONFIG_DIR, 'event-impact-map.json'));

  const { items, stats } = await fetchAll(feedsCfg.feeds, {
    timeoutMs: feedsCfg.request_timeout_ms
  });
  log('INFO', `Fetched ${items.length} items across ${stats.ok} feeds (${stats.failed} failed)`);

  const signals = items.map(i => buildSignal(i, impactMap));
  const matched = signals.filter(s => s.matched);
  const critical = matched.filter(s => s.severity === 'critical' || s.severity === 'high');

  log('INFO', `Classified ${matched.length}/${signals.length} items as macro signals`);
  log('INFO', `High/critical severity: ${critical.length}`);

  await writeFeed(signals);
  await writeAlerts(critical);
  await writeDigest(signals);

  const summary = {
    completed_at: new Date().toISOString(),
    duration_ms: Date.now() - startedAt,
    feeds_total: feedsCfg.feeds.filter(f => f.enabled).length,
    feeds_ok: stats.ok,
    feeds_failed: stats.failed,
    items_total: items.length,
    signals_matched: matched.length,
    signals_critical_or_high: critical.length,
    by_event: matched.reduce((acc, s) => {
      acc[s.primary_event_label] = (acc[s.primary_event_label] || 0) + 1;
      return acc;
    }, {}),
    failures: stats.failures
  };
  log('INFO', `Summary: ${JSON.stringify(summary)}`);
  const { writeJson } = await import('./utils.js');
  await writeJson(path.resolve('output/summary.json'), summary);
}

main().catch(err => {
  log('FATAL', err.stack || err.message);
  process.exit(1);
});
