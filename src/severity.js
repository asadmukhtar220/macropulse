export function severityScore(item, classification) {
  if (!classification.matched) return 0;
  const ev = classification.primary_event;
  const sourceWeight = item.feed_authority ?? 0.5;
  const eventWeight = ev.event_weight;
  const density = Math.min(1, ev.keyword_density * 3);
  const multiEventBoost = Math.min(0.2, (classification.all_events.length - 1) * 0.05);
  const raw = (sourceWeight * 0.4) + (eventWeight * 0.3) + (density * 0.2) + multiEventBoost;
  return Math.round(raw * 100) / 100;
}

export function severityBucket(score) {
  if (score >= 0.85) return 'critical';
  if (score >= 0.7) return 'high';
  if (score >= 0.5) return 'medium';
  if (score > 0) return 'low';
  return 'none';
}
