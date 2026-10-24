const URL_PATTERN = /https:\/\/[^\s<>]+/gi;

export type MessagePart = { type: 'text'; value: string } | { type: 'link'; value: string };

export function splitMessageLinks(text: string): MessagePart[] {
  if (!text) {
    return [];
  }
  const parts: MessagePart[] = [];
  let cursor = 0;
  const matches = text.matchAll(URL_PATTERN);
  for (const match of matches) {
    const start = match.index ?? 0;
    if (start > cursor) {
      parts.push({ type: 'text', value: text.slice(cursor, start) });
    }
    const raw = match[0].replace(/[),.;]+$/u, '');
    parts.push({ type: 'link', value: raw });
    cursor = start + raw.length;
  }
  if (cursor < text.length) {
    parts.push({ type: 'text', value: text.slice(cursor) });
  }
  return parts;
}

export function isHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
