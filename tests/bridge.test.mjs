import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { createBridge } from '../bridge/server.mjs';
import { parseTranslation, parseBatchTranslation, translationArgs } from '../bridge/codex.mjs';
import { createTranslationQueue } from '../bridge/queue.mjs';
import { createPageBatcher } from '../extension/page-batches.js';
import { validateSettings } from '../extension/settings.js';

const token = 'a'.repeat(64);
async function fixture(t) {
  const requests = [];
  const server = createBridge({ token, cwd: '.', status: async () => ({ loggedIn: true, method: 'ChatGPT' }), translate: async data => { requests.push(data); return '번역 결과'; }, translateBatch: async data => { requests.push(data); return data.texts.map(t => `번역 ${t}`); } });
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
  assert.deepEqual(requests, [{ text: 'Hello', target: 'ko', model: 'gpt-6.1-sol' }]);
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

test('legacy settings retain Sol; selected model reaches CLI as an allowlisted argument', () => {
  assert.equal(validateSettings({}).codexModel, 'gpt-6.1-sol');
  for (const model of ['gpt-6.1-sol', 'gpt-6-luna', 'gpt-5.6-luna']) {
    assert.equal(validateSettings({ codexModel: model }).codexModel, model);
    const args = translationArgs(true, model);
    assert.equal(args[args.indexOf('--model') + 1], model);
    assert.ok(args.includes('model_reasoning_effort="low"'));
  }
  for (const model of [null, {}, '--config=unsafe', 'gpt-unknown']) {
    assert.throws(() => translationArgs(false, model));
    assert.throws(() => validateSettings({ codexModel: model }));
  }
});

test('bridge advertises selection support and reports the model used by both routes', async t => {
  const { url, headers, requests } = await fixture(t);
  assert.equal((await fetch(`${url}/v1/capabilities`)).status, 401);
  assert.ok((await (await fetch(`${url}/v1/capabilities`, { headers })).json()).models.includes('gpt-6-luna'));
  for (const batch of [false, true]) {
    const response = await fetch(`${url}/v1/${batch ? 'translate-batch' : 'translate'}`, {
      method: 'POST', headers, body: JSON.stringify({ ...(batch ? { texts: ['first', 'second'] } : { text: 'first' }), target: 'ko', mode: batch ? 'page' : 'input', model: 'gpt-6-luna' })
    });
    const result = await response.json(); assert.equal(result.model, 'gpt-6-luna'); assert.equal(result.reasoningEffort, 'low');
  }
  assert.ok(requests.every(r => r.model === 'gpt-6-luna'));
  const response = await fetch(`${url}/v1/translate`, { method: 'POST', headers, body: JSON.stringify({ text: 'valid', target: 'ko', mode: 'input', model: 'gpt-unknown' }) });
  assert.equal(response.status, 400); assert.equal(requests.length, 2);
});

test('bridge and browser batches never combine requests for different models', async () => {
  const bridgeCalls = [];
  const convert = async data => { bridgeCalls.push(data); return data.texts ? data.texts.map(text => `${data.model}: ${text}`) : `${data.model}: ${data.text}`; };
  const queue = createTranslationQueue({ cwd: '.', translate: convert, translateBatch: convert });
  const models = ['gpt-6-luna', 'gpt-6.1-sol', 'gpt-6-luna', 'gpt-6.1-sol'];
  assert.deepEqual(await Promise.all(models.map((model, i) => queue.schedule({ text: String(i), target: 'ko', model }, 'page'))), models.map((model, i) => `${model}: ${i}`));
  assert.equal(bridgeCalls.length, 2); assert.ok(bridgeCalls.every(c => c.texts.length === 2));
  const browserCalls = [];
  const batch = createPageBatcher(async (settings, data) => { browserCalls.push(data); assert.equal(settings.codexModel, data.model); return { texts: data.texts.map(text => `${data.model}: ${text}`) }; }, 1);
  assert.deepEqual(await Promise.all(models.map((codexModel, i) => batch(String(i), 'ko', { bridgeToken: token, codexModel }))), models.map((model, i) => `${model}: ${i}`));
  assert.equal(browserCalls.length, 2);
});

test('batch parser maps by id and refuses missing, duplicate or unknown paragraphs', () => {
  const output = translations => JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify({ translations }) } }) + '\n' + JSON.stringify({ type: 'turn.completed' });
  assert.deepEqual(parseBatchTranslation(output([{ id: 1, text: '둘' }, { id: 0, text: '하나' }]), 0, 2), ['하나', '둘']);
  for (const items of [[{ id: 0, text: '하나' }], [{ id: 0, text: '하나' }, { id: 0, text: '둘' }], [{ id: 0, text: '하나' }, { id: 2, text: '둘' }], [{ id: 0, text: '' }, { id: 1, text: '둘' }]]) {
    assert.throws(() => parseBatchTranslation(output(items), 0, 2));
  }
  assert.ok(translationArgs(true).includes('--output-schema'));
});

