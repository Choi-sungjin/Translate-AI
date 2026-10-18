import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
await mkdir('dist', { recursive: true });
const manifest = JSON.parse(await readFile('extension/manifest.json', 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('Invalid package version');
const name = `Translate-AI-${manifest.version}.zip`;
function archive(name, files, cwd) {
  let result;
  if (process.platform === 'win32') {
    const quote = text => "'" + text.replaceAll("'", "''") + "'";
    const command = `Compress-Archive -LiteralPath @(${files.map(quote).join(',')}) -DestinationPath ${quote(path.resolve('dist', name))} -Force`;
    result = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], { cwd, encoding: 'utf8' });
  } else result = spawnSync('zip', ['-r', path.resolve('dist', name), ...files], { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
}
archive(name, await readdir('extension'), 'extension');
const desktop = `Translate-AI-${manifest.version}-desktop.zip`;
// Explicit source allowlist: never include credentials, node_modules, profiles or local artifacts.
archive(desktop, ['extension', 'bridge', 'scripts', 'tests', 'docs', 'README.md', 'package.json', 'package-lock.json', 'playwright.config.js', 'Start-Translate-AI.cmd', 'Stop-Translate-AI.cmd', 'Restart-Translate-AI.cmd'], '.');
const hashes = [];
for (const file of [name, desktop]) {
  const zip = await readFile(path.join('dist', file));
  hashes.push(`${createHash('sha256').update(zip).digest('hex')}  ${file}`);
  console.log(`${file}: ${zip.length} bytes.`);
}
await writeFile(path.join('dist', 'SHA256SUMS.txt'), hashes.join('\n') + '\n');
