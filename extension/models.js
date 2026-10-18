export const CODEX_MODELS = Object.freeze({
  'gpt-6.1-sol': 'GPT-6.1 Sol',
  'gpt-6-luna': 'GPT-6 Luna',
  'gpt-5.6-luna': 'GPT-5.6 Luna'
});
export const DEFAULT_CODEX_MODEL = 'gpt-6.1-sol';
export function validateCodexModel(model = DEFAULT_CODEX_MODEL) {
  if (typeof model !== 'string' || !Object.hasOwn(CODEX_MODELS, model)) throw new Error('지원하는 ChatGPT 번역 모델을 선택하세요.');
  return model;
}
