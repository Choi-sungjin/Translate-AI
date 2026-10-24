import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { stateDirectory } from '../bridge/server.mjs';
import { test, expect, BASE, toggle, triple, typeInput } from './fixtures.js';

test('LIVE LOGIN: selecting each Luna model applies to page and input translation', async ({ context, extensionId, page }, testInfo) => {
  test.skip(process.env.TRANSLATE_AI_LIVE_LOGIN !== '1', 'Local login test only.');
  test.setTimeout(240000);
  const { token } = JSON.parse(await readFile(path.join(stateDirectory(), 'bridge-state.json'), 'utf8'));
  const evidence = [];
  for (const model of ['gpt-6-luna', 'gpt-5.6-luna']) {
    const options = await context.newPage(); await options.goto(`chrome-extension://${extensionId}/options.html`);
    await options.locator('#bridgeToken').fill(token); await options.locator('#codexModel').selectOption(model);
    await options.getByRole('button', { name: '설정 저장', exact: true }).click(); await expect(options.locator('#status')).toContainText('저장했습니다');
    await options.reload(); await expect(options.locator('#codexModel')).toHaveValue(model); await options.close();
    await page.goto(BASE); await page.bringToFront();
    await toggle(context, extensionId, page);
    const paragraph = page.locator('#article .tai-translation');
    await expect(paragraph).toHaveAttribute('title', `번역 모델: ${model}`, { timeout: 120000 });
    await expect(paragraph).toContainText(/[가-힣]/);
    const source = '모델을 변경한 뒤에도 검색창의 원문을 복구할 수 있습니다.';
    const input = await typeInput(page, '#text', source); await triple(page);
    await expect(input).toHaveValue(/[A-Za-z]/, { timeout: 120000 });
    const result = { model, page: await paragraph.textContent(), input: await input.inputValue() };
    await expect(page.locator('#translate-ai-status')).toContainText(model === 'gpt-6-luna' ? 'GPT-6 Luna' : 'GPT-5.6 Luna');
    await page.screenshot({ path: testInfo.outputPath(`${model}-selected.png`), fullPage: true });
    await page.getByRole('button', { name: '원문 복구', exact: true }).click(); await expect(input).toHaveValue(source);
    await toggle(context, extensionId, page); await expect(page.locator('.tai-translation')).toHaveCount(0);
    evidence.push({ ...result, inputRestored: true, pageRestored: true });
  }
  console.log(JSON.stringify({ environment: 'Isolated Chrome for Testing', actualChatGPT: true, evidence }));
});

test('LIVE LOGIN: NVIDIA modal search keeps translation and restore controls usable', async ({ context, extensionId, page }, testInfo) => {
  test.skip(process.env.TRANSLATE_AI_LIVE_LOGIN !== '1', 'Local login test only.');
  test.setTimeout(180000);
  const { token } = JSON.parse(await readFile(path.join(stateDirectory(), 'bridge-state.json'), 'utf8'));
  const options = await context.newPage(); await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.locator('#bridgeToken').fill(token);
  await options.locator('#codexModel').selectOption('gpt-6-luna');
  await options.getByRole('button', { name: '설정 저장', exact: true }).click();
  await expect(options.locator('#status')).toContainText('저장했습니다'); await options.close();
  await page.goto('https://docs.isaacsim.omniverse.nvidia.com/latest/ros2_tutorials/index.html');
  const cookieReload = page.waitForEvent('domcontentloaded', { timeout: 10000 }).catch(() => {});
  await page.getByText('Reject Optional', { exact: true }).click({ timeout: 5000 }).catch(() => {});
  await cookieReload;
  await page.waitForLoadState('load');
  await page.getByRole('button', { name: 'Search', exact: true }).click({ timeout: 15000 });
  const original = '아이작심에서 로스 연결 방법을 알려주세요.';
  const input = await typeInput(page, 'dialog[open] input[type="search"]', original);
  const started = Date.now(); await triple(page);
  await expect(input).toHaveValue(/[A-Za-z]/, { timeout: 120000 });
  const translated = await input.inputValue(); expect(translated).not.toMatch(/[가-힣]/);
  await expect(input).toBeFocused();
  const restore = page.getByRole('button', { name: '원문 복구', exact: true });
  await expect(restore).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('nvidia-modal-translated.png'), fullPage: true });
  await restore.focus(); await page.keyboard.press('Enter'); await expect(input).toHaveValue(original);
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('nvidia-modal-restored.png'), fullPage: true });
  console.log(JSON.stringify({ environment:'Isolated Chrome for Testing', provider:'Actual ChatGPT login through Codex CLI', model:'gpt-6-luna', original, translated, elapsedMs:Date.now()-started, restored:true, restoredWithKeyboardFocus:true, modalRemainsOpen:true }));
});

