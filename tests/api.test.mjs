import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiFormat, isReasoningModel, buildApiRequest, parseApiResponse, apiErrorDetail, bridgeOffHint, OPENAI_MODEL_SUGGESTIONS } from '../extension/api.js';
import { validateSettings } from '../extension/settings.js';
import { validateHotkey, formatHotkey, hotkeyFromEvent, matchesHotkey } from '../extension/hotkeys.js';

const base = { provider: 'openai', apiUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-6.2-sol', serviceTier: '', reasoningEffort: 'auto' };

test('API format follows the URL path', () => {
  assert.equal(apiFormat('https://api.openai.com/v1/chat/completions'), 'chat');
  assert.equal(apiFormat('https://api.openai.com/v1/responses'), 'responses');
  assert.equal(apiFormat('http://127.0.0.1:1234/v1/responses/'), 'responses');
  assert.equal(apiFormat('https://example.com/responses-proxy/chat'), 'chat');
  assert.equal(apiFormat('not a url'), 'chat');
});

test('reasoning model detection', () => {
  for (const m of ['gpt-6.2-sol', 'gpt-6-luna', 'gpt-5.6-sol', 'openai/gpt-6.2-astra', 'o3', 'GPT-6.1-terra']) assert.equal(isReasoningModel(m), true, m);
  for (const m of ['gpt-4o', 'gpt-4.1-mini', 'gpt-oss-20b', 'llama3', 'qwen2.5', '', 'gpt-35-turbo', 'gpt-35-turbo-16k', 'gpt-5-chat-latest', 'omni-moderation', 'gpt-50x']) assert.equal(isReasoningModel(m), false, m);
  for (const m of ['azure/gpt-5', 'gpt-5', 'o4-mini', 'gpt-6.2-sol-2026-11-17', 'gpt-6.2-chat-latest', 'gpt-6-chat', 'gpt-6.2:latest', 'gpt-6.2_sol', 'ft:gpt-6.2-sol:org::id', 'gpt-10']) assert.equal(isReasoningModel(m), true, m);
});

test('GPT-6.2 chat request drops temperature, sends low effort and the chosen tier', () => {
  const { format, body } = buildApiRequest({ ...base, serviceTier: 'fast' }, 'SYS', 'hello');
  assert.equal(format, 'chat');
  assert.equal('temperature' in body, false);
  assert.equal(body.reasoning_effort, 'low');
  assert.equal(body.service_tier, 'fast');
  assert.deepEqual(body.messages, [{ role: 'system', content: 'SYS' }, { role: 'user', content: 'hello' }]);
});

test('default tier sends no service_tier; explicit effort wins', () => {
  const { body } = buildApiRequest({ ...base, reasoningEffort: 'medium' }, 'SYS', 'x');
  assert.equal('service_tier' in body, false);
  assert.equal(body.reasoning_effort, 'medium');
});

test('local non-reasoning model keeps temperature 0 and sends no reasoning field on auto', () => {
  const { body } = buildApiRequest({ ...base, apiUrl: 'http://127.0.0.1:11434/v1/chat/completions', model: 'llama3' }, 'SYS', 'x');
  assert.equal(body.temperature, 0);
  assert.equal('reasoning_effort' in body, false);
  assert.equal('service_tier' in body, false);
});

test('explicit effort on a non-reasoning-named model still drops temperature', () => {
  const { body } = buildApiRequest({ ...base, model: 'my-proxy-model', reasoningEffort: 'low' }, 'SYS', 'x');
  assert.equal('temperature' in body, false);
  assert.equal(body.reasoning_effort, 'low');
});

test('Responses request shape for Ultrafast', () => {
  const { format, body } = buildApiRequest({ ...base, apiUrl: 'https://api.openai.com/v1/responses', serviceTier: 'ultrafast' }, 'SYS', 'hello');
  assert.equal(format, 'responses');
  assert.deepEqual(body, {
    model: 'gpt-6.2-sol', store: false, service_tier: 'ultrafast', reasoning: { effort: 'low' },
    input: [{ role: 'developer', content: 'SYS' }, { role: 'user', content: 'hello' }]
  });
});

test('response parsing for both formats', () => {
  assert.deepEqual(parseApiResponse('chat', { choices: [{ message: { content: '안녕' } }], service_tier: 'fast' }), { text: '안녕', servedTier: 'fast' });
  assert.deepEqual(parseApiResponse('responses', { output_text: 'A' }), { text: 'A', servedTier: undefined });
  const raw = { service_tier: 'ultrafast', output: [
    { type: 'reasoning', summary: [] },
    { type: 'message', content: [{ type: 'output_text', text: '첫 ' }, { type: 'output_text', text: '문장' }] }
  ] };
  assert.deepEqual(parseApiResponse('responses', raw), { text: '첫 문장', servedTier: 'ultrafast' });
  assert.throws(() => parseApiResponse('responses', { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }), /max_output_tokens/);
  assert.throws(() => parseApiResponse('responses', { status: 'incomplete', incomplete_details: { reason: '<img src=x> leak' } }), err => !err.message.includes('leak'));
  assert.equal(parseApiResponse('chat', {}).text, undefined);
});

test('error detail is extracted and keys are masked', () => {
  assert.equal(apiErrorDetail(JSON.stringify({ error: { message: "Unsupported parameter: 'temperature' is not supported with this model." } })),
    "Unsupported parameter: 'temperature' is not supported with this model.");
  assert.equal(apiErrorDetail(JSON.stringify({ error: { message: 'Incorrect API key provided: sk-proj-abcdef123456. Find your key…' } })),
    'Incorrect API key provided: sk-…. Find your key…');
  assert.equal(apiErrorDetail('Invalid API key: gsk_abcdefghijklmnop1234', ['gsk_abcdefghijklmnop1234']), 'Invalid API key: [가림]');
  assert.equal(apiErrorDetail('Invalid token Bearer abcdef0123456789xyz'), 'Invalid token Bearer [가림]');
  assert.equal(apiErrorDetail(''), '');
  assert.equal(apiErrorDetail('{}'), '');
  assert.equal(apiErrorDetail('plain gateway error'), 'plain gateway error');
  assert.ok(apiErrorDetail('x'.repeat(1000)).length <= 301);
});

test('settings validation for speed and reasoning', () => {
  assert.equal(validateSettings({ ...base, serviceTier: 'fast' }).serviceTier, 'fast');
  assert.equal(validateSettings({}).reasoningEffort, 'auto');
  assert.equal(validateSettings({}).serviceTier, '');
  assert.throws(() => validateSettings({ ...base, serviceTier: 'turbo' }), /속도/);
  assert.throws(() => validateSettings({ ...base, serviceTier: ['fast'] }), /속도/);
  assert.throws(() => validateSettings({ ...base, reasoningEffort: 'none' }), /추론/);
  assert.throws(() => validateSettings({ ...base, serviceTier: 'ultrafast' }), /Responses/);
  assert.equal(validateSettings({ ...base, serviceTier: 'ultrafast', apiUrl: 'https://api.openai.com/v1/responses' }).serviceTier, 'ultrafast');
  // Other providers keep working even with an Ultrafast value left over.
  assert.equal(validateSettings({ ...base, provider: 'mymemory', serviceTier: 'ultrafast' }).provider, 'mymemory');
});

test('bridge-off hint names the right launcher per OS and offers alternatives', () => {
  assert.match(bridgeOffHint('linux'), /sh Start-Translate-AI\.sh/);
  assert.doesNotMatch(bridgeOffHint('linux'), /\.cmd/);
  assert.match(bridgeOffHint('win'), /Start-Translate-AI\.cmd/);
  assert.doesNotMatch(bridgeOffHint('mac'), /\.cmd|\.sh/);
  for (const os of ['linux', 'win', 'mac', '']) assert.match(bridgeOffHint(os), /꺼져 있습니다.*개인 AI API/);
});

test('latest GPT-6.2 Sol/Astra models and Codex speed/effort settings validate cleanly', () => {
  assert.ok('gpt-6.2-sol' in OPENAI_MODEL_SUGGESTIONS);
  assert.ok('gpt-6.2-astra' in OPENAI_MODEL_SUGGESTIONS);
  const s = validateSettings({ codexModel: 'gpt-6.2-sol', codexServiceTier: 'ultrafast', codexReasoningEffort: 'low', pageConcurrency: 12 });
  assert.equal(s.codexModel, 'gpt-6.2-sol');
  assert.equal(s.codexServiceTier, 'ultrafast');
  assert.equal(s.codexReasoningEffort, 'low');
  assert.equal(s.pageConcurrency, 12);
  assert.throws(() => validateSettings({ codexServiceTier: 'invalid' }), /속도/);
  assert.throws(() => validateSettings({ codexReasoningEffort: 'extreme' }), /추론/);
  assert.throws(() => validateSettings({ pageConcurrency: 99 }), /동시 번역/);
});

test('hotkey normalization, Korean IME code matching, and conflict validation', () => {
  assert.equal(validateHotkey(''), '');
  assert.equal(validateHotkey('alt+a'), 'Alt+KeyA');
  assert.equal(validateHotkey('Shift+Ctrl+KeyY'), 'Ctrl+Shift+KeyY');
  assert.equal(validateHotkey('F8'), 'F8');
  assert.equal(formatHotkey('Ctrl+Shift+KeyY'), 'Ctrl + Shift + Y');
  assert.equal(formatHotkey(''), '사용 안 함');
  assert.throws(() => validateHotkey('KeyA'), /조합|F1/);
  assert.throws(() => validateHotkey('Shift+KeyA'), /조합|F1/);
  assert.equal(hotkeyFromEvent({ code: 'AltLeft', altKey: true }), null);
  assert.equal(hotkeyFromEvent({ code: 'KeyQ', altKey: true, shiftKey: true }), 'Alt+Shift+KeyQ');
  // Matches physical key code even when Korean Hangul layout produces Hangul event.key
  assert.equal(matchesHotkey({ code: 'KeyI', key: 'ㅑ', altKey: true, ctrlKey: false, shiftKey: false, metaKey: false, repeat: false }, 'Alt+KeyI'), true);
  assert.equal(matchesHotkey({ code: 'KeyI', key: 'i', altKey: true, shiftKey: true, repeat: false }, 'Alt+KeyI'), false);
  assert.equal(matchesHotkey({ code: 'KeyI', key: 'i', altKey: true, repeat: true }, 'Alt+KeyI'), false);
  assert.throws(() => validateSettings({ pageHotkey: 'Alt+KeyQ', inputHotkey: 'Alt+KeyQ' }), /서로 다르게/);
});
