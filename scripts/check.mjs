import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name); if (entry.isDirectory()) result.push(...await files(p)); else result.push(p);
  }
  return result;
}
let count = 0;
for (const file of [...await files('extension'), ...await files('bridge'), ...await files('scripts'), ...await files('tests'), 'playwright.config.js']) {
  if (/\.(m?js)$/.test(file)) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr); count++;
  }
}
const manifest = JSON.parse(await readFile('extension/manifest.json', 'utf8'));
for (const file of [manifest.background.service_worker, manifest.action.default_popup, manifest.options_page, ...manifest.content_scripts.flatMap(c => [...c.js, ...c.css])]) await readFile(path.join('extension', file));
console.log(`Syntax OK: ${count} JavaScript files; manifest assets exist.`);
