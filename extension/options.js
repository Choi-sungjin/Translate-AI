import { LANGUAGES } from './settings.js';
const form = document.querySelector('#settings'), status = document.querySelector('#status');
const keys = ['provider', 'pageLanguage', 'inputLanguage', 'inputEnabled', 'spaceInterval', 'apiUrl', 'model', 'apiKey', 'bridgeToken'];
for (const id of ['pageLanguage', 'inputLanguage']) {
  for (const [value, name] of Object.entries(LANGUAGES)) document.getElementById(id).add(new Option(name, value));
}
function displayProvider() {
  const provider = document.querySelector('#provider').value;
  document.querySelector('#api-fields').hidden = provider !== 'openai'; document.querySelector('#google-help').hidden = provider !== 'mymemory';
  document.querySelector('#codex-fields').hidden = provider !== 'codex';
}
function message(text, error = false) { status.textContent = text; status.className = `status ${error ? 'error' : 'success'}`; }
async function send(value) {
  const response = await chrome.runtime.sendMessage(value);
  if (!response?.ok) throw new Error(response?.error || '요청에 실패했습니다.');
  return response.data;
}
async function load() {
  const settings = await send({ type: 'TAI_SETTINGS' });
  for (const key of keys) { const el = document.getElementById(key); if (el.type === 'checkbox') el.checked = settings[key]; else el.value = settings[key]; }
  displayProvider();
}
document.querySelector('#provider').addEventListener('change', displayProvider);
document.querySelector('#open-bridge').addEventListener('click', () => chrome.tabs.create({ url: 'http://127.0.0.1:18458/' }));
document.querySelector('#bridge-status').addEventListener('click', async event => {
  const button = event.currentTarget; button.disabled = true;
  try { const result = await send({ type: 'TAI_BRIDGE_STATUS' }); message(result.message, !result.loggedIn); }
  catch (error) { message(error.message, true); }
  finally { button.disabled = false; }
});
form.addEventListener('submit', async event => {
  event.preventDefault(); const settings = {};
  for (const key of keys) { const el = document.getElementById(key); settings[key] = el.type === 'checkbox' ? el.checked : el.value; }
  try { await send({ type: 'TAI_SAVE_SETTINGS', settings }); message('저장했습니다. 이미 번역 중인 페이지는 껐다 켜면 적용됩니다.'); }
  catch (error) { message(error.message, true); }
});
document.querySelector('#test').addEventListener('click', async event => {
  const button = event.currentTarget; button.disabled = true; message('실제 번역 서버에 예문을 보내는 중입니다…');
  try {
    const settings = await send({ type: 'TAI_SETTINGS' });
    const text = settings.inputLanguage === 'en' ? '안녕하세요. 만나서 반갑습니다.' : 'Hello. It is nice to meet you.';
    const result = await send({ type: 'TAI_TRANSLATE', mode: 'test', text });
    message(`연결 성공 · ${result.text}`);
  } catch (error) { message(error.message, true); }
  finally { button.disabled = false; }
});
document.querySelector('#clear').addEventListener('click', async () => {
  try { await send({ type: 'TAI_CLEAR_CACHE' }); message('메모리 캐시를 비웠습니다.'); } catch (error) { message(error.message, true); }
});
void load().catch(error => message(error.message, true));
