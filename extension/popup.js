import { LANGUAGES } from './settings.js';
import { CODEX_MODELS, CODEX_SERVICE_TIERS } from './models.js';
import { SERVICE_TIERS } from './api.js';
import { formatHotkey } from './hotkeys.js';

document.querySelector('#version').textContent = `v${chrome.runtime.getManifest().version}`;
const button = document.querySelector('#toggle'), status = document.querySelector('#status');
const model = document.querySelector('#codexModel');
const codexTier = document.querySelector('#codexServiceTier');
const apiTier = document.querySelector('#popupApiTier');

for (const [value, label] of Object.entries(CODEX_MODELS)) model.add(new Option(label, value));
for (const [value, label] of Object.entries(CODEX_SERVICE_TIERS)) codexTier.add(new Option(label, value));
for (const [value, label] of Object.entries(SERVICE_TIERS)) apiTier.add(new Option(label, value));

model.addEventListener('change', async () => {
  model.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({ type: 'TAI_SET_CODEX_MODEL', model: model.value });
    if (!response?.ok) throw new Error(response?.error || '모델을 저장하지 못했습니다.');
    status.classList.remove('error');
    status.textContent = `${CODEX_MODELS[response.data]} 저장 완료 · 다음 번역부터 적용됩니다.`;
  } catch (error) { status.textContent = error.message; status.classList.add('error'); }
  finally { model.disabled = false; }
});

async function saveQuickSpeed(selectEl, labels) {
  selectEl.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({ type: 'TAI_SET_QUICK_SPEED', tier: selectEl.value });
    if (!response?.ok) throw new Error(response?.error || '속도 설정을 저장하지 못했습니다.');
    status.classList.remove('error');
    status.textContent = `속도(${labels[selectEl.value] || '기본'}) 저장 완료 · 다음 번역부터 적용됩니다.`;
  } catch (error) { status.textContent = error.message; status.classList.add('error'); }
  finally { selectEl.disabled = false; }
}
codexTier.addEventListener('change', () => void saveQuickSpeed(codexTier, CODEX_SERVICE_TIERS));
apiTier.addEventListener('change', () => void saveQuickSpeed(apiTier, SERVICE_TIERS));

let tab;
async function queryPageState(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'TAI_PAGE_STATUS' }, { frameId: 0 });
  } catch {
    const injected = await chrome.runtime.sendMessage({ type: 'TAI_ENSURE_TAB', tabId });
    if (!injected?.ok || !injected.data) throw new Error('inject-failed');
    return chrome.tabs.sendMessage(tabId, { type: 'TAI_PAGE_STATUS' }, { frameId: 0 });
  }
}

async function update() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const response = await chrome.runtime.sendMessage({ type: 'TAI_SETTINGS' });
  if (response?.ok) {
    const s = response.data;
    document.querySelector('#model-field').hidden = s.provider !== 'codex';
    document.querySelector('#api-quick-field').hidden = s.provider !== 'openai';
    model.value = s.codexModel; model.disabled = false;
    codexTier.value = s.codexServiceTier || ''; codexTier.disabled = false;
    apiTier.value = s.serviceTier || ''; apiTier.disabled = false;
    document.querySelector('#language').textContent = `${LANGUAGES[s.pageLanguage]}로 읽기`;
    document.querySelector('#input-language').textContent = s.inputEnabled ? `${LANGUAGES[s.inputLanguage]}로` : '입력 번역 꺼짐 · 설정에서 활성화하면';
    document.querySelector('#page-hotkey-badge').textContent = formatHotkey(s.pageHotkey);
    document.querySelector('#input-hotkey-badge').textContent = formatHotkey(s.inputHotkey);
  }
  try {
    if (!tab?.id) throw new Error('no-tab');
    const state = await queryPageState(tab.id);
    button.disabled = false;
    button.textContent = state.enabled ? '원문만 보기' : '이 페이지 번역하기';
    status.textContent = state.enabled ? `${state.translated}개 문단 번역 · ${state.errors}개 실패` : '';
  } catch {
    status.textContent = '일반 웹페이지를 열어주세요. Chrome 내부 페이지에서는 동작하지 않습니다.';
    button.disabled = true;
  }
}
button.addEventListener('click', async () => {
  button.disabled = true;
  try {
    await queryPageState(tab.id);
    const result = await chrome.tabs.sendMessage(tab.id, { type: 'TAI_TOGGLE_PAGE' }, { frameId: 0 });
    if (!result?.ok) throw new Error(result?.error || '페이지 번역을 시작하지 못했습니다.');
    await update();
  } catch (error) { status.textContent = error.message; status.classList.add('error'); }
  finally { button.disabled = false; }
});
document.querySelector('#options').addEventListener('click', () => chrome.runtime.openOptionsPage());
void update().catch(error => { status.textContent = error.message; });
