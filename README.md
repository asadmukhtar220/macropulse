# MacroPulse — Real-Time Macro Event Aggregator

**A Node.js tool that watches official news feeds and emits classified signals mapped to affected market sectors and example tickers within seconds of publication.**

Most stock news scrapers tell you the *sentiment* of an article. MacroPulse tells you *which sectors and tickers are likely affected, and why.*

---

## What makes this different

The financial news scraper space is crowded, but most projects share three weaknesses MacroPulse avoids:

| Common approach | MacroPulse approach |
|----------------|---------------------|
| Scrape Yahoo/Bloomberg HTML — breaks weekly under bot protection | RSS-only sourcing from official + reputable feeds — legal, reliable, doesn't break |
| Score sentiment, leave the "so what" to the reader | Classify into **named macro events** (war, pandemic, rate cut, sanctions, oil shock, cyber attack…) |
| Output raw data dumps | Map each event to **affected sectors + example tickers** so the signal is actionable |
| Run as daily batch | Real-time **watch mode** — alerts fire seconds after a feed publishes |
| Python-centric ecosystem | Pure Node.js, ES modules, no API keys required |

---

## What it does

1. **Polls** 10 RSS feeds from official and reputable sources (Federal Reserve, WSJ, BBC, CNBC, MarketWatch, NPR, Yahoo Finance)
2. **Deduplicates** every item by source + GUID so each article is processed once
3. **Classifies** each article into a macro event category using keyword matching with word-boundary precision (no false positives from substrings like "Wars*h*" matching "war")
4. **Scores severity** based on source authority weight × event weight × keyword density × multi-event boost
5. **Maps the event** to bullish/bearish sectors and example tickers via a curated `event-impact-map.json`
6. **Emits a structured signal** with full metadata: source, severity bucket, matched keywords, candidate tickers, links
7. **Writes outputs** to `feed.json`, `feed.csv`, `alerts.json`, `digest.md`, and an append-only `live-log.ndjson`

---

## Sample real run (from a single scan)

```
Feeds polled:        10 / 10 OK
Articles ingested:   268
Macro signals:       23 classified
High/critical:       3 alerts
Total duration:      4 seconds

Event breakdown:
  Armed Conflict / War               8
  Tariffs / Trade Policy             3
  Disease Outbreak / Pandemic        3
  Economic Sanctions                 2
  Interest Rate Cut                  2
  Natural Disaster                   2
  Election / Political Transition    1
  Oil / Energy Supply Disruption     1
  Material Corporate Filing (8-K)    1
```

Example real signal from this scan:

```json
{
  "source": "BBC - World News",
  "title": "I survived a missile strike in the Strait of Hormuz, but my friend has not been found",
  "primary_event_label": "Armed Conflict / War",
  "matched_keywords": ["war", "missile strike"],
  "severity": "high",
  "severity_score": 0.7,
  "affected_sectors_bullish": ["defense", "energy_oil", "precious_metals", "cybersecurity"],
  "affected_sectors_bearish": ["airlines", "leisure_travel", "consumer_discretionary"],
  "example_tickers_bullish": ["LMT", "RTX", "NOC", "XOM", "CVX", "GLD", "PANW"],
  "example_tickers_bearish": ["DAL", "UAL", "BKNG", "CCL"]
}
```

The signal arrives **within the polling interval** of publication (default: 2 minutes), and the impact mapping makes it immediately actionable for screening, alerting, or downstream analysis.

---

## Modes

### Real-time watch (default)

```bash
npm start
```

- Polls all enabled feeds every 2 minutes (configurable)
- Detects newly-published items vs. last cycle
- Emits color-coded ALERT log lines as new signals arrive
- Appends each new signal to `output/live-log.ndjson` for downstream tailing
- Updates `output/feed.json`, `feed.csv`, `alerts.json`, `digest.md` after every cycle
- Persists seen-item state in `state/seen-items.json` so restarts don't re-process
- Clean shutdown on SIGINT (Ctrl+C) — finishes current cycle, then exits

### One-shot scan

```bash
npm run scan
```

- Fetches every feed once, classifies, writes all outputs, exits
- Suitable for cron jobs, CI/CD pipelines, or scheduled GitHub Actions

---

## Event taxonomy

13 macro event categories, each with curated keywords + sector/ticker impact mapping:

| Event | Bullish sectors | Bearish sectors |
|-------|----------------|-----------------|
| Armed Conflict / War | defense, oil, gold, cybersecurity | airlines, travel, consumer discretionary |
| Economic Sanctions | gold, silver, BTC | multinational consumer, aerospace |
| Interest Rate Cut | QQQ, VNQ, IWM, TLT | KRE, USD |
| Interest Rate Hike | KRE, USD, SHY | VNQ, QQQ, TLT |
| Quantitative Easing/Tightening | SPY, QQQ | USD |
| Disease Outbreak / Pandemic | PFE, MRNA, ZM, DOCU, AMZN | airlines, travel, events, retail |
| Oil / Energy Supply Disruption | XLE, XOM, CVX, OXY, ICLN | airlines, trucking, chemicals |
| Tariffs / Trade Policy | CAT, DE, X | AAPL, WMT, SOXX |
| Natural Disaster | RNR, RGA, HD, LOW | TRV, ALL |
| Major Cyber Attack | PANW, CRWD, ZS, FTNT, S | (the targeted company) |
| Election / Political Transition | (depends on outcome) | (depends on outcome) |
| Material Corporate Filing (8-K) | (depends on filing) | (the filing company) |
| Supply Chain Disruption | FDX, UPS | AAPL, F, GM |

