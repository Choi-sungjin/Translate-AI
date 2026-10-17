import { LANGUAGES } from './settings.js';
const button = document.querySelector('#toggle'), status = document.querySelector('#status');
let tab;
async function update() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const response = await chrome.runtime.sendMessage({ type: 'TAI_SETTINGS' });
  if (response.ok) {
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
