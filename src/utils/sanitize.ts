/**
 * Basic HTML sanitizer to prevent XSS when using dangerouslySetInnerHTML.
 * Strips script tags, SVG with event handlers, iframes, event handler attributes,
 * and dangerous URL protocols including javascript:, vbscript:, and encoded variants.
 */

const DANGEROUS_TAGS = /(<script[\s\S]*?<\/script>|<iframe[\s\S]*?<\/iframe>|<object[\s\S]*?<\/object>|<embed[\s\S]*?\/??>|<svg[\s\S]*?<\/svg>)/gi;
const EVENT_HANDLERS = /\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi;
const DANGEROUS_PROTOCOLS = /(href|src|action)\s*=\s*["']?\s*(javascript|vbscript|data\s*:\s*text\/html)[\s:]/gi;

export function sanitizeHTML(html: string | undefined): string {
  if (!html) return '';
  return html
    .replace(DANGEROUS_TAGS, '')
    .replace(EVENT_HANDLERS, '')
    .replace(DANGEROUS_PROTOCOLS, '$1="#');
}
