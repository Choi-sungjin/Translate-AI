export const DEFAULTS = Object.freeze({
  provider: 'codex', pageLanguage: 'ko', inputLanguage: 'en',
  inputEnabled: true, spaceInterval: 300,
  apiUrl: 'https://api.openai.com/v1/chat/completions', model: '', apiKey: '', bridgeToken: ''
});
export const LANGUAGES = { ko: '한국어', en: '영어', ja: '일본어', zh: '중국어', de: '독일어', fr: '프랑스어', es: '스페인어', vi: '베트남어' };
export function validateSettings(value) {
  const s = { ...DEFAULTS };
  for (const key of Object.keys(s)) if (Object.hasOwn(value, key)) s[key] = value[key];
  if (!['codex', 'mymemory', 'openai'].includes(s.provider)) throw new Error('지원하지 않는 번역 서비스입니다.');
  if (!LANGUAGES[s.pageLanguage] || !LANGUAGES[s.inputLanguage]) throw new Error('번역 언어를 선택하세요.');
  if (typeof s.inputEnabled !== 'boolean') throw new Error('입력 번역 설정이 올바르지 않습니다.');
  s.spaceInterval = Number(s.spaceInterval);
  if (!Number.isInteger(s.spaceInterval) || s.spaceInterval < 150 || s.spaceInterval > 1000) throw new Error('연타 간격은 150~1000ms입니다.');
  for (const key of ['apiUrl', 'model', 'apiKey', 'bridgeToken']) {
    if (typeof s[key] !== 'string' || s[key].length > 4096) throw new Error('API 설정을 확인하세요.');
    s[key] = s[key].trim();
  }
  if (s.bridgeToken && !/^[a-f0-9]{64}$/.test(s.bridgeToken)) throw new Error('로컬 연결 코드를 정확하게 붙여넣으세요.');
  if (s.provider === 'openai') {
    let u;
    try { u = new URL(s.apiUrl); } catch { throw new Error('API 주소가 올바르지 않습니다.'); }
    const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname);
    if ((u.protocol !== 'https:' && !(u.protocol === 'http:' && loopback)) || u.username || u.password || u.hash) throw new Error('HTTPS 또는 로컬 서버 주소를 사용하세요.');
    if (!s.model) throw new Error('사용할 모델 이름을 입력하세요.');
  }
  return s;
}
export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return validateSettings(settings || {});
}
export function publicSettings(s) {
  return { pageLanguage: s.pageLanguage, inputLanguage: s.inputLanguage, inputEnabled: s.inputEnabled, spaceInterval: s.spaceInterval, provider: s.provider };
}
