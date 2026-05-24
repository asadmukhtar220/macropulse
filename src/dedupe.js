import fs from 'fs/promises';
import path from 'path';
import { hashKey } from './utils.js';

const STATE_PATH = path.resolve('state/seen-items.json');
const MAX_SEEN = 5000;

export async function loadSeen() {
  try {
    const raw = await fs.readFile(STATE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return new Set(data.items || []);
  } catch {
    return new Set();
  }
}

export async function saveSeen(seen) {
  await fs.mkdir(path.dirname(STATE_PATH), { recursive: true });
  let arr = Array.from(seen);
  if (arr.length > MAX_SEEN) arr = arr.slice(-MAX_SEEN);
  await fs.writeFile(
    STATE_PATH,
    JSON.stringify({ updated_at: new Date().toISOString(), items: arr }, null, 2),
    'utf8'
  );
}

export function itemKey(item) {
  return hashKey(`${item.feed_id}|${item.guid || item.link || item.title}`);
}
