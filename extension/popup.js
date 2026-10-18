import { LANGUAGES } from './settings.js';
import { CODEX_MODELS } from './models.js';
document.querySelector('#version').textContent = `v${chrome.runtime.getManifest().version}`;
const button = document.querySelector('#toggle'), status = document.querySelector('#status');
const model = document.querySelector('#codexModel');
for (const [value, label] of Object.entries(CODEX_MODELS)) model.add(new Option(label, value));
model.addEventListener('change', async () => {
  model.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({ type: 'TAI_SET_CODEX_MODEL', model: model.value });
    if (!response?.ok) throw new Error(response?.error || '모델을 저장하지 못했습니다.');
    status.classList.remove('error'); status.textContent = `${CODEX_MODELS[response.data]} 저장 완료 · 다음 번역부터 적용됩니다.`;
  } catch (error) { status.textContent = error.message; status.classList.add('error'); }
  finally { model.disabled = false; }
});
let tab;
async function update() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const response = await chrome.runtime.sendMessage({ type: 'TAI_SETTINGS' });
  if (response.ok) {
    document.querySelector('#model-field').hidden = response.data.provider !== 'codex';
    model.value = response.data.codexModel; model.disabled = false;
    document.querySelector('#language').textContent = `${LANGUAGES[response.data.pageLanguage]}로 읽기`;
    document.querySelector('#input-language').textContent = response.data.inputEnabled ? `${LANGUAGES[response.data.inputLanguage]}로` : '입력 번역 꺼짐 · 설정에서 활성화하면';
  }
  try {
    const state = await chrome.tabs.sendMessage(tab.id, { type: 'TAI_PAGE_STATUS' }, { frameId: 0 });
    button.textContent = state.enabled ? '원문만 보기' : '이 페이지 번역하기';
    status.textContent = state.enabled ? `${state.translated}개 문단 번역 · ${state.errors}개 실패` : '';
  } catch { status.textContent = '일반 웹페이지를 열어주세요. 방금 설치했다면 페이지를 새로고침하세요.'; button.disabled = true; }
}
button.addEventListener('click', async () => {
  button.disabled = true;
  try {
    const result = await chrome.tabs.sendMessage(tab.id, { type: 'TAI_TOGGLE_PAGE' }, { frameId: 0 });
    if (!result?.ok) throw new Error(result?.error || '페이지 번역을 시작하지 못했습니다.');
    await update();
  } catch (error) { status.textContent = error.message; status.classList.add('error'); }
  finally { button.disabled = false; }
});
document.querySelector('#options').addEventListener('click', () => chrome.runtime.openOptionsPage());
void update().catch(error => { status.textContent = error.message; });
