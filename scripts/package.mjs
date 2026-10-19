import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root = process.cwd(), output = path.join(root, 'dist');
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile('extension/manifest.json', 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('Invalid package version');
const tracked = spawnSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
if (tracked.status !== 0) throw new Error('Run packaging from the Git source checkout.');
const files = tracked.stdout.split('\0').filter(Boolean);
const common = files.filter(f => /^(extension|bridge|docs)\//.test(f) || ['README.md', 'package.json', 'package-lock.json'].includes(f));
const packages = [
  { name: `Translate-AI-${manifest.version}-extension.zip`, files: files.filter(f => f.startsWith('extension/')), extension: true },
  { name: `Translate-AI-${manifest.version}-windows.zip`, files: [...common, ...files.filter(f => /^(Start|Stop|Restart)-Translate-AI\.cmd$/.test(f) || /^scripts\/(start|stop|restart)-bridge\.ps1$/.test(f))] },
  { name: `Translate-AI-${manifest.version}-linux.zip`, files: [...common, ...files.filter(f => /^(Start|Stop|Restart|Install)-Translate-AI\.sh$/.test(f) || /^scripts\/(bridge-linux\.sh|linux-launcher\.mjs)$/.test(f))] }
];
const hashes = [];
for (const item of packages) {
  const stage = await mkdtemp(path.join(os.tmpdir(), 'translate-ai-package-'));
  try {
    for (const file of item.files) {
      const destination = path.join(stage, item.extension ? file.slice('extension/'.length) : file);
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(path.join(root, file), destination);
    }
    // Always recreate the archive: zip's default update mode can retain removed files.
    const destination = path.join(output, item.name);
    await rm(destination, { force: true });
    let result;
    if (process.platform === 'win32') {
      const quote = text => "'" + text.replaceAll("'", "''") + "'";
      result = spawnSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path * -DestinationPath ${quote(destination)} -Force`], { cwd: stage, encoding: 'utf8' });
    } else result = spawnSync('zip', ['-qr', destination, '.'], { cwd: stage, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.error?.message || result.stderr);
    const bytes = await readFile(destination);
    hashes.push(`${createHash('sha256').update(bytes).digest('hex')}  ${item.name}`);
    console.log(`${item.name}: ${bytes.length} bytes.`);
  } finally { await rm(stage, { recursive: true, force: true }); }
}
await writeFile(path.join(output, 'SHA256SUMS.txt'), hashes.join('\n') + '\n');
