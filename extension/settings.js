import { DEFAULT_CODEX_MODEL, validateCodexModel, validateCodexServiceTier, validateCodexReasoningEffort } from './models.js';
import { SERVICE_TIERS, REASONING_EFFORTS, apiFormat } from './api.js';
import { DEFAULT_PAGE_HOTKEY, DEFAULT_INPUT_HOTKEY, validateHotkey } from './hotkeys.js';

export const DEFAULTS = Object.freeze({
  provider: 'codex', pageLanguage: 'ko', inputLanguage: 'en',
  inputEnabled: true, spaceInterval: 300, pageConcurrency: 6,
  pageHotkey: DEFAULT_PAGE_HOTKEY, inputHotkey: DEFAULT_INPUT_HOTKEY,
  codexModel: DEFAULT_CODEX_MODEL, codexServiceTier: '', codexReasoningEffort: 'low',
  apiUrl: 'https://api.openai.com/v1/chat/completions', model: '', apiKey: '', bridgeToken: '',
  serviceTier: '', reasoningEffort: 'auto'
});

export const LANGUAGES = { ko: '한국어', en: '영어', ja: '일본어', zh: '중국어', de: '독일어', fr: '프랑스어', es: '스페인어', vi: '베트남어' };

export function validateSettings(value) {
  const s = { ...DEFAULTS };
  for (const key of Object.keys(s)) if (Object.hasOwn(value, key)) s[key] = value[key];
  if (!['codex', 'mymemory', 'openai'].includes(s.provider)) throw new Error('지원하지 않는 번역 서비스입니다.');
  s.codexModel = validateCodexModel(s.codexModel);
  s.codexServiceTier = validateCodexServiceTier(s.codexServiceTier);
  s.codexReasoningEffort = validateCodexReasoningEffort(s.codexReasoningEffort);
  if (!LANGUAGES[s.pageLanguage] || !LANGUAGES[s.inputLanguage]) throw new Error('번역 언어를 선택하세요.');
  if (typeof s.inputEnabled !== 'boolean') throw new Error('입력 번역 설정이 올바르지 않습니다.');
  s.spaceInterval = Number(s.spaceInterval);
  if (!Number.isInteger(s.spaceInterval) || s.spaceInterval < 150 || s.spaceInterval > 1000) throw new Error('연타 간격은 150~1000ms입니다.');
  s.pageConcurrency = Number(s.pageConcurrency);
  if (!Number.isInteger(s.pageConcurrency) || s.pageConcurrency < 1 || s.pageConcurrency > 12) throw new Error('동시 번역 문단 수는 1~12개입니다.');
  s.pageHotkey = validateHotkey(s.pageHotkey);
  s.inputHotkey = validateHotkey(s.inputHotkey);
  if (s.pageHotkey && s.pageHotkey === s.inputHotkey) throw new Error('페이지 번역 단축키와 입력창 번역 단축키를 서로 다르게 설정하세요.');
  for (const key of ['apiUrl', 'model', 'apiKey', 'bridgeToken']) {
    if (typeof s[key] !== 'string' || s[key].length > 4096) throw new Error('API 설정을 확인하세요.');
    s[key] = s[key].trim();
  }
  if (typeof s.serviceTier !== 'string' || !Object.hasOwn(SERVICE_TIERS, s.serviceTier)) throw new Error('지원하지 않는 속도 설정입니다.');
  if (typeof s.reasoningEffort !== 'string' || !Object.hasOwn(REASONING_EFFORTS, s.reasoningEffort)) throw new Error('지원하지 않는 추론 강도입니다.');
  if (s.bridgeToken && !/^[a-f0-9]{64}$/.test(s.bridgeToken)) throw new Error('로컬 연결 코드를 정확하게 붙여넣으세요.');
  if (s.provider === 'openai') {
    let u;
    try { u = new URL(s.apiUrl); } catch { throw new Error('API 주소가 올바르지 않습니다.'); }
    const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname);
    if ((u.protocol !== 'https:' && !(u.protocol === 'http:' && loopback)) || u.username || u.password || u.hash) throw new Error('HTTPS 또는 로컬 서버 주소를 사용하세요.');
    if (!s.model) throw new Error('사용할 모델 이름을 입력하세요.');
    if (s.serviceTier === 'ultrafast' && apiFormat(s.apiUrl) !== 'responses') throw new Error('Ultrafast는 Responses API에서만 동작합니다. API 주소를 …/v1/responses 로 바꾸세요.');
  }
  return s;
}

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return validateSettings(settings || {});
}

export function publicSettings(s) {
  return {
    pageLanguage: s.pageLanguage, inputLanguage: s.inputLanguage,
    inputEnabled: s.inputEnabled, spaceInterval: s.spaceInterval,
    pageConcurrency: s.pageConcurrency, pageHotkey: s.pageHotkey, inputHotkey: s.inputHotkey,
    provider: s.provider, codexModel: s.codexModel, codexServiceTier: s.codexServiceTier, serviceTier: s.serviceTier
  };
}
