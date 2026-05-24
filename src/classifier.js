import { normalizeText } from './utils.js';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildKeywordRegex(kw) {
  const escaped = escapeRegex(normalizeText(kw));
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
}

const regexCache = new Map();
function regexFor(kw) {
  if (!regexCache.has(kw)) regexCache.set(kw, buildKeywordRegex(kw));
  return regexCache.get(kw);
}

export function classify(item, impactMap) {
  const haystack = normalizeText(`${item.title} ${item.summary}`);
  const hits = [];

  for (const [eventId, def] of Object.entries(impactMap.events)) {
    let matchCount = 0;
    const matchedKeywords = [];
    for (const kw of def.keywords) {
      if (regexFor(kw).test(haystack)) {
        matchCount++;
        matchedKeywords.push(kw);
      }
    }
    if (matchCount > 0) {
      hits.push({
        event_id: eventId,
        event_label: def.label,
        match_count: matchCount,
        matched_keywords: matchedKeywords,
        keyword_density: matchCount / def.keywords.length,
        event_weight: def.weight
      });
    }
  }

  hits.sort((a, b) => {
    const aScore = a.match_count * a.event_weight;
    const bScore = b.match_count * b.event_weight;
    return bScore - aScore;
  });

  return {
    matched: hits.length > 0,
    primary_event: hits[0] || null,
    all_events: hits
  };
}

export function extractCandidateTickers(text) {
  const candidates = new Set();
  const dollarPattern = /\$([A-Z]{1,5})\b/g;
  const exchangePattern = /\b(NYSE|NASDAQ|AMEX):([A-Z.]{1,6})\b/g;
  const parenTicker = /\(([A-Z]{2,5})(?::[A-Z]+)?\)/g;
  let m;
  while ((m = dollarPattern.exec(text)) !== null) candidates.add(m[1]);
  while ((m = exchangePattern.exec(text)) !== null) candidates.add(m[2]);
  while ((m = parenTicker.exec(text)) !== null) candidates.add(m[1]);
  return Array.from(candidates);
}
