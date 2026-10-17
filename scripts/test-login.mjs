import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const child = spawn(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--project=login'], { stdio: 'inherit', env: { ...process.env, TRANSLATE_AI_LIVE_LOGIN: '1' }, windowsHide: true });
child.on('error', () => process.exitCode = 1);
child.on('exit', code => process.exitCode = code ?? 1);
