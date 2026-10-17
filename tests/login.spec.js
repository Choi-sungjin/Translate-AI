import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { stateDirectory } from '../bridge/server.mjs';
import { test, expect, BASE, toggle, triple, typeInput } from './fixtures.js';

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