test('LOGIN SETUP: extension opens local pairing dashboard with real login status', async ({ context, extensionId }) => {
  test.skip(process.env.TRANSLATE_AI_LIVE_LOGIN !== '1', 'Local login test only.');
  const options = await context.newPage(); await options.goto(`chrome-extension://${extensionId}/options.html`);
  const opened = context.waitForEvent('page'); await options.locator('#open-bridge').click(); const dashboard = await opened;
  await dashboard.waitForLoadState(); await expect(dashboard.locator('#status')).toContainText('ChatGPT 계정 로그인 연결됨');
  expect(await dashboard.locator('#token').inputValue()).toMatch(/^[a-f0-9]{64}$/);
  await dashboard.close(); await options.close();
});

test('LIVE LOGIN: ChatGPT OAuth via official CLI, webpage and triple-space input', async ({ context, extensionId, page }, testInfo) => {
  test.skip(process.env.TRANSLATE_AI_LIVE_LOGIN !== '1', 'Run npm run test:login after starting the local bridge.');
  test.setTimeout(180000);
  const { token } = JSON.parse(await readFile(path.join(stateDirectory(), 'bridge-state.json'), 'utf8'));
  const options = await context.newPage(); await options.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(options.locator('#provider')).toHaveValue('codex');
  await options.locator('#bridgeToken').fill(token);
  await options.getByRole('button', { name: '설정 저장', exact: true }).click(); await expect(options.locator('#status')).toContainText('저장했습니다');
  await options.locator('#bridge-status').click(); await expect(options.locator('#status')).toContainText('ChatGPT 계정 로그인 연결됨');
  await options.locator('#bridgeToken').evaluate(el => el.value = ''); // Never capture a local pairing secret.
  await options.screenshot({ path: testInfo.outputPath('chatgpt-settings.png'), fullPage: true });
  await options.close();
  await page.goto(BASE); await page.bringToFront();
  await page.evaluate(() => { document.querySelector('h1').remove(); document.querySelector('#linked').remove(); });
  const started = Date.now(); await toggle(context, extensionId, page);
  const translated = page.locator('#article .tai-translation');
  await expect(translated).not.toHaveClass(/tai-loading/, { timeout: 120000 }); await expect(translated).not.toHaveClass(/tai-error/); await expect(translated).toContainText(/[가-힣]/);
  const pageMs = Date.now() - started;
  expect(await page.locator('#article').evaluate(el => el.firstChild.textContent)).toContain('The weather is nice today.');
  const input = await typeInput(page, '#message', '오늘 날씨가 좋습니다.'); const inputStarted = Date.now(); await triple(page);
  await expect(input).toHaveValue(/[A-Za-z]/, { timeout: 120000 }); expect(await input.inputValue()).not.toMatch(/[가-힣]/);
  const evidence = { browser: context.browser()?.version(), provider: 'Official Codex CLI 0.162.1 with existing ChatGPT login', mocked: false, apiKeyUsed: false, pageSource: 'The weather is nice today. We can go for a walk in the park.', pageTranslation: await translated.textContent(), pageElapsedMs: pageMs, inputSource: '오늘 날씨가 좋습니다.', inputTranslation: await input.inputValue(), inputElapsedMs: Date.now() - inputStarted };
  await page.screenshot({ path: testInfo.outputPath('chatgpt-bilingual-and-input.png'), fullPage: true });
  await page.getByRole('button', { name: '원문 복구', exact: true }).click(); await expect(input).toHaveValue('오늘 날씨가 좋습니다.');
  evidence.originalRestored = true;
  await testInfo.attach('chatgpt-login-evidence', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  console.log(JSON.stringify(evidence));
});

test('LIVE LOGIN: real ChatGPT translation updates Lexical model and restores Korean input', async ({ context, extensionId, page }, testInfo) => {
  test.skip(process.env.TRANSLATE_AI_LIVE_LOGIN !== '1', 'Local login test only.');
  test.setTimeout(180000);
  const { token } = JSON.parse(await readFile(path.join(stateDirectory(), 'bridge-state.json'), 'utf8'));
  const options = await context.newPage(); await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.locator('#bridgeToken').fill(token);
  await options.getByRole('button', { name: '설정 저장', exact: true }).click();
  await expect(options.locator('#status')).toContainText('저장했습니다'); await options.close();
  await page.goto(`${BASE}/lexical`); await page.bringToFront();
  const original = '안녕하세요. 오늘 날씨가 좋습니다.';
  const input = await typeInput(page, '#lexical', original); const started = Date.now(); await triple(page);
  await expect(page.locator('#translate-ai-status')).toContainText('입력창을 번역했습니다', { timeout: 120000 });
  const translated = await input.textContent(); expect(translated).toMatch(/[A-Za-z]/); expect(translated).not.toMatch(/[가-힣]/);
  await expect(page.locator('#lexical-state')).toHaveText(translated);
  const elapsedMs = Date.now() - started;
  await page.screenshot({ path: testInfo.outputPath('chatgpt-lexical.png'), fullPage: true });
  await page.getByRole('button', { name: '원문 복구', exact: true }).click();
  await expect(page.locator('#translate-ai-status')).toContainText('원문을 복구했습니다');
  await expect(page.locator('#lexical-state')).toHaveText(original);
  console.log(JSON.stringify({ environment: 'Chrome for Testing, local real Lexical editor', livePerplexityVerified: false, provider: 'ChatGPT via official Codex CLI', original, translated, elapsedMs, restored: true }));
});

test('LIVE LOGIN: NVIDIA ROS 2 page keeps original content and links with batched Korean translation', async ({ context, extensionId, page }, testInfo) => {
  test.skip(process.env.TRANSLATE_AI_LIVE_LOGIN !== '1', 'Local login test only.');
  test.setTimeout(240000);
  const { token } = JSON.parse(await readFile(path.join(stateDirectory(), 'bridge-state.json'), 'utf8'));
  const options = await context.newPage(); await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.locator('#bridgeToken').fill(token);
  await options.getByRole('button', { name: '설정 저장', exact: true }).click();
  await expect(options.locator('#status')).toContainText('저장했습니다'); await options.close();
  await page.goto('https://docs.isaacsim.omniverse.nvidia.com/latest/ros2_tutorials/index.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main')).toContainText('ROS (Robot Operating System)');
  // Optional public-site cookie dialog may otherwise cover the evidence image.
  const cookieReload = page.waitForEvent('domcontentloaded', { timeout: 10000 }).catch(() => {});
  await page.getByText('Reject Optional', { exact: true }).click({ timeout: 5000 }).catch(() => {});
  await cookieReload;
  await page.waitForLoadState('load');
  await expect(page.locator('main')).toContainText('ROS (Robot Operating System)');
  const original = await page.locator('main').textContent();
  const links = await page.locator('main a').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')));
  const started = Date.now(); await toggle(context, extensionId, page);
  const done = page.locator('main .tai-translation:not(.tai-loading):not(.tai-error)');
  const typing = await context.newPage(); await typing.goto(BASE); await typing.bringToFront();
  const input = await typeInput(typing, '#message', '문서를 읽으면서 질문을 번역합니다.');
  const inputStarted = Date.now(); await triple(typing);
  await expect(input).toHaveValue(/[A-Za-z]/, { timeout: 120000 });
  expect(await input.inputValue()).not.toMatch(/[가-힣]/);
  const inputElapsedMs = Date.now() - inputStarted, paragraphsDoneWhenInputFinished = await done.count();
  await typing.getByRole('button', { name: '원문 복구', exact: true }).click();
  await expect(input).toHaveValue('문서를 읽으면서 질문을 번역합니다.');
  await typing.close(); await page.bringToFront();
  await expect.poll(() => done.count(), { timeout: 120000 }).toBeGreaterThanOrEqual(12);
  const firstTwelveMs = Date.now() - started;
  // Scroll the real public document so IntersectionObserver can discover its lower blocks.
  for (let y = 600; y < await page.evaluate(() => document.body.scrollHeight); y += 600) {
    await page.evaluate(top => scrollTo(0, top), y);
    await page.waitForTimeout(100);
  }
  await expect(page.locator('main .tai-loading')).toHaveCount(0, { timeout: 120000 });
  await expect(page.locator('main .tai-error')).toHaveCount(0);
  const translations = await done.allTextContents();
  expect(translations.filter(t => /[가-힣]/.test(t)).length).toBeGreaterThanOrEqual(12);
  expect(await page.locator('main').evaluate(el => { const copy = el.cloneNode(true); copy.querySelectorAll('[data-tai-owned]').forEach(n => n.remove()); return copy.textContent; })).toBe(original);
  expect(await page.locator('main a').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')))).toEqual(links);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('nvidia-bilingual.png'), fullPage: true });
  await toggle(context, extensionId, page);
  await expect(page.locator('.tai-translation')).toHaveCount(0);
  expect(await page.locator('main').textContent()).toBe(original);
  const evidence = { environment: 'Isolated Chrome for Testing; not the user Comet browser', url: page.url(), provider: 'Actual ChatGPT login through Codex CLI', firstTwelveMs, completedMs: Date.now() - started, translated: translations.length, originalPreserved: true, linksPreserved: true, originalRestored: true, concurrentInput: { inputElapsedMs, paragraphsDoneWhenInputFinished, restored: true } };
  await testInfo.attach('nvidia-login-evidence', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  console.log(JSON.stringify(evidence));
});
