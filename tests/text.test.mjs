import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitForTranslation, preserveEdges } from '../extension/text.js';
test('long Unicode input keeps every character, line break and valid code point within the API budget', () => {
  const source = ('  한국어와 English words 😀 are preserved.\r\nNext paragraph.\n').repeat(50);
  const chunks = splitForTranslation(source);
  assert.equal(chunks.join(''), source);
  for (const chunk of chunks) { assert.ok(Buffer.byteLength(chunk) <= 450); assert.ok(chunk.isWellFormed()); }
});
test('normal words are not split at request boundaries', () => {
  const chunks = splitForTranslation('A fairly long English paragraph with ordinary words. '.repeat(50));
  for (const chunk of chunks.slice(0, -1)) assert.match(chunk, /\s$/);
});
test('translation restores only original boundary whitespace', () => {
  assert.equal(preserveEdges('  first\nsecond  ', '\n번역\n문장\n'), '  번역\n문장  ');
});
