import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const { version } = JSON.parse(await readFile('extension/manifest.json'));
test('release archives have separate launchers, required runtime files and matching checksums', { skip: process.platform !== 'linux' }, async () => {
  const sums = await readFile('dist/SHA256SUMS.txt', 'utf8');
  for (const platform of ['windows', 'linux', 'extension']) {
    const name = `Translate-AI-${version}-${platform}.zip`, archive = `dist/${name}`;
    const listed = spawnSync('unzip', ['-Z1', archive], { encoding: 'utf8' }); assert.equal(listed.status, 0, listed.stderr);
    const files = listed.stdout.trim().split('\n');
    assert.ok(files.includes(platform === 'extension' ? 'manifest.json' : 'extension/manifest.json'));
    assert.ok(!files.some(f => /(^|\/)(node_modules|profiles|user-prompt\.md|\.env|bridge-state\.json|auth\.json)(\/|$)/.test(f)));
    if (platform !== 'extension') {
      for (const f of ['bridge/server.mjs', 'bridge/codex.mjs', 'bridge/queue.mjs', 'package-lock.json']) assert.ok(files.includes(f), f);
      assert.ok(files.includes(`Start-Translate-AI.${platform === 'linux' ? 'sh' : 'cmd'}`));
      assert.ok(!files.includes(`Start-Translate-AI.${platform === 'linux' ? 'cmd' : 'sh'}`));
    }
    const digest = createHash('sha256').update(await readFile(archive)).digest('hex');
    assert.ok(sums.includes(`${digest}  ${name}`));
  }
});
