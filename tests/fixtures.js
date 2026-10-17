import { test as base, expect, chromium } from '@playwright/test';
import path from 'node:path';
export const BASE = 'http://127.0.0.1:18457';
export const test = base.extend({
  context: async ({}, use) => {
    const extension = path.resolve('extension');
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium', headless: true, viewport: { width: 1280, height: 900 },
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
    });
    await use(context); await context.close();
  },
  extensionId: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await use(new URL(worker.url()).host);
  },
  page: async ({ context }, use) => { const page = await context.newPage(); await use(page); }
});
export { expect };
export async function setupMock(context, extensionId) {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.locator('#provider').selectOption('openai');
  await options.locator('#apiUrl').fill(`${BASE}/api/chat/completions`);
  await options.locator('#model').fill('fixture-model');
  await options.locator('#apiKey').fill('synthetic-test-key');
  await options.getByRole('button', { name: '설정 저장', exact: true }).click();
  await expect(options.locator('#status')).toContainText('저장했습니다');
  await options.close();
}
export async function toggle(context, extensionId, target) {
  // Uses the extension's actual runtime transport, never a mocked chrome object.
  const driver = await context.newPage();
  await driver.goto(`chrome-extension://${extensionId}/popup.html`);
  await driver.evaluate(async url => {
    const tabs = await chrome.tabs.query({}); const tab = tabs.find(t => t.url === url);
    const reply = await chrome.tabs.sendMessage(tab.id, { type: 'TAI_TOGGLE_PAGE' }, { frameId: 0 });
    if (!reply.ok) throw new Error(reply.error);
  }, target.url());
  await driver.close(); await target.bringToFront();
}
export async function triple(page, gap = 40) {
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Space'); if (i < 2) await page.waitForTimeout(gap); }
}
export async function typeInput(page, selector, text) {
  // document_idle injection can finish after page.load on a busy CI runner.
  // Wait for the real content-script transport rather than an arbitrary sleep.
  const worker = page.context().serviceWorkers()[0];
  await expect.poll(() => worker.evaluate(async url => {
    const tab = (await chrome.tabs.query({})).find(t => t.url === url);
    if (!tab) return false;
    try { const status = await chrome.tabs.sendMessage(tab.id, { type: 'TAI_PAGE_STATUS' }, { frameId: 0 }); return typeof status?.enabled === 'boolean'; }
    catch { return false; }
  }, page.url())).toBe(true);
  const input = page.locator(selector); await input.fill(text); await input.focus(); return input;
}
