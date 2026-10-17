// The free API bounds query size. Prefer sentence/word boundaries, retain every character.
export function splitForTranslation(text, maxBytes = 450) {
  const encoder = new TextEncoder(), chunks = [];
  for (const line of text.split(/(\r\n|\r|\n)/)) {
    if (!line) continue;
    let rest = line;
    while (rest) {
      let bytes = 0, end = 0, boundary = 0;
      for (const char of rest) {
        const size = encoder.encode(char).length;
        if (bytes + size > maxBytes) break;
        bytes += size; end += char.length;
        if (/[\s。！？.!?]/u.test(char)) boundary = end;
      }
      if (end < rest.length && boundary > end / 2) end = boundary;
      chunks.push(rest.slice(0, end)); rest = rest.slice(end);
    }
  }
  return chunks;
}
export function preserveEdges(source, translated) {
  return source.match(/^\s*/u)[0] + translated.trim() + source.match(/\s*$/u)[0];
}
