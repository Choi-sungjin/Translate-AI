import http from 'node:http';
import { createBridge } from '../bridge/server.mjs';
import { build } from 'esbuild';
const lexicalBundle = (await build({ entryPoints: ['tests/lexical-fixture.js'], bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"development"' } })).outputFiles[0].contents;
const requests = [];
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Translate AI — browser verification</title><style>body{font:18px/1.7 system-ui;margin:50px auto;max-width:900px;background:#f6f7f1;color:#203a32}main{padding:35px;background:white;border-radius:20px}input,textarea,[contenteditable]{display:block;font:18px/1.5 system-ui;width:85%;padding:14px;margin:15px 0;border:1px solid #a6b8ae;border-radius:8px}textarea{height:100px}.inputs{margin:30px}label{display:block}code{background:#eee}</style></head><body>
<main><h1>Read the world in two languages.</h1><p id="article">The weather is nice today. We can go for a walk in the park.</p><p id="linked">This paragraph keeps its <a href="#example" id="link">original link</a> and <strong>emphasis</strong>.</p><button id="original-button" onclick="this.dataset.clicks=Number(this.dataset.clicks||0)+1">Original button</button><pre><code id="code">const answer = 42;</code></pre><p hidden id="hidden">Hidden text must stay hidden.</p></main>
<section class="inputs"><label>Single-line text<input id="text" type="text"></label><label>Message<textarea id="message"></textarea></label><label>Editable text<div id="editable" contenteditable="true"></div></label><label>Structured editor<div id="rich" contenteditable="true"><b>Keep formatting</b></div></label><label>Password<input id="password" type="password"></label><label>Controlled input<input id="controlled" type="text"></label><output id="controlled-value"></output></section>
<script>document.querySelector('#controlled').addEventListener('input',e=>{document.querySelector('#controlled-value').textContent=e.target.value});document.addEventListener('submit',e=>{e.preventDefault();document.body.dataset.submitted='yes'});</script></body></html>`;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:18457');
  if (url.pathname === '/health') { res.end('ok'); return; }
  if (url.pathname === '/lexical.js') { res.setHeader('content-type', 'application/javascript'); res.end(lexicalBundle); return; }
  if (url.pathname === '/lexical') { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end('<!doctype html><html><meta charset="utf-8"><title>Lexical editor regression</title><body><main><div id="lexical" contenteditable="true" role="textbox" style="white-space:pre-wrap;border:1px solid;padding:20px"></div><output id="lexical-state"></output></main><script src="/lexical.js"></script></body></html>'); return; }
  if (url.pathname === '/requests') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(requests)); return; }
  if (url.pathname === '/api/chat/completions') {
    let body = ''; for await (const chunk of req) body += chunk;
    const data = JSON.parse(body), text = data.messages?.at(-1)?.content || '';
    requests.push({ text, model: data.model, authorization: req.headers.authorization || null });
    if (text.includes('slow')) await new Promise(r => setTimeout(r, 1000));
    if (text.includes('fail-api')) { res.writeHead(401); res.end('{}'); return; }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: `Translated: ${text}` } }] })); return;
  }
  res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(html);
});
server.listen(18457, '127.0.0.1');
if (process.env.TRANSLATE_AI_LIVE_LOGIN !== '1') {
  const bridge = createBridge({ token: 'b'.repeat(64), cwd: '.', status: async () => ({ loggedIn: true, method: 'ChatGPT', message: 'ChatGPT 계정 로그인 연결됨 (테스트)' }), translate: async ({ text }) => `Login translated: ${text}`, translateBatch: async ({ texts }) => texts.map(text => `Login translated: ${text}`) });
  bridge.listen(Number(process.env.TRANSLATE_AI_TEST_BRIDGE_PORT || 18459), '127.0.0.1');
}
