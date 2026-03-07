/**
 * Basic HTML sanitizer to prevent XSS when using dangerouslySetInnerHTML.
 * Strips script tags, event handlers, and dangerous attributes.
 */

const DANGEROUS_TAGS = /(<script[\s>][\s\S]*?<\/script>|<iframe[\s>][\s\S]*?<\/iframe>|<object[\s>][\s\S]*?<\/object>|<embed[\s>][\s\S]*?\/??>)/gi;
const EVENT_HANDLERS = /\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi;
const JAVASCRIPT_URLS = /(href|src|action)\s*=\s*["']?\s*javascript:/gi;
const DATA_URLS = /(href|src)\s*=\s*["']?\s*data:\s*text\/html/gi;

export function sanitizeHTML(html: string | undefined): string {
  if (!html) return '';
  return html
    .replace(DANGEROUS_TAGS, '')
    .replace(EVENT_HANDLERS, '')
    .replace(JAVASCRIPT_URLS, '$1="')
    .replace(DATA_URLS, '$1="');
}
