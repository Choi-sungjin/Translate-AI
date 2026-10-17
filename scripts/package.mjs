import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
await mkdir('dist', { recursive: true });
const manifest = JSON.parse(await readFile('extension/manifest.json', 'utf8'));
const name = `Translate-AI-${manifest.version}.zip`;
// Packaging uses only the distributable extension directory, never profiles or settings.
if (process.platform === 'win32') {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path './extension/*' -DestinationPath './dist/${name}' -Force`], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
} else {
  const result = spawnSync('zip', ['-r', path.resolve('dist', name), '.'], { cwd: 'extension', encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
}
const zip = await readFile(path.join('dist', name));
await writeFile(path.join('dist', 'SHA256SUMS.txt'), `${createHash('sha256').update(zip).digest('hex')}  ${name}\n`);
console.log(`${name}: ${zip.length} bytes, extension files only.`);
