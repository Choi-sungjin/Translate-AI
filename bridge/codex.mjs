import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const instructions = fileURLToPath(new URL('./translation-instructions.txt', import.meta.url));
const languages = { ko: 'Korean', en: 'English', ja: 'Japanese', zh: 'Chinese', de: 'German', fr: 'French', es: 'Spanish', vi: 'Vietnamese' };
const disabledFeatures = ['shell_tool', 'shell_snapshot', 'apps', 'plugins', 'remote_plugin', 'memories', 'multi_agent', 'browser_use', 'computer_use', 'image_generation', 'view_image', 'skill_search', 'hooks', 'workspace_dependencies', 'code_mode_host', 'goals', 'sleep_tool'];

export function codexExecutable() {
  const platform = process.platform, arch = process.arch;
  const triple = { win32: `${arch === 'arm64' ? 'aarch64' : 'x86_64'}-pc-windows-msvc`, linux: `${arch === 'arm64' ? 'aarch64' : 'x86_64'}-unknown-linux-musl`, darwin: `${arch === 'arm64' ? 'aarch64' : 'x86_64'}-apple-darwin` }[platform];
  if (!triple || !['x64', 'arm64'].includes(arch)) throw new Error('이 운영체제는 아직 지원하지 않습니다.');
  try {
    const root = path.dirname(require.resolve('@openai/codex/package.json'));
    const nativePackage = require.resolve(`@openai/codex-${platform}-${arch}/package.json`, { paths: [root] });
    const vendor = path.join(path.dirname(nativePackage), 'vendor', triple);
    for (const dir of ['bin', 'codex']) {
      const executable = path.join(vendor, dir, platform === 'win32' ? 'codex.exe' : 'codex');
      if (existsSync(executable)) return executable;
    }
  } catch { /* Installation help below deliberately excludes filesystem details. */ }
  throw new Error('Codex 실행 파일이 없습니다. Translate AI 폴더에서 npm ci를 실행하세요.');
}
function loginEnvironment() {
  const env = { ...process.env };
  // This provider is specifically the cached ChatGPT login, not an inherited API key.
  for (const key of ['OPENAI_API_KEY', 'CODEX_API_KEY', 'OPENAI_BASE_URL', 'CODEX_ACCESS_TOKEN', 'CODEX_WIF_TOKEN_FILE', 'CODEX_WIF_PROVIDER_ID', 'OPENAI_IDENTITY_TOKEN_FILE', 'OPENAI_WORKLOAD_IDENTITY_PROVIDER']) delete env[key];
  return env;
}
function run(args, { cwd, input = '', timeout = 90000 } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try { child = spawn(codexExecutable(), args, { cwd, env: loginEnvironment(), windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] }); }
    catch (error) { reject(error); return; }
    let stdout = '', stderr = '', failure;
    const timer = setTimeout(() => { failure = new Error('ChatGPT 번역 시간이 초과되었습니다. 원문은 유지됩니다.'); child.kill(); }, timeout);
    function collect(which, data) {
      if (which === 'out') stdout += data; else stderr += data;
      if (stdout.length + stderr.length > 2_000_000) { failure = new Error('CLI 응답이 너무 큽니다.'); child.kill(); }
    }
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', data => collect('out', data)); child.stderr.on('data', data => collect('err', data));
    child.on('error', () => { clearTimeout(timer); reject(new Error('Codex를 실행하지 못했습니다. 설치 상태를 확인하세요.')); });
    child.on('close', code => { clearTimeout(timer); if (failure) reject(failure); else resolve({ code, stdout, stderr }); });
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}
export async function loginStatus(cwd) {
  const result = await run(['login', 'status'], { cwd, timeout: 15000 });
  const loggedIn = result.code === 0 && /logged in using chatgpt/i.test(result.stdout + result.stderr);
  return { loggedIn, method: loggedIn ? 'ChatGPT' : null, message: loggedIn ? 'ChatGPT 계정 로그인 연결됨' : 'Codex에서 ChatGPT로 로그인하세요. 프로젝트 터미널에서 npx codex login을 실행하세요.' };
}
export function translationArgs() {
  const args = ['exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only', '--json', '--color', 'never'];
  for (const feature of disabledFeatures) args.push('--disable', feature);
  args.push('--enable', 'skip_host_skill_discovery', '-c', 'suppress_unstable_features_warning=true', '-c', 'project_doc_max_bytes=0', '-c', 'web_search="disabled"', '-c', 'model_reasoning_effort="low"', '-c', `model_instructions_file=${JSON.stringify(instructions)}`, '-');
  return args;
}
export function parseTranslation(output, code) {
  const events = output.split(/\r?\n/).filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  if (code !== 0 || events.some(e => e.type === 'turn.failed' || e.type === 'error')) throw new Error('ChatGPT 요청에 실패했습니다. 로그인·계정 사용 한도를 확인하세요.');
  const executedTool = events.some(e => ['item.started', 'item.completed'].includes(e.type) && e.item && !['agent_message', 'reasoning', 'error', 'plan'].includes(e.item.type));
  if (executedTool) throw new Error('번역 외 동작이 감지되어 결과를 사용하지 않았습니다.');
  const messages = events.filter(e => e.type === 'item.completed' && e.item?.type === 'agent_message');
  const text = messages.at(-1)?.item.text;
  if (!events.some(e => e.type === 'turn.completed') || typeof text !== 'string' || !text.trim() || text.length > 60000) throw new Error('ChatGPT 번역 결과가 올바르지 않습니다.');
  return text;
}
export async function translateWithCodex({ text, target }, cwd) {
  if (typeof text !== 'string' || !text.trim() || text.length > 12000 || !Object.hasOwn(languages, target)) throw new Error('번역 요청을 확인하세요.');
  await mkdir(cwd, { recursive: true });
  const status = await loginStatus(cwd);
  if (!status.loggedIn) throw new Error(status.message);
  const result = await run(translationArgs(), { cwd, input: JSON.stringify({ targetLanguage: languages[target], sourceText: text }) });
  return parseTranslation(result.stdout, result.code);
}
