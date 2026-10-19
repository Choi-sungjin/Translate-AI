import { spawn, spawnSync } from 'node:child_process';
import { chmod, mkdir, open, readFile, readdir, readlink, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { stateDirectory } from '../bridge/server.mjs';
import { codexExecutable } from '../bridge/codex.mjs';

const root = await realpath(fileURLToPath(new URL('..', import.meta.url)));
const script = path.join(root, 'bridge/server.mjs');
const state = stateDirectory();
const url = 'http://127.0.0.1:18458';
const { version } = JSON.parse(await readFile(path.join(root, 'extension/manifest.json'), 'utf8'));
const [action, ...options] = process.argv.slice(2);

async function health() {
  try {
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) throw new Error('Invalid response');
    return await response.json();
  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') return null;
    throw new Error('Port 18458 is occupied or unresponsive. No process was stopped.');
  }
}
function checkHealth(value, current = true) {
  if (value?.name !== 'translate-ai-bridge') throw new Error('Port 18458 belongs to another application.');
  if (current && (value.version !== version || !value.modelSelection || !value.pageBatchTransport)) {
    throw new Error(`An incompatible bridge is running; v${version} is required. Run Restart-Translate-AI.sh from its installation folder.`);
  }
}
async function identity(pid) {
  try {
    const dir = `/proc/${pid}`;
    if ((await stat(dir)).uid !== process.getuid()) return null;
    const args = (await readFile(`${dir}/cmdline`, 'utf8')).split('\0').filter(Boolean);
    const executable = await readlink(`${dir}/exe`);
    if (!/^node(?:js)?$/.test(path.basename(executable)) || args.length !== 2) return null;
    const cwd = await readlink(`${dir}/cwd`);
    if (await realpath(path.resolve(cwd, args[1])) !== script) return null;
    const fields = (await readFile(`${dir}/stat`, 'utf8')).split(') ').at(-1).split(' ');
    if (fields[0] === 'Z') return null;
    return { pid: Number(pid), started: fields[19] };
  } catch { return null; }
}
async function ownedProcesses() {
  const processes = await Promise.all((await readdir('/proc')).filter(p => /^\d+$/.test(p)).map(identity));
  return processes.filter(Boolean);
}
async function ensureDependencies() {
  try { codexExecutable(); return; } catch { /* Install the locked production dependencies. */ }
  const result = spawnSync('npm', ['ci', '--omit=dev', '--ignore-scripts'], {
    cwd: root, stdio: 'inherit', env: { ...process.env, PATH: `${path.dirname(process.execPath)}:${process.env.PATH || ''}` }
  });
  if (result.status !== 0) throw new Error('Dependency installation failed. Check Node.js, npm and your network.');
  codexExecutable();
}
async function start() {
  const before = await health();
  if (before) {
    checkHealth(before);
    if ((await ownedProcesses()).length !== 1) throw new Error('A bridge from another folder is running. Stop it from that folder first.');
  } else {
    if ((await ownedProcesses()).length) throw new Error('This bridge is still starting or stopping. Retry shortly.');
    await ensureDependencies();
    await mkdir(state, { recursive: true, mode: 0o700 });
    const log = await open(path.join(state, 'bridge.log'), 'a', 0o600);
    let child;
    try {
      child = spawn(process.execPath, [script], { cwd: root, detached: true, stdio: ['ignore', log.fd, log.fd] });
      await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    } finally { await log.close(); }
    child.unref();
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      await delay(150);
      const after = await health();
      if (after) { checkHealth(after); if (await identity(child.pid)) { ready = true; break; } }
      if (child.exitCode !== null || child.signalCode) break;
    }
    if (!ready) throw new Error('Bridge startup failed. Check the local Translate-AI/bridge.log.');
  }
  console.log(`READY: Translate AI v${version} — ${url}/`);
  if (!options.includes('--no-open')) {
    const result = spawnSync('xdg-open', [`${url}/`], { stdio: 'ignore', timeout: 10000 });
    if (result.status !== 0) console.log(`Open ${url}/ in your browser to pair the extension.`);
  }
}
async function stop() {
  const before = await health();
  if (before) {
    checkHealth(before, false);
    if (before.active > 0 || before.queued > 0) throw new Error('Translations are still running. Wait for them to finish.');
  }
  const processes = await ownedProcesses();
  if (processes.length > 1) throw new Error('Multiple matching processes found. No process was stopped.');
  if (!processes.length) {
    if (before) throw new Error('A bridge from another folder is running. No process was stopped.');
    console.log('Translate AI is already stopped.'); return;
  }
  const expected = processes[0], current = await identity(expected.pid);
  if (!current || current.started !== expected.started) throw new Error('Process identity changed. No process was stopped.');
  process.kill(current.pid, 'SIGTERM');
  for (let attempt = 0; attempt < 50; attempt++) {
    if ((await identity(current.pid))?.started !== expected.started) { console.log('Translate AI bridge stopped.'); return; }
    await delay(100);
  }
  throw new Error('Bridge did not stop in time. No forced termination was attempted.');
}
function shellQuote(value) { return "'" + value.replaceAll("'", "'\\''") + "'"; }
function desktopQuote(value) { return '"' + value.replaceAll('\\', '\\\\\\\\').replaceAll('"', '\\\\"').replaceAll('`', '\\\\`').replaceAll('$', '\\\\$').replaceAll('%', '%%') + '"'; }
async function install() {
  await ensureDependencies();
  const bin = path.join(os.homedir(), '.local/bin');
  const applications = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local/share'), 'applications');
  await mkdir(bin, { recursive: true }); await mkdir(applications, { recursive: true });
  const launcher = path.join(bin, 'translate-ai');
  // Pin the working Node directory for GNOME launches, including installations managed by nvm.
  await writeFile(launcher, `#!/bin/sh\nexport PATH=${shellQuote(path.dirname(process.execPath))}:"$PATH"\nif [ "$#" -eq 0 ]; then set -- start; fi\nexec sh ${shellQuote(path.join(root, 'scripts/bridge-linux.sh'))} "$@"\n`, { mode: 0o755 });
  await chmod(launcher, 0o755);
  const exec = desktopQuote(launcher);
  await writeFile(path.join(applications, 'translate-ai.desktop'), `[Desktop Entry]\nType=Application\nName=Translate AI\nComment=Webpage and input translation\nExec=${exec} start\nIcon=accessories-dictionary\nTerminal=false\nCategories=Utility;\nActions=Restart;Stop;\n\n[Desktop Action Restart]\nName=Restart Translate AI\nExec=${exec} restart\n\n[Desktop Action Stop]\nName=Stop Translate AI\nExec=${exec} stop\n`);
  console.log('Installed Translate AI in the application menu. Keep this installation folder in place.');
  console.log(`Extension folder: ${path.join(root, 'extension')}`);
}
try {
  if (process.platform !== 'linux' || Number(process.versions.node.split('.')[0]) < 22) throw new Error('Linux and Node.js 22 or newer are required.');
  if (options.some(option => option !== '--no-open')) throw new Error('Unknown option. Supported: --no-open');
  if (action === 'install') await install();
  else if (action === 'start') await start();
  else if (action === 'stop') await stop();
  else if (action === 'restart') { await stop(); await start(); }
  else throw new Error('Usage: bridge-linux.sh start|stop|restart|install [--no-open]');
} catch (error) { console.error(error.message); process.exitCode = 1; }
