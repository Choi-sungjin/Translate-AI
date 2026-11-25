import { LANGUAGES } from './settings.js';
import { CODEX_MODELS, CODEX_SERVICE_TIERS, CODEX_REASONING_EFFORTS } from './models.js';
import { OPENAI_MODEL_SUGGESTIONS, SERVICE_TIERS, REASONING_EFFORTS, OPENAI_CHAT_URL, OPENAI_RESPONSES_URL } from './api.js';
import { DEFAULT_PAGE_HOTKEY, DEFAULT_INPUT_HOTKEY, formatHotkey, hotkeyFromEvent } from './hotkeys.js';

const form = document.querySelector('#settings'), status = document.querySelector('#status');
const keys = [
  'provider', 'pageLanguage', 'inputLanguage', 'inputEnabled', 'spaceInterval', 'pageConcurrency',
  'pageHotkey', 'inputHotkey',
  'codexModel', 'codexServiceTier', 'codexReasoningEffort',
  'apiUrl', 'model', 'apiKey', 'bridgeToken', 'serviceTier', 'reasoningEffort'
];

for (const [value, label] of Object.entries(CODEX_MODELS)) document.querySelector('#codexModel').add(new Option(label, value));
for (const [value, label] of Object.entries(CODEX_SERVICE_TIERS)) document.querySelector('#codexServiceTier').add(new Option(label, value));
for (const [value, label] of Object.entries(CODEX_REASONING_EFFORTS)) document.querySelector('#codexReasoningEffort').add(new Option(label, value));
for (const [value, label] of Object.entries(OPENAI_MODEL_SUGGESTIONS)) document.querySelector('#model-suggestions').append(new Option(label, value));
for (const [value, label] of Object.entries(SERVICE_TIERS)) document.querySelector('#serviceTier').add(new Option(label, value));
for (const [value, label] of Object.entries(REASONING_EFFORTS)) document.querySelector('#reasoningEffort').add(new Option(label, value));

const apiUrl = document.querySelector('#apiUrl'), serviceTier = document.querySelector('#serviceTier');
let savedSnapshot = '';

function collectForm() {
  const settings = {};
  for (const key of keys) {
    const el = document.getElementById(key);
    settings[key] = el.type === 'checkbox' ? el.checked : el.value;
  }
  return settings;
}

// Ultrafast is documented for the Responses API only; move the official OpenAI URL there automatically.
function matchTierToUrl() {
  if (serviceTier.value === 'ultrafast' && apiUrl.value.trim().replace(/\/+$/, '') === OPENAI_CHAT_URL) {
    apiUrl.value = OPENAI_RESPONSES_URL;
    message('Ultrafast는 Responses API에서 동작하므로 API 주소를 …/v1/responses 로 바꿨습니다. 저장해야 적용됩니다.');
  }
}
serviceTier.addEventListener('change', matchTierToUrl);
document.querySelector('#openai-preset').addEventListener('click', () => {
  apiUrl.value = OPENAI_CHAT_URL; matchTierToUrl();
  const model = document.querySelector('#model'); if (!model.value.trim()) model.value = 'gpt-6.2-sol';
  document.querySelector('#apiKey').focus();
});

for (const id of ['pageLanguage', 'inputLanguage']) {
  for (const [value, name] of Object.entries(LANGUAGES)) document.getElementById(id).add(new Option(name, value));
}

function bindHotkeyControl(hiddenId, displayId, resetId, clearId, defaultHotkey) {
  const hidden = document.getElementById(hiddenId);
  const display = document.getElementById(displayId);
  const sync = () => { display.value = formatHotkey(hidden.value); display.classList.remove('recording'); };
  display.addEventListener('focus', () => {
    display.classList.add('recording');
    display.value = '키 조합을 누르세요… (Esc 취소 · Backspace 해제)';
  });
  display.addEventListener('blur', sync);
  display.addEventListener('keydown', event => {
    if (event.key === 'Tab') return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Escape') { display.blur(); return; }
    if (['Backspace', 'Delete'].includes(event.key) && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
      hidden.value = ''; sync(); display.blur();
      message('단축키를 해제했습니다. 설정 저장을 누르면 반영됩니다.');
      return;
    }
    try {
      const recorded = hotkeyFromEvent(event);
      if (!recorded) return;
      hidden.value = recorded; sync(); display.blur();
      message(`단축키를 ${formatHotkey(recorded)}(으)로 지정했습니다. 설정 저장을 누르면 적용됩니다.`);
    } catch (error) {
      message(error.message, true);
    }
  });
  document.getElementById(resetId).addEventListener('click', () => {
    hidden.value = defaultHotkey; sync();
    message(`기본 단축키(${formatHotkey(defaultHotkey)})로 되돌렸습니다. 설정 저장을 누르면 적용됩니다.`);
  });
  document.getElementById(clearId).addEventListener('click', () => {
    hidden.value = ''; sync();
    message('단축키를 해제했습니다. 설정 저장을 누르면 적용됩니다.');
  });
  return sync;
}
const syncPageHotkey = bindHotkeyControl('pageHotkey', 'pageHotkeyDisplay', 'reset-page-hotkey', 'clear-page-hotkey', DEFAULT_PAGE_HOTKEY);
const syncInputHotkey = bindHotkeyControl('inputHotkey', 'inputHotkeyDisplay', 'reset-input-hotkey', 'clear-input-hotkey', DEFAULT_INPUT_HOTKEY);

