import fs from 'fs/promises';
import path from 'path';
import { writeJson, writeCsv, appendJsonLine } from './utils.js';

const OUT_DIR = path.resolve('output');

export async function writeFeed(signals) {
  await writeJson(path.join(OUT_DIR, 'feed.json'), signals);
  await writeCsv(path.join(OUT_DIR, 'feed.csv'), signals.map(flatten));
}

export async function writeAlerts(alerts) {
  await writeJson(path.join(OUT_DIR, 'alerts.json'), alerts);
}

export async function appendLiveLog(signal) {
  await appendJsonLine(path.join(OUT_DIR, 'live-log.ndjson'), signal);
}

export async function writeDigest(signals) {
  const grouped = {};
  for (const s of signals) {
    if (!s.matched) continue;
    const k = s.primary_event_label || 'Unclassified';
    grouped[k] = grouped[k] || [];
    grouped[k].push(s);
  }
  const sortedGroups = Object.entries(grouped).sort(
    (a, b) => b[1].length - a[1].length
  );

  const lines = [];
  lines.push(`# MacroPulse Daily Digest`);
  lines.push(`_Generated: ${new Date().toISOString()}_`);
  lines.push('');
  lines.push(`**Total classified signals**: ${signals.filter(s => s.matched).length}`);
  lines.push('');
  for (const [group, items] of sortedGroups) {
    lines.push(`## ${group} (${items.length})`);
    lines.push('');
    items.sort((a, b) => b.severity_score - a.severity_score);
    for (const s of items.slice(0, 10)) {
      lines.push(`### [${s.severity.toUpperCase()}] ${s.title}`);
      lines.push(`- **Source**: ${s.source}`);
      lines.push(`- **Published**: ${s.published_at || 'unknown'}`);
      lines.push(`- **Severity score**: ${s.severity_score}`);
      if (s.example_tickers_bullish.length > 0) {
        lines.push(`- **Tailwind candidates**: ${s.example_tickers_bullish.join(', ')}`);
      }
      if (s.example_tickers_bearish.length > 0) {
        lines.push(`- **Headwind candidates**: ${s.example_tickers_bearish.join(', ')}`);
      }
      if (s.article_mentioned_tickers.length > 0) {
        lines.push(`- **Tickers mentioned in article**: ${s.article_mentioned_tickers.join(', ')}`);
      }
      lines.push(`- **Link**: ${s.url}`);
      lines.push('');
    }
  }
  lines.push('---');
  lines.push('_MacroPulse — RSS-only macro event aggregator. Educational/illustrative signals only — not investment advice._');

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUT_DIR, 'digest.md'), lines.join('\n'), 'utf8');
}

function flatten(s) {
  return {
    detected_at: s.detected_at,
    published_at: s.published_at,
    source: s.source,
    title: s.title,
    severity: s.severity,
    severity_score: s.severity_score,
    primary_event: s.primary_event_label,
    matched_keywords: (s.matched_keywords || []).join('|'),
    bullish_sectors: s.affected_sectors_bullish.join('|'),
    bearish_sectors: s.affected_sectors_bearish.join('|'),
    bullish_tickers: s.example_tickers_bullish.join('|'),
    bearish_tickers: s.example_tickers_bearish.join('|'),
    article_tickers: s.article_mentioned_tickers.join('|'),
    url: s.url
  };
}
