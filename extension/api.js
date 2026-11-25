// Pure helpers for the "개인 AI API" provider. No chrome.* access, so Node tests can import this.

// Suggestions only. Any model name the server accepts can still be typed in.
export const OPENAI_MODEL_SUGGESTIONS = Object.freeze({
  'gpt-6.2-sol': 'GPT-6.2 Sol · 일상 작업·번역 추천',
  'gpt-6.2-astra': 'GPT-6.2 Astra · 최상위, 비쌈',
  'gpt-6.1-sol': 'GPT-6.1 Sol',
  'gpt-6.1-terra': 'GPT-6.1 Terra · 경량·저렴',
  'gpt-6-astra': 'GPT-6 Astra',
  'gpt-6-sol': 'GPT-6 Sol',
  'gpt-6-luna': 'GPT-6 Luna',
  'gpt-5.6-sol': 'GPT-5.6 Sol',
  'gpt-5.6-terra': 'GPT-5.6 Terra',
  'gpt-5.6-luna': 'GPT-5.6 Luna'
});

// '' = do not send service_tier (account/project default, usually Standard).
export const SERVICE_TIERS = Object.freeze({
  '': '기본 · Standard',
  fast: 'Fast · 약 2배 요금',
  ultrafast: 'Ultrafast · 최고 속도·최고 요금'
});

// 'auto' = send low only to OpenAI reasoning models, nothing to other servers.
export const REASONING_EFFORTS = Object.freeze({
  auto: '자동 · OpenAI 추론 모델이면 low',
  low: 'low · 빠름, 번역에 충분',
  medium: 'medium',
  high: 'high · 느림'
});

export const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
export const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

export function apiFormat(apiUrl) {
  let pathname = '';
  try { pathname = new URL(apiUrl).pathname; } catch { return 'chat'; }
  return /\/responses\/?$/.test(pathname) ? 'responses' : 'chat';
}

// GPT-5+/o-series reasoning models reject custom temperature/top_p when reasoning is on.
// Azure's gpt-35-turbo (=3.5) and GPT-5.x *-chat models accept temperature, so they are excluded.
// GPT-6+ is always treated as reasoning (sampling parameters are rejected there).
export function isReasoningModel(model) {
  const name = String(model || '').trim().toLowerCase().split('/').pop().replace(/^ft:/, '');
  const match = /^gpt-([5-9]|1\d)(?:\.\d+)?(?![0-9a-z])/.exec(name);
  if (match) return !(match[1] === '5' && /-chat(?![0-9a-z])/.test(name));
  return /^o[1-9](?![0-9a-z])/.test(name);
}

export function resolvedEffort(s) {
  if (s.reasoningEffort && s.reasoningEffort !== 'auto') return s.reasoningEffort;
  return isReasoningModel(s.model) ? 'low' : '';
}

export function buildApiRequest(s, instructions, content) {
  const format = apiFormat(s.apiUrl);
  const effort = resolvedEffort(s);
  // Only non-reasoning servers (e.g. local models) get deterministic sampling.
  const sampling = effort || isReasoningModel(s.model) ? {} : { temperature: 0 };
  const tier = s.serviceTier ? { service_tier: s.serviceTier } : {};
  if (format === 'responses') {
    return { format, body: {
      model: s.model,
      input: [{ role: 'developer', content: instructions }, { role: 'user', content }],
      store: false,
      ...(effort ? { reasoning: { effort } } : {}),
      ...tier, ...sampling
    } };
  }
  return { format, body: {
    model: s.model,
    messages: [{ role: 'system', content: instructions }, { role: 'user', content }],
    ...(effort ? { reasoning_effort: effort } : {}),
    ...tier, ...sampling
  } };
}

export function parseApiResponse(format, data) {
  const servedTier = typeof data?.service_tier === 'string' ? data.service_tier : undefined;
  let text;
  if (format === 'responses') {
    if (data?.status === 'incomplete') {
      // Only known enum values are echoed; arbitrary server text must not reach web pages.
      const reason = ['max_output_tokens', 'content_filter'].includes(data.incomplete_details?.reason) ? data.incomplete_details.reason : '';
      throw new Error(`번역 응답이 중간에 끊겼습니다${reason ? ` (${reason})` : ''}. 더 짧은 문장으로 시도하세요.`);
    }
    if (typeof data?.output_text === 'string') text = data.output_text;
    else if (Array.isArray(data?.output)) {
      text = data.output.filter(item => item?.type === 'message')
        .flatMap(item => Array.isArray(item.content) ? item.content : [])
        .filter(part => part?.type === 'output_text' && typeof part.text === 'string')
        .map(part => part.text).join('');
    }
  } else {
    const message = data?.choices?.[0]?.message?.content;
    text = Array.isArray(message) ? message.map(part => part?.text || '').join('') : message;
  }
  return { text, servedTier };
}

// The bridge cannot be launched from an extension, so tell the user exactly what to run on this OS.
export function bridgeOffHint(os) {
  const how = os === 'win' ? 'Translate-AI 폴더의 Start-Translate-AI.cmd를 실행하세요'
    : os === 'linux' ? "앱 메뉴의 'Translate AI'를 누르거나, Translate-AI 폴더에서 sh Start-Translate-AI.sh를 실행하세요"
    : 'Translate-AI 폴더의 연결 프로그램을 실행하세요';
  return `ChatGPT 로컬 연결이 꺼져 있습니다. ${how}. 연결 프로그램 없이 쓰려면 설정에서 '개인 AI API'나 'MyMemory'를 고르세요.`;
}

// Turn an HTTP error body into a short, key-free hint for the settings page.
export function apiErrorDetail(bodyText, secrets = []) {
  if (typeof bodyText !== 'string' || !bodyText.trim()) return '';
  let detail = bodyText;
  try {
    const data = JSON.parse(bodyText);
    detail = data?.error?.message || data?.message || (typeof data?.error === 'string' ? data.error : '');
  } catch { /* plain-text error body */ }
  if (typeof detail !== 'string') return '';
  for (const secret of secrets) if (typeof secret === 'string' && secret.length >= 4) detail = detail.split(secret).join('[가림]');
  detail = detail.replace(/\b(sk|rk|pk)-[A-Za-z0-9_*\-]{4,}/g, '$1-…').replace(/\b(Bearer)\s+\S+/gi, '$1 [가림]').replace(/\s+/g, ' ').trim();
  return detail.length > 300 ? `${detail.slice(0, 300)}…` : detail;
}