test('12 page requests use one batch and return the matching paragraph', async () => {
  const calls = [];
  const queue = createTranslationQueue({ cwd: '.', translate: async () => { throw Error('unexpected single'); }, translateBatch: async data => { calls.push(data); return data.texts.map(t => `번역 ${t}`); } });
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => queue.schedule({ text: `paragraph ${i}`, target: 'ko' }, 'page')));
  assert.equal(calls.length, 1); assert.equal(calls[0].texts.length, 12);
  assert.deepEqual(results, Array.from({ length: 12 }, (_, i) => `번역 paragraph ${i}`));
});

test('input completes while a page batch is still running', async () => {
  let finish, started;
  const running = new Promise(r => { started = r; });
  const queue = createTranslationQueue({ cwd: '.', translate: async ({ text }) => `번역 ${text}`, translateBatch: () => { started(); return new Promise(r => { finish = r; }); } });
  const pages = Promise.all(['page1', 'page2'].map(text => queue.schedule({ text, target: 'ko' }, 'page')));
  await running;
  try {
    assert.equal(await Promise.race([queue.schedule({ text: 'typing', target: 'en' }, 'input'), new Promise((_, reject) => setTimeout(() => reject(Error('input blocked by page')), 500))]), '번역 typing');
  } finally { finish(['페이지1', '페이지2']); }
  await pages;
});

test('batch limits preserve language boundaries and cancel queued work', async () => {
  const calls = [], convert = async data => { calls.push(data); return data.texts ? data.texts.map(t => `번역 ${t}`) : `번역 ${data.text}`; };
  const queue = createTranslationQueue({ cwd: '.', translate: convert, translateBatch: convert });
  const cancelled = queue.schedule({ text: 'cancelled', target: 'ko' }, 'page', () => true);
  const rejected = assert.rejects(cancelled, /취소/);
  await Promise.all(['ko', 'en', 'ko'].map((target, i) => queue.schedule({ text: `${i}`.repeat(7000), target }, 'page')));
  await rejected;
  assert.equal(calls.length, 3); assert.ok(calls.every(c => c.text.length === 7000));
});

test('an invalid batch fails all its jobs, then the queue recovers', async () => {
  const queue = createTranslationQueue({ cwd: '.', translate: async () => '정상', translateBatch: async () => ['missing item'] });
  const results = await Promise.allSettled(['first', 'second'].map(text => queue.schedule({ text, target: 'ko' }, 'page')));
  assert.ok(results.every(r => r.status === 'rejected'));
  assert.equal(await queue.schedule({ text: 'next', target: 'ko' }, 'page'), '정상');
});

test('batch HTTP endpoint authenticates, validates and returns 12 matching paragraphs', async t => {
  const { url, headers, requests } = await fixture(t);
  const texts = Array.from({ length: 12 }, (_, i) => `paragraph ${i}`);
  const post = data => fetch(`${url}/v1/translate-batch`, { method: 'POST', headers, body: JSON.stringify(data) });
  const result = await post({ texts, target: 'ko', mode: 'page' });
  assert.deepEqual((await result.json()).texts, texts.map(t => `번역 ${t}`));
  assert.equal(requests.length, 1);
  for (const data of [{ texts: [], target: 'ko', mode: 'page' }, { texts: Array(13).fill('x'), target: 'ko', mode: 'page' }, { texts: ['x'.repeat(12001)], target: 'ko', mode: 'page' }, { texts: ['valid'], target: 'ko', mode: 'input' }, { texts: [null], target: 'ko', mode: 'page' }]) {
    assert.equal((await post(data)).status, 400);
  }
  assert.equal(requests.length, 1);
});

test('browser batcher sends only one HTTP page request at once and preserves all results', async () => {
  const calls = []; let active = 0;
  const batch = createPageBatcher(async (settings, data) => {
    assert.equal(active++, 0); calls.push({ token: settings.bridgeToken, ...data });
    await new Promise(r => setTimeout(r, 5)); active--;
    return { texts: data.texts.map(t => `${data.target}: ${t}`) };
  }, 1);
  const jobs = Array.from({ length: 25 }, (_, i) => batch(`text ${i}`, i === 24 ? 'en' : 'ko', { bridgeToken: 'test' }));
  assert.deepEqual(await Promise.all(jobs), Array.from({ length: 25 }, (_, i) => `${i === 24 ? 'en' : 'ko'}: text ${i}`));
  assert.deepEqual(calls.map(c => c.texts.length), [12, 12, 1]);
});

test('browser batcher rejects incomplete responses and continues with the next group', async () => {
  let first = true;
  const batch = createPageBatcher(async (settings, data) => { if (first) { first = false; return { texts: [] }; } return { texts: data.texts }; }, 1);
  await assert.rejects(batch('first', 'ko', { bridgeToken: 'test' }), /묶음/);
  assert.equal(await batch('second', 'en', { bridgeToken: 'test' }), 'second');
});
