import fs from 'fs/promises';
import path from 'path';

export function log(level, msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level}] ${msg}`);
}

export async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export async function withRetry(fn, { attempts = 3, baseDelayMs = 500, label = 'op' } = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delay = baseDelayMs * Math.pow(2, i - 1);
      log('WARN', `${label} failed on attempt ${i}/${attempts}: ${err.message}. Retrying in ${delay}ms`);
      if (i < attempts) await sleep(delay);
    }
  }
  throw lastErr;
}

export function toCSV(rows) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = v => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

export async function writeOutput(dir, basename, rows) {
  await fs.mkdir(dir, { recursive: true });
  const jsonPath = path.join(dir, `${basename}.json`);
  const csvPath = path.join(dir, `${basename}.csv`);
  await fs.writeFile(jsonPath, JSON.stringify(rows, null, 2), 'utf8');
  await fs.writeFile(csvPath, toCSV(rows), 'utf8');
  log('INFO', `Wrote ${rows.length} rows to ${jsonPath}`);
  log('INFO', `Wrote ${rows.length} rows to ${csvPath}`);
}

export function parseRating(text) {
  const map = { One: 1, Two: 2, Three: 3, Four: 4, Five: 5 };
  for (const [word, num] of Object.entries(map)) {
    if (text.includes(word)) return num;
  }
  return null;
}

export function parsePrice(text) {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}
