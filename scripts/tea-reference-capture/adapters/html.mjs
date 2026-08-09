import { normalizeCapturedText } from '../evidence.mjs';

export class SourceLayoutMismatchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SourceLayoutMismatchError';
  }
}

const NAMED_ENTITIES = Object.freeze({
  amp: '&', apos: "'", gt: '>', hellip: '…', laquo: '«', ldquo: '“', lsquo: '‘', lt: '<', mdash: '—', ndash: '–', nbsp: ' ', ordm: 'º', quot: '"', raquo: '»', rdquo: '”', rsquo: '’',
});

export function decodeHtml(value) {
  return String(value ?? '').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const hexadecimal = entity[1]?.toLowerCase() === 'x';
      const point = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

export function stripTags(value) {
  return normalizeCapturedText(decodeHtml(String(value ?? '')
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')));
}

export function extractAttribute(attributes, name) {
  const match = String(attributes ?? '').match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return decodeHtml(match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
}

export function extractElement(html, tag, predicate = () => true) {
  const pattern = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  for (const match of String(html).matchAll(pattern)) {
    const element = { attributes: match[1], html: match[2], text: stripTags(match[2]) };
    if (predicate(element)) return element;
  }
  return null;
}

export function extractElements(html, tags) {
  const pattern = new RegExp(`<(${tags.join('|')})\\b([^>]*)>([\\s\\S]*?)<\\/\\1>`, 'gi');
  return [...String(html).matchAll(pattern)].map((match) => ({
    tag: match[1].toLowerCase(),
    attributes: match[2],
    html: match[3],
    text: stripTags(match[3]),
    index: match.index,
  })).filter((element) => element.text);
}

export function extractMetaContent(html, name) {
  const pattern = /<meta\b([^>]*)>/gi;
  for (const match of String(html).matchAll(pattern)) {
    const attributes = match[1];
    const key = extractAttribute(attributes, 'name') || extractAttribute(attributes, 'property');
    if (key.toLowerCase() === name.toLowerCase()) return extractAttribute(attributes, 'content');
  }
  return '';
}

export function extractTitle(html) {
  return extractElement(html, 'h1')?.text || extractElement(html, 'title')?.text || '';
}

export function extractElementByClass(html, tag, className) {
  const token = new RegExp(`(?:^|\\s)${className}(?:\\s|$)`, 'i');
  return extractElement(html, tag, ({ attributes }) => token.test(extractAttribute(attributes, 'class')));
}

export function extractBoundedClassRegion(html, className, endClassNames = []) {
  const source = String(html);
  const opening = new RegExp(`<([a-z0-9]+)\\b([^>]*\\bclass\\s*=\\s*(?:"[^"]*\\b${className}\\b[^"]*"|'[^']*\\b${className}\\b[^']*')[^>]*)>`, 'i').exec(source);
  if (!opening) return null;
  const start = opening.index + opening[0].length;
  const candidates = [];
  for (const endClass of endClassNames) {
    const marker = new RegExp(`<[a-z0-9]+\\b[^>]*\\bclass\\s*=\\s*(?:"[^"]*\\b${endClass}\\b[^"]*"|'[^']*\\b${endClass}\\b[^']*')`, 'i').exec(source.slice(start));
    if (marker) candidates.push(start + marker.index);
  }
  const mainEnd = source.toLowerCase().indexOf('</main>', start);
  if (mainEnd >= 0) candidates.push(mainEnd);
  if (candidates.length === 0) {
    const tagEnd = source.toLowerCase().indexOf(`</${opening[1].toLowerCase()}>`, start);
    if (tagEnd >= 0) candidates.push(tagEnd);
  }
  if (candidates.length === 0) return null;
  return source.slice(start, Math.min(...candidates));
}

export function requireElement(html, tag, label = tag) {
  const element = extractElement(html, tag);
  if (!element) throw new SourceLayoutMismatchError(`Expected ${label} was not found`);
  return element;
}

export function htmlToText(html) {
  const segments = extractElements(html, ['h1', 'h2', 'h3', 'p', 'dt', 'dd', 'th', 'td']).map(({ text }) => text);
  return normalizeCapturedText(segments.join('\n\n'));
}
