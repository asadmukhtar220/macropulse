import fs from 'fs/promises';
import path from 'path';

const LEVEL_COLOR = {
  INFO: '\x1b[36m',
  WARN: '\x1b[33m',
  ERROR: '\x1b[31m',
  FATAL: '\x1b[35m',
  ALERT: '\x1b[32m',
  RESET: '\x1b[0m'
};

export function log(level, msg) {
  const ts = new Date().toISOString();
  const color = LEVEL_COLOR[level] || '';
  const reset = LEVEL_COLOR.RESET;
  console.log(`${color}[${ts}] [${level}] ${msg}${reset}`);
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
      if (i < attempts) {
        const delay = baseDelayMs * Math.pow(2, i - 1);
        log('WARN', `${label} failed attempt ${i}/${attempts}: ${err.message}. Retry in ${delay}ms`);
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}

export async function readJson(p) {
  const raw = await fs.readFile(p, 'utf8');
  return JSON.parse(raw);
}

export async function writeJson(p, data) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(data, null, 2), 'utf8');
}

export async function appendJsonLine(p, obj) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.appendFile(p, JSON.stringify(obj) + '\n', 'utf8');
}

export function toCSV(rows) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = v => {
    if (v === null || v === undefined) return '';
    const s = Array.isArray(v) ? v.join('|') : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map(h => escape(r[h])).join(','));
  return lines.join('\n');
}

export async function writeCsv(p, rows) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, toCSV(rows), 'utf8');
}

export function normalizeText(s) {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function hashKey(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}
