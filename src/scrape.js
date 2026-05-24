import { log } from './utils.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run(scriptName) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, scriptName)], {
      stdio: 'inherit',
      env: process.env
    });
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptName} exited with code ${code}`));
    });
  });
}

async function main() {
  log('INFO', '=== Running both scrapers in sequence ===');
  log('INFO', '--- 1/2: Cheerio (static HTTP) ---');
  await run('scrape-cheerio.js');
  log('INFO', '--- 2/2: Playwright (real browser) ---');
  await run('scrape-playwright.js');
  log('INFO', '=== All scrapers complete ===');
}

main().catch(err => {
  log('FATAL', err.message);
  process.exit(1);
});
