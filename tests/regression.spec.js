import { test, expect, BASE, setupMock, toggle, triple, typeInput } from './fixtures.js';
test.beforeEach(async ({ context, extensionId, page }) => {
  await setupMock(context, extensionId); await page.goto(BASE); await page.bringToFront();
});

test('bilingual paragraphs preserve original DOM, links and controls; toggle is reversible', async ({ context, extensionId, page }) => {
  const original = await page.locator('#article').textContent();
  await toggle(context, extensionId, page);
  await expect(page.locator('#article .tai-translation')).toHaveText(`Translated: ${original}`);
  await expect(page.locator('#link')).toHaveAttribute('href', '#example');
  await page.locator('#original-button').click(); await expect(page.locator('#original-button')).toHaveAttribute('data-clicks', '1');
  await expect(page.locator('#hidden .tai-translation,#code .tai-translation,.inputs .tai-translation')).toHaveCount(0);
  for (let i = 0; i < 2; i++) {
    await toggle(context, extensionId, page); await expect(page.locator('.tai-translation')).toHaveCount(0);
    await expect(page.locator('#article')).toHaveText(original);
    await toggle(context, extensionId, page); await expect(page.locator('#article .tai-translation')).toHaveCount(1);
    await expect(page.locator('#article .tai-translation')).toHaveText(`Translated: ${original}`);
  }
});

test('dynamic paragraphs and changed text are translated once', async ({ context, extensionId, page }) => {
  await toggle(context, extensionId, page);
  await page.evaluate(() => { const p = document.createElement('p'); p.id = 'dynamic'; p.textContent = 'A newly loaded paragraph.'; document.querySelector('main').append(p); });
  await expect(page.locator('#dynamic .tai-translation')).toHaveText('Translated: A newly loaded paragraph.');
  await page.locator('#dynamic').evaluate(el => { el.firstChild.nodeValue = 'The text has changed.'; });
  await expect(page.locator('#dynamic .tai-translation')).toHaveText('Translated: The text has changed.');
  await expect(page.locator('#dynamic .tai-translation')).toHaveCount(1);
});

test('Space x3 translates textarea once and restores exact original', async ({ page, request }) => {
  const original = '  안녕하세요.\n만나서 반갑습니다.  ';
  const field = await typeInput(page, '#message', original); await triple(page);
  await expect(field).toHaveValue(`  Translated: ${original.trim()}  `);
  await page.getByRole('button', { name: '원문 복구', exact: true }).click(); await expect(field).toHaveValue(original);
  const requests = await (await request.get(`${BASE}/requests`)).json();
  expect(requests.filter(r => r.text === original.trim())).toHaveLength(1);
  expect(await page.getAttribute('body', 'data-submitted')).toBeNull();
});

test('single-line and plain contenteditable receive translations', async ({ page }) => {
  const input = await typeInput(page, '#text', '첫 번째 문장'); await triple(page); await expect(input).toHaveValue('Translated: 첫 번째 문장');
  const editable = await typeInput(page, '#editable', '두 번째 문장'); await triple(page); await expect(editable).toHaveText('Translated: 두 번째 문장');
});

test('native input setter notifies framework-style controlled state', async ({ page }) => {
  const input = await typeInput(page, '#controlled', '상태 갱신 확인'); await triple(page);
  await expect(input).toHaveValue('Translated: 상태 갱신 확인'); await expect(page.locator('#controlled-value')).toHaveText('Translated: 상태 갱신 확인');
});

test('two spaces, slow spaces and key repeats do not translate', async ({ page }) => {
  const input = await typeInput(page, '#text', 'Do not trigger');
  await page.keyboard.press('Space'); await page.keyboard.press('Space'); await page.waitForTimeout(450);
  await expect(input).toHaveValue('Do not trigger  ');
  await input.fill('Slow'); await triple(page, 400); await expect(input).toHaveValue('Slow   ');
  await input.fill('Repeat'); await page.keyboard.down('Space'); await page.keyboard.down('Space'); await page.keyboard.down('Space'); await page.keyboard.up('Space');
  await page.waitForTimeout(300); await expect(input).toHaveValue('Repeat   ');
});

test('IME composition guards (simulated events) reset cleanly', async ({ page }) => {
  const input = await typeInput(page, '#text', '조합');
  await input.dispatchEvent('compositionstart', { data: '합' }); await triple(page);
  await expect(input).toHaveValue('조합   ');
  await input.dispatchEvent('compositionend', { data: '합' });
  await input.fill('조합 완료'); await triple(page); await expect(input).toHaveValue('Translated: 조합 완료');
});

test('late response never overwrites newer typing', async ({ page }) => {
  const input = await typeInput(page, '#text', 'slow first request'); await triple(page);
  await expect(page.locator('#translate-ai-status')).toContainText('번역하고');
  await input.fill('새로 쓴 내용'); await page.waitForTimeout(1600);
  await expect(input).toHaveValue('새로 쓴 내용'); await expect(page.locator('#translate-ai-status')).toContainText('바뀌어');
});

test('API failure preserves exact original and shows actionable error', async ({ page }) => {
  const original = '  fail-api test  '; const input = await typeInput(page, '#text', original); await triple(page);
  await expect(page.locator('#translate-ai-status')).toContainText('인증에 실패'); await expect(input).toHaveValue(original);
});

test('password and rich editors are never flattened or sent', async ({ page, request }) => {
  const password = await typeInput(page, '#password', 'private-password'); await triple(page); await expect(password).toHaveValue('private-password   ');
  await page.locator('#rich').click(); await page.keyboard.press('End'); await triple(page);
  await expect(page.locator('#rich b')).toHaveCount(1);
  const requests = await (await request.get(`${BASE}/requests`)).json();
  expect(requests.some(r => r.text.includes('private-password') || r.text.includes('Keep formatting'))).toBe(false);
});

test('turning off page translation ignores pending responses', async ({ context, extensionId, page }) => {
  await page.locator('#article').evaluate(el => { el.textContent = 'slow page response'; });
  await toggle(context, extensionId, page); await toggle(context, extensionId, page); await page.waitForTimeout(1500);
  await expect(page.locator('.tai-translation')).toHaveCount(0); await expect(page.locator('#article')).toHaveText('slow page response');
});

test('settings persist; disabled shortcut and safe API validation work', async ({ context, extensionId, page }) => {
  const options = await context.newPage(); await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.locator('#inputEnabled').uncheck(); await options.getByRole('button', { name: '설정 저장', exact: true }).click(); await expect(options.locator('#status')).toContainText('저장했습니다');
  await options.reload(); await expect(options.locator('#inputEnabled')).not.toBeChecked();
  await options.locator('#apiUrl').fill('http://example.com/chat/completions'); await options.getByRole('button', { name: '설정 저장', exact: true }).click(); await expect(options.locator('#status')).toContainText('HTTPS');
  await options.close(); await page.bringToFront(); const input = await typeInput(page, '#text', 'disabled shortcut'); await triple(page); await expect(input).toHaveValue('disabled shortcut   ');
});

test('page progress cannot hide input restoration while another translation completes', async ({ context, extensionId, page }) => {
  await page.locator('#article').evaluate(el => { el.textContent = 'slow concurrent page'; });
  await toggle(context, extensionId, page);
  const input = await typeInput(page, '#text', '원문 복구 유지'); await triple(page);
  await expect(input).toHaveValue('Translated: 원문 복구 유지');
  await expect(page.locator('#article .tai-translation')).toHaveText('Translated: slow concurrent page');
  await page.getByRole('button', { name: '원문 복구', exact: true }).click(); await expect(input).toHaveValue('원문 복구 유지');
});
