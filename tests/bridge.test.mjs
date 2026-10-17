import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { createBridge } from '../bridge/server.mjs';
import { parseTranslation, translationArgs } from '../bridge/codex.mjs';

const token = 'a'.repeat(64);
async function fixture(t) {
  const requests = [];
  const server = createBridge({ token, cwd: '.', status: async () => ({ loggedIn: true, method: 'ChatGPT' }), translate: async data => { requests.push(data); return '번역 결과'; } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  return { url, headers, requests };
}
test('bridge rejects missing credentials, hostile web origins and rebinding Host', async t => {
  const { url, headers } = await fixture(t);
  assert.equal((await fetch(`${url}/v1/status`)).status, 401);
  assert.equal((await fetch(`${url}/v1/status`, { headers: { ...headers, Origin: 'https://evil.example' } })).status, 403);
  const status = await new Promise((resolve, reject) => {
    const request = http.get(`${url}/v1/status`, { headers: { ...headers, Host: 'evil.example' } }, response => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject);
  });
  assert.equal(status, 403);
});
test('pairing token is not exposed through extension CORS or cross-site navigation', async t => {
  const { url } = await fixture(t);
  assert.equal((await fetch(url, { headers: { Origin: `chrome-extension://${'a'.repeat(32)}` } })).status, 403);
  assert.equal((await fetch(url, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  const response = await fetch(url);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.match(await response.text(), /로컬 연결 코드/);
});
test('authenticated extension can check login and translate only validated text', async t => {
  const { url, headers, requests } = await fixture(t);
  headers.Origin = `chrome-extension://${'a'.repeat(32)}`;
  const status = await fetch(`${url}/v1/status`, { headers });
  assert.equal((await status.json()).loggedIn, true);
  const response = await fetch(`${url}/v1/translate`, { method: 'POST', headers, body: JSON.stringify({ text: 'Hello', target: 'ko', mode: 'input', command: 'ignored' }) });
  assert.equal((await response.json()).text, '번역 결과');
  assert.deepEqual(requests, [{ text: 'Hello', target: 'ko' }]);
});
test('bridge refuses malformed, oversized and unsupported requests', async t => {
  const { url, headers, requests } = await fixture(t);
  for (const body of ['null', '{', JSON.stringify({ text: 'x'.repeat(12001), target: 'ko', mode: 'input' }), JSON.stringify({ text: 'Hello', target: '--command', mode: 'input' })]) {
    assert.equal((await fetch(`${url}/v1/translate`, { method: 'POST', headers, body })).status, 400);
  }
  assert.equal(requests.length, 0);
});
test('CLI response parser needs successful final output and refuses tool execution', () => {
  const events = [{ type: 'item.completed', item: { type: 'agent_message', text: '번역' } }, { type: 'turn.completed' }];
  const encoded = values => values.map(v => JSON.stringify(v)).join('\n');
  assert.equal(parseTranslation(encoded(events), 0), '번역');
  assert.throws(() => parseTranslation(encoded(events), 1));
  assert.throws(() => parseTranslation(encoded(events.slice(0, 1)), 0));
  assert.throws(() => parseTranslation(encoded([...events, { type: 'item.completed', item: { type: 'command_execution' } }]), 0));
});
test('translation launches with explicit isolation and no arbitrary shell command', () => {
  const args = translationArgs();
  for (const flag of ['--ignore-user-config', '--ephemeral', '--sandbox', 'read-only', 'shell_tool', 'apps', 'hooks', 'multi_agent', 'web_search="disabled"', 'project_doc_max_bytes=0']) assert.ok(args.includes(flag));
  assert.equal(args.at(-1), '-');
  assert.ok(!args.includes('--dangerously-bypass-approvals-and-sandbox'));
});
