// Pure keyboard shortcut helpers shared by extension pages and Node unit tests.

export const DEFAULT_PAGE_HOTKEY = 'Alt+KeyA';
export const DEFAULT_INPUT_HOTKEY = 'Alt+KeyI';

const LETTERS = Object.fromEntries(Array.from({ length: 26 }, (_, i) => {
  const ch = String.fromCharCode(65 + i);
  return [`Key${ch}`, ch];
}));
const DIGITS = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`Digit${i}`, String(i)]));
const FN_KEYS = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`F${i + 1}`, `F${i + 1}`]));

export const HOTKEY_CODES = Object.freeze({
  ...LETTERS,
  ...DIGITS,
  ...FN_KEYS,
  Space: 'Space',
  Period: '.',
  Comma: ',',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  Backslash: '\\'
});

const ALIAS_TO_CODE = Object.freeze({
  ...Object.fromEntries(Object.entries(HOTKEY_CODES).map(([code, label]) => [code.toLowerCase(), code])),
  ...Object.fromEntries(Object.entries(HOTKEY_CODES).map(([code, label]) => [label.toLowerCase(), code])),
  period: 'Period',
  comma: 'Comma',
  slash: 'Slash',
  semicolon: 'Semicolon',
  quote: 'Quote',
  bracketleft: 'BracketLeft',
  bracketright: 'BracketRight',
  backquote: 'Backquote',
  minus: 'Minus',
  equal: 'Equal',
  backslash: 'Backslash'
});

const MODIFIER_MAP = Object.freeze({
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  meta: 'Meta',
  cmd: 'Meta',
  command: 'Meta',
  super: 'Meta'
});

const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'];
const IGNORED_EVENT_CODES = new Set([
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight',
  'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'CapsLock', 'Tab', 'Escape'
]);

export function parseHotkey(value) {
  if (typeof value !== 'string') throw new Error('단축키 설정이 올바르지 않습니다.');
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split('+').map(p => p.trim()).filter(Boolean);
  if (!parts.length || parts.length > 5) throw new Error('유효한 단축키를 지정하세요.');
  const mods = new Set();
  let code = null;
  for (const raw of parts) {
    const lower = raw.toLowerCase();
    if (Object.hasOwn(MODIFIER_MAP, lower)) {
      mods.add(MODIFIER_MAP[lower]);
    } else if (!code && Object.hasOwn(ALIAS_TO_CODE, lower)) {
      code = ALIAS_TO_CODE[lower];
    } else {
      throw new Error('지원하지 않는 단축키입니다. 영문·숫자·기호 또는 F1~F12 키를 사용하세요.');
    }
  }
  if (!code) throw new Error('단축키에 일반 키를 포함하세요.');
  const isFnKey = /^F([1-9]|1[0-2])$/.test(code);
  const hasPrimaryModifier = mods.has('Ctrl') || mods.has('Alt') || mods.has('Meta');
  if (!hasPrimaryModifier && !isFnKey) {
    throw new Error('단축키는 Alt, Ctrl, Meta 중 하나 이상과 조합하거나 F1~F12 키를 사용하세요.');
  }
  return {
    ctrl: mods.has('Ctrl'),
    alt: mods.has('Alt'),
    shift: mods.has('Shift'),
    meta: mods.has('Meta'),
    code,
    canonical: [...MODIFIER_ORDER.filter(m => mods.has(m)), code].join('+')
  };
}

export function validateHotkey(value = '') {
  if (value === '') return '';
  const parsed = parseHotkey(value);
  return parsed ? parsed.canonical : '';
}

export function formatHotkey(value) {
  if (!value) return '사용 안 함';
  try {
    const parsed = parseHotkey(value);
    if (!parsed) return '사용 안 함';
    const parts = MODIFIER_ORDER.filter(m => parsed[m.toLowerCase()]);
    parts.push(HOTKEY_CODES[parsed.code] || parsed.code);
    return parts.join(' + ');
  } catch {
    return String(value);
  }
}

export function hotkeyFromEvent(event) {
  if (!event || typeof event.code !== 'string' || IGNORED_EVENT_CODES.has(event.code)) return null;
  if (!Object.hasOwn(HOTKEY_CODES, event.code)) {
    throw new Error('이 키는 단축키로 사용할 수 없습니다. 영문·숫자 또는 F1~F12 키를 눌러주세요.');
  }
  const parts = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');
  parts.push(event.code);
  return validateHotkey(parts.join('+'));
}

export function matchesHotkey(event, hotkey) {
  if (!hotkey || !event || event.repeat) return false;
  let parsed;
  try { parsed = parseHotkey(hotkey); } catch { return false; }
  if (!parsed) return false;
  return Boolean(event.ctrlKey) === parsed.ctrl
    && Boolean(event.altKey) === parsed.alt
    && Boolean(event.shiftKey) === parsed.shift
    && Boolean(event.metaKey) === parsed.meta
    && event.code === parsed.code;
}
