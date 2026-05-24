import { classify, extractCandidateTickers } from './classifier.js';
import { severityScore, severityBucket } from './severity.js';
import { mapImpact } from './impact-mapper.js';
import { itemKey } from './dedupe.js';

export function buildSignal(item, impactMap) {
  const classification = classify(item, impactMap);
  const score = severityScore(item, classification);
  const bucket = severityBucket(score);
  const impact = mapImpact(classification, impactMap);
  const article_tickers = extractCandidateTickers(`${item.title} ${item.summary}`);

  return {
    key: itemKey(item),
    detected_at: new Date().toISOString(),
    published_at: item.iso_date || item.pub_date,
    source: item.feed_name,
    source_id: item.feed_id,
    source_authority: item.feed_authority,
    title: item.title,
    url: item.link,
    summary: (item.summary || '').slice(0, 400),
    matched: classification.matched,
    primary_event_id: classification.primary_event?.event_id || null,
    primary_event_label: classification.primary_event?.event_label || null,
    matched_keywords: classification.primary_event?.matched_keywords || [],
    all_events: classification.all_events.map(e => e.event_id),
    severity_score: score,
    severity: bucket,
    affected_sectors_bullish: impact.affected_sectors_bullish,
    affected_sectors_bearish: impact.affected_sectors_bearish,
    example_tickers_bullish: impact.example_tickers_bullish,
    example_tickers_bearish: impact.example_tickers_bearish,
    article_mentioned_tickers: article_tickers
  };
}