async function refreshChromeShortcuts() {
  const summary = document.querySelector('#chrome-shortcuts-summary');
  try {
    const commands = await chrome.commands.getAll();
    const toggleCmd = commands.find(c => c.name === 'toggle-page')?.shortcut || '미지정';
    const inputCmd = commands.find(c => c.name === 'translate-input')?.shortcut || '미지정';
    summary.textContent = `브라우저 전역 단축키: 페이지 번역(${toggleCmd}) · 입력창 번역(${inputCmd})`;
  } catch {
    summary.textContent = '브라우저 전역 단축키도 함께 사용할 수 있습니다.';
  }
}
document.querySelector('#open-chrome-shortcuts').addEventListener('click', () => {
  void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

function displayProvider() {
  const provider = document.querySelector('#provider').value;
  document.querySelector('#api-fields').hidden = provider !== 'openai';
  document.querySelector('#google-help').hidden = provider !== 'mymemory';
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
  for (const key of keys) {
    const el = document.getElementById(key);
    if (el.type === 'checkbox') el.checked = settings[key];
    else el.value = String(settings[key] ?? '');
  }
  syncPageHotkey(); syncInputHotkey();
  displayProvider();
  await refreshChromeShortcuts();
  savedSnapshot = JSON.stringify(collectForm());
  message('');
  document.querySelector('#settings-fields').disabled = false;
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
  event.preventDefault();
  const settings = collectForm();
  try {
    await send({ type: 'TAI_SAVE_SETTINGS', settings });
    savedSnapshot = JSON.stringify(collectForm());
    message('저장했습니다. 열려 있는 탭의 단축키는 즉시 적용되며, 이미 번역 중인 페이지는 껐다 켜면 적용됩니다.');
  } catch (error) { message(error.message, true); }
});
document.querySelector('#test').addEventListener('click', async event => {
  const button = event.currentTarget; button.disabled = true; message('실제 번역 서버에 예문을 보내는 중입니다…');
  try {
    const currentForm = collectForm();
    if (JSON.stringify(currentForm) !== savedSnapshot) {
      await send({ type: 'TAI_SAVE_SETTINGS', settings: currentForm });
      savedSnapshot = JSON.stringify(collectForm());
    }
    const settings = await send({ type: 'TAI_SETTINGS' });
    const text = settings.inputLanguage === 'en' ? '안녕하세요. 만나서 반갑습니다.' : 'Hello. It is nice to meet you.';
    const result = await send({ type: 'TAI_TRANSLATE', mode: 'test', text });
    let label = '';
    if (result.provider === 'codex') {
      label = ` · ${CODEX_MODELS[result.model] || result.model} · 속도 ${result.serviceTier || 'default'}`;
    } else if (result.provider === 'openai') {
      label = ` · ${result.model} · 요청 속도 ${result.serviceTier}`;
      if (result.servedTier) label += result.servedTier === result.serviceTier ? '' : ` → 실제 처리 ${result.servedTier}`;
    }
    message(`연결 성공${label} · ${result.text}`);
  } catch (error) { message(error.message, true); }
  finally { button.disabled = false; }
});
document.querySelector('#clear').addEventListener('click', async () => {
  try { await send({ type: 'TAI_CLEAR_CACHE' }); message('메모리 캐시를 비웠습니다.'); } catch (error) { message(error.message, true); }
});
void load().catch(error => message(error.message, true));