The mapping lives in [`config/event-impact-map.json`](config/event-impact-map.json) — easy to edit, extend, or fork.

---

## Architecture

```
src/
├── utils.js          Logger (color-coded levels), retry, CSV writer, JSON I/O, hashing
├── fetcher.js        Concurrent RSS fetch using rss-parser + axios, per-feed isolation
├── classifier.js     Word-boundary keyword classification with regex cache
├── severity.js       Severity scoring + bucket assignment
├── impact-mapper.js  Event → sectors → tickers lookup
├── dedupe.js         File-backed seen-item set with size cap
├── signal.js         Composes the final structured signal object
├── output.js         Writes feed.json, feed.csv, alerts.json, digest.md, live-log.ndjson
├── scan.js           One-shot mode entry point
└── watch.js          Real-time polling loop with graceful shutdown

config/
├── feeds.json              10 RSS feed sources + 3 disabled candidates with notes
└── event-impact-map.json   13 macro event types → sector + ticker impact mapping

output/                     (generated)
├── feed.json               All processed signals from latest run
├── feed.csv                Same data, flattened for spreadsheets
├── alerts.json             High + critical severity only
├── digest.md               Human-readable Markdown summary grouped by event type
├── live-log.ndjson         Append-only NDJSON stream of every signal ever processed
└── summary.json            Run metrics: counts, durations, feed health

state/
└── seen-items.json         (gitignored) Persistent dedup across restarts
```

---

## Quickstart

**Prerequisites**: Node.js 18+ and Git.

```bash
git clone https://github.com/asadmukhtar220/web-scraper-demo.git
cd web-scraper-demo
npm install

# Real-time watch (Ctrl+C to stop)
npm start

# Or single scan
npm run scan
```

Outputs land in `./output/`. Open `output/digest.md` in a Markdown viewer for the human-readable summary.

---

## Configuration

Edit `config/feeds.json` to add, disable, or reweight RSS sources:

```json
{
  "id": "my-new-feed",
  "name": "Example Source",
  "url": "https://example.com/rss",
  "category": "geopolitical",
  "authority": 0.8,
  "enabled": true
}
```

Edit `config/event-impact-map.json` to add or refine event-to-ticker mappings:

```json
"my_event_type": {
  "label": "Custom Event",
  "keywords": ["keyword one", "keyword two"],
  "weight": 0.8,
  "impact": {
    "bullish_sectors": [...],
    "bearish_sectors": [...],
    "example_tickers": {
      "bullish": ["TICKER1", "TICKER2"],
      "bearish": ["TICKER3"]
    }
  }
}
```

Change polling cadence in `config/feeds.json` → `poll_interval_seconds` (default `120`).

---

## Severity scoring

```
severity_score = (source_authority × 0.4)
               + (event_weight × 0.3)
               + (keyword_density × 0.2)
               + (multi_event_boost × min 0.2)
```

Buckets:
- `critical` ≥ 0.85
- `high` ≥ 0.7
- `medium` ≥ 0.5
- `low` > 0
- `none` = 0

---

## Important disclaimers

**This is a signal-detection tool, not investment advice.** Ticker mappings are educational and illustrative — they show historical sector-level patterns associated with each event type, not predictions for any individual security. Always do your own research and consult a licensed financial advisor before making investment decisions.

The classifier uses keyword matching, not natural language understanding. False positives and false negatives will happen. The output is suitable as an input to human review or further automated processing, not as a standalone trading signal.

---

## Ethics and source policy

MacroPulse uses **only RSS/Atom feeds published openly by the source**. No HTML scraping, no bypassing of paywalls, no scraping behind authentication. The fetcher identifies itself with a transparent User-Agent string linking back to this repository.

Three feeds are currently disabled in config (`treasury-press`, `sec-8k`, `who-don`) due to upstream URL changes or User-Agent requirements — see comments in `config/feeds.json`. They are ready to re-enable once the correct URLs are confirmed.

---

## Tech stack

- **Node.js 18+** with ES modules
- **rss-parser** — RSS and Atom feed parsing
- **axios** — HTTP client with timeout and redirect handling
- No databases, no API keys, no framework overhead

---

## Author

**Asad Mukhtar** — QA Automation Engineer & Browser Automation Specialist

- Fiverr: [asadmukhtar464](https://www.fiverr.com/asadmukhtar464)
- GitHub: [asadmukhtar220](https://github.com/asadmukhtar220)

Services: end-to-end test automation, API testing, manual QA, web scraping, RSS aggregation pipelines, and custom browser-automation projects. Free 15-minute project scoping call.

---

## License

MIT — see [LICENSE](LICENSE).
