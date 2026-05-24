export function mapImpact(classification, impactMap) {
  if (!classification.matched) {
    return {
      affected_sectors_bullish: [],
      affected_sectors_bearish: [],
      example_tickers_bullish: [],
      example_tickers_bearish: []
    };
  }
  const primary = classification.primary_event.event_id;
  const def = impactMap.events[primary];
  return {
    affected_sectors_bullish: def.impact.bullish_sectors || [],
    affected_sectors_bearish: def.impact.bearish_sectors || [],
    example_tickers_bullish: def.impact.example_tickers?.bullish || [],
    example_tickers_bearish: def.impact.example_tickers?.bearish || []
  };
}
