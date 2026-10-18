import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { loginStatus, translateWithCodex, translateBatchWithCodex } from './codex.mjs';
import { createTranslationQueue } from './queue.mjs';
import { CODEX_MODELS, validateCodexModel } from '../extension/models.js';

export const PORT = 18458;
export const stateDirectory = () => path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'), 'Translate-AI');
export async function loadState(dir) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, 'bridge-state.json');
  try {
    const state = JSON.parse(await readFile(file, 'utf8'));
    if (/^[a-f0-9]{64}$/.test(state.token)) return state;
    throw new Error('로컬 연결 코드 파일이 손상되었습니다.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const state = { token: randomBytes(32).toString('hex') };
    await writeFile(file, JSON.stringify(state), { mode: 0o600, flag: 'wx' }); return state;
  }
}
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
function dashboard(token) {
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Translate AI · ChatGPT 연결</title><style>body{font:16px/1.75 system-ui;background:#f5f7f0;color:#19382f;max-width:700px;margin:70px auto;padding:24px}section{background:white;border:1px solid #d6dfd2;border-radius:20px;padding:30px}h1{line-height:1.3}input{box-sizing:border-box;width:100%;padding:12px;font:14px monospace;border:1px solid #a7beb2;border-radius:8px}button{background:#215c49;color:white;padding:12px 18px;border:0;border-radius:9px;cursor:pointer}small{color:#587166}code{background:#eef2e9;padding:2px 5px}</style><section><small>TRANSLATE AI · 이 PC에서만 연결</small><h1>내 ChatGPT 로그인으로<br>읽고, 쓰고, 번역하세요.</h1><p id="status">로그인 상태 확인 중…</p><h2>확장 프로그램 연결 코드</h2><p>아래 코드를 복사해 확장 설정의 <b>ChatGPT 계정 로그인 → 로컬 연결 코드</b>에 붙여넣고 저장하세요.</p><input id="token" readonly value="${escape(token)}" aria-label="로컬 연결 코드"><p><button id="copy">연결 코드 복사</button> <span id="copied"></span></p><p>이 코드는 이 PC의 확장 연결에만 쓰입니다. ChatGPT OAuth 토큰이나 API 키가 아닙니다.</p><hr><p>로그인이 필요하면 Translate AI 폴더의 터미널에서 <code>npx codex login</code>을 실행하세요. 공식 로그인 화면은 사용자가 직접 완료합니다.</p><p><small>번역은 ChatGPT 계정의 Codex 사용량에 포함됩니다. 연결 프로그램이 실행 중이어야 합니다. 계정 인증은 공식 Codex CLI가 처리합니다.</small></p></section><script src="/dashboard.js"></script></html>`;
}
const dashboardJS = `const token=document.querySelector('#token').value;document.querySelector('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(token);document.querySelector('#copied').textContent='복사했습니다';}catch{document.querySelector('#token').select();document.querySelector('#copied').textContent='Ctrl+C로 복사하세요';}};fetch('/v1/status',{headers:{Authorization:'Bearer '+token}}).then(r=>r.json()).then(s=>{document.querySelector('#status').textContent=s.message||s.error;}).catch(()=>{document.querySelector('#status').textContent='연결 상태를 확인하지 못했습니다.'});`;
export function createBridge({ token, cwd, translate = translateWithCodex, translateBatch = translateBatchWithCodex, status = loginStatus }) {
  const queue = createTranslationQueue({ translate, translateBatch, cwd });
  const server = http.createServer(async (req, res) => {
    const authority = `127.0.0.1:${server.address().port}`;
    const localOrigin = `http://${authority}`;
    const origin = req.headers.origin;
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
    const json = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
    if (req.headers.host !== authority || (origin && origin !== localOrigin && !/^chrome-extension:\/\/[a-p]{32}$/.test(origin))) { json(403, { error: '허용되지 않은 접근입니다.' }); return; }
    if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
    if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST'); res.writeHead(204); res.end(); return; }
    if (req.method === 'GET' && req.url === '/health') { json(200, { name: 'translate-ai-bridge', version: '1.3.0', pageBatchTransport: true, modelSelection: true, ...queue.stats() }); return; }
    if (req.method === 'GET' && ['/', '/dashboard.js'].includes(req.url)) {
      // Pairing code is only available to same-origin local navigation, never CORS.
      if ((origin && origin !== localOrigin) || !['none', 'same-origin', undefined].includes(req.headers['sec-fetch-site'])) { json(403, { error: '로컬 연결 화면을 직접 여세요.' }); return; }
      res.removeHeader('Access-Control-Allow-Origin');
      res.writeHead(200, { 'Content-Type': req.url === '/' ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8' });
      res.end(req.url === '/' ? dashboard(token) : dashboardJS); return;
    }
    const supplied = Buffer.from(req.headers.authorization?.replace(/^Bearer /, '') || ''); const expected = Buffer.from(token);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) { json(401, { error: '로컬 연결 코드가 다릅니다. 연결 화면의 코드를 다시 저장하세요.' }); return; }
    try {
      if (req.method === 'GET' && req.url === '/v1/status') { json(200, { ...await status(cwd), modelSelection: true }); return; }
      if (req.method === 'GET' && req.url === '/v1/capabilities') { json(200, { modelSelection: true, models: Object.keys(CODEX_MODELS) }); return; }
      const batch = req.url === '/v1/translate-batch';
      if (req.method !== 'POST' || (!batch && req.url !== '/v1/translate')) { json(404, { error: '지원하지 않는 요청입니다.' }); return; }
      if (!req.headers['content-type']?.startsWith('application/json')) { json(415, { error: 'JSON 요청이 필요합니다.' }); return; }
      let bytes = 0, chunks = [];
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 100000) { json(413, { error: '요청이 너무 큽니다.' }); return; } chunks.push(chunk); }
      let data; try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { json(400, { error: '잘못된 JSON입니다.' }); return; }
      let model; try { model = validateCodexModel(data?.model); } catch (error) { json(400, { error: error.message }); return; }
      const texts = batch ? data?.texts : [data?.text];
      if (!data || !Array.isArray(texts) || !texts.length || texts.length > 12 || texts.some(t => typeof t !== 'string' || !t.trim()) || texts.reduce((n, t) => n + t.length, 0) > 12000 || !['ko', 'en', 'ja', 'zh', 'de', 'fr', 'es', 'vi'].includes(data.target) || !(batch ? data.mode === 'page' : ['page', 'input', 'test'].includes(data.mode))) { json(400, { error: '번역 요청을 확인하세요.' }); return; }
      const started = Date.now();
      // Flush response headers immediately; periodic JSON whitespace keeps MV3 fetch responsive.
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.write(' ');
      const heartbeat = setInterval(() => { if (!res.destroyed) res.write(' '); }, 10000);
      try {
        const translated = await Promise.all(texts.map(text => queue.schedule({ text, target: data.target, model }, data.mode, () => res.destroyed)));
        res.end(JSON.stringify({ ...(batch ? { texts: translated } : { text: translated[0] }), provider: 'codex', model, reasoningEffort: 'low', elapsedMs: Date.now() - started }));
      } finally { clearInterval(heartbeat); }
    } catch (error) {
      const body = { error: error.message || '로컬 연결 오류입니다.' };
      if (res.headersSent) res.end(JSON.stringify(body)); else json(503, body);
    }
  });
  server.requestTimeout = 15000;
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = stateDirectory(), state = await loadState(dir), cwd = path.join(dir, 'translation-workspace');
  await mkdir(cwd, { recursive: true });
  const server = createBridge({ token: state.token, cwd });
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? '로컬 연결이 이미 실행 중이거나 포트 18458을 사용 중입니다.' : '로컬 연결을 시작하지 못했습니다.'); process.exitCode = 1; });
  server.listen(PORT, '127.0.0.1', () => console.log(`Translate AI: http://127.0.0.1:${PORT}/ — ChatGPT login stays in Codex CLI.`));
}
