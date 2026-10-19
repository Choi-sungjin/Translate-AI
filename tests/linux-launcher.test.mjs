import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import { cp, mkdir, mkdtemp, readFile, rm, stat, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { codexExecutable } from '../bridge/codex.mjs';
const root = process.cwd();
function run(script, env, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', [path.join(cwd, script), '--no-open'], { cwd: '/', env });
    let output = ''; child.stdout.on('data', d => output += d); child.stderr.on('data', d => output += d);
    child.on('error', reject); child.on('close', code => resolve({ code, output }));
  });
}
async function listener(body) {
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); });
  server.listen(18458, '127.0.0.1'); await once(server, 'listening');
  return async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); };
}
test('Linux launcher: real lifecycle, spaces, foreign ports, busy bridge and menu installation', { skip: process.platform !== 'linux', timeout: 60000 }, async t => {
  codexExecutable(); // Fail before spawning anything if dependency installation is incomplete.
  // Never stop a user's existing bridge: these integration tests require a free standard port.
  const probe = await listener({}); await probe();
  const temp = await mkdtemp(path.join(os.tmpdir(), 'translate ai Linux '));
  const project = path.join(temp, 'installation with spaces'); await mkdir(project);
  for (const name of ['extension', 'bridge', 'scripts', 'package.json', 'package-lock.json', 'Start-Translate-AI.sh', 'Stop-Translate-AI.sh', 'Restart-Translate-AI.sh', 'Install-Translate-AI.sh']) await cp(path.join(root, name), path.join(project, name), { recursive: true });
  await symlink(path.join(root, 'node_modules'), path.join(project, 'node_modules'));
  const env = { ...process.env, HOME: path.join(temp, 'home'), XDG_DATA_HOME: path.join(temp, 'data') };
  const launch = script => run(script, env, project);
  t.after(async () => { await launch('Stop-Translate-AI.sh'); await rm(temp, { recursive: true, force: true }); });
  for (const script of ['Start-Translate-AI.sh', 'Start-Translate-AI.sh', 'Restart-Translate-AI.sh']) {
    const result = await launch(script); assert.equal(result.code, 0, result.output); assert.match(result.output, /READY/);
    const health = await (await fetch('http://127.0.0.1:18458/health')).json();
    assert.equal(health.version, JSON.parse(await readFile('extension/manifest.json')).version);
  }
  const stateFile = path.join(env.XDG_DATA_HOME, 'Translate-AI/bridge-state.json');
  const state = await readFile(stateFile, 'utf8'); assert.match(JSON.parse(state).token, /^[a-f0-9]{64}$/);
  assert.equal((await stat(stateFile)).mode & 0o777, 0o600);
  const lock = spawn('flock', [path.join(env.XDG_DATA_HOME, 'Translate-AI/launcher.lock'), 'sh', '-c', 'echo locked; cat >/dev/null']);
  await once(lock.stdout, 'data');
  try { assert.equal((await launch('Start-Translate-AI.sh')).code, 73, 'concurrent launch must fail without spawning'); }
  finally { lock.stdin.end(); await once(lock, 'close'); }
  // A second checkout must not stop or reuse the first checkout's process.
  for (const script of ['Start-Translate-AI.sh', 'Stop-Translate-AI.sh', 'Restart-Translate-AI.sh']) {
    const result = await run(script, env); assert.notEqual(result.code, 0); assert.match(result.output, /another folder/);
  }
  for (const script of ['Stop-Translate-AI.sh', 'Stop-Translate-AI.sh']) {
    const result = await launch(script); assert.equal(result.code, 0, result.output);
  }
  for (const body of [{ name: 'unrelated-app' }, { name: 'translate-ai-bridge', version: '0.0.1', active: 1, queued: 0 }]) {
    const close = await listener(body);
    try {
      for (const script of ['Start-Translate-AI.sh', 'Stop-Translate-AI.sh', 'Restart-Translate-AI.sh']) {
        const result = await launch(script); assert.notEqual(result.code, 0, result.output);
        assert.deepEqual(await (await fetch('http://127.0.0.1:18458/health')).json(), body);
      }
    } finally { await close(); }
  }
  const installed = await launch('Install-Translate-AI.sh'); assert.equal(installed.code, 0, installed.output);
  assert.match(await readFile(path.join(env.XDG_DATA_HOME, 'applications/translate-ai.desktop'), 'utf8'), /Desktop Action Stop/);
  assert.match(await readFile(path.join(env.HOME, '.local/bin/translate-ai'), 'utf8'), /installation with spaces/);
  assert.equal(await readFile(stateFile, 'utf8'), state, 'connection code must survive restart and install');
  // Exercise the production signal handler twice while an admitted request is
  // still arriving. Repeated stop attempts must not force-kill the connection.
  assert.equal((await launch('Start-Translate-AI.sh')).code, 0);
  let request;
  const reply = new Promise((resolve, reject) => {
    request = http.request('http://127.0.0.1:18458/v1/translate', { method: 'POST', headers: { Authorization: `Bearer ${JSON.parse(state).token}`, 'Content-Type': 'application/json' } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
    request.on('error', reject); request.write('{');
  });
  // Establish the request before issuing the first shutdown.
  await once(request, 'socket').then(socket => socket[0].connecting ? once(socket[0], 'connect') : undefined);
  await fetch('http://127.0.0.1:18458/health');
  for (let attempt = 0; attempt < 2; attempt++) {
    const stopping = await launch('Stop-Translate-AI.sh');
    assert.notEqual(stopping.code, 0); assert.match(stopping.output, /did not stop in time/);
  }
  request.end('invalid}'); assert.equal(await reply, 400);
  const invalid = await run('scripts/bridge-linux.sh', env, project); assert.notEqual(invalid.code, 0);
});
