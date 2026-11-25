export const CODEX_MODELS = Object.freeze({
  'gpt-6.2-sol': 'GPT-6.2 Sol · 추천',
  'gpt-6.2-astra': 'GPT-6.2 Astra · 최상위',
  'gpt-6.1-sol': 'GPT-6.1 Sol',
  'gpt-6.1-terra': 'GPT-6.1 Terra · 경량',
  'gpt-6-astra': 'GPT-6 Astra',
  'gpt-6-sol': 'GPT-6 Sol',
  'gpt-6-luna': 'GPT-6 Luna',
  'gpt-5.6-sol': 'GPT-5.6 Sol',
  'gpt-5.6-terra': 'GPT-5.6 Terra',
  'gpt-5.6-luna': 'GPT-5.6 Luna'
});

export const DEFAULT_CODEX_MODEL = 'gpt-6.2-sol';

export const CODEX_SERVICE_TIERS = Object.freeze({
  '': '기본 · Standard',
  fast: 'Fast · 최대 2배 속도',
  ultrafast: 'Ultrafast · 최고 속도 (GPT-6.2 Sol)'
});

export const CODEX_REASONING_EFFORTS = Object.freeze({
  low: 'low · 빠름, 번역 추천',
  medium: 'medium · 균형',
  high: 'high · 정밀, 느림'
});

export function validateCodexModel(model = DEFAULT_CODEX_MODEL) {
  if (typeof model !== 'string' || !Object.hasOwn(CODEX_MODELS, model)) throw new Error('지원하는 ChatGPT 번역 모델을 선택하세요.');
  return model;
}

export function validateCodexServiceTier(tier = '') {
  if (typeof tier !== 'string' || !Object.hasOwn(CODEX_SERVICE_TIERS, tier)) throw new Error('지원하지 않는 속도 설정입니다.');
  return tier;
}

export function validateCodexReasoningEffort(effort = 'low') {
  if (typeof effort !== 'string' || !Object.hasOwn(CODEX_REASONING_EFFORTS, effort)) throw new Error('지원하지 않는 추론 강도입니다.');
  return effort;
}
