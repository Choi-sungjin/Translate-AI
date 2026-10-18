import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import path from 'node:path';
import { createBridge, loadState, stateDirectory } from '../bridge/server.mjs';
const require = createRequire(import.meta.url);
const env = { ...process.env, TRANSLATE_AI_LIVE_LOGIN: '1' };
let server;
if (process.argv.includes('--isolated')) {
  const state = await loadState(stateDirectory());
  server = createBridge({ token: state.token, cwd: path.join(stateDirectory(), 'translation-workspace') });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  env.TRANSLATE_AI_TEST_BRIDGE_PORT = String(server.address().port);
}
const close = () => { server?.closeAllConnections(); server?.close(); };
const child = spawn(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--project=login', ...process.argv.slice(2).filter(arg => arg !== '--isolated')], { stdio: 'inherit', env, windowsHide: true });
child.on('error', () => { close(); process.exitCode = 1; });
child.on('exit', code => { close(); process.exitCode = code ?? 1; });
