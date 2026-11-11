import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SRC_ROOT, resolveImport } from './sourceFiles.testkit';

// The route table of src/admin/AdminApp.tsx, read as text: each <Route>, the
// screen components it renders and the <Navigate> it redirects to.

export const ADMIN_APP_PATH = join(SRC_ROOT, 'admin', 'AdminApp.tsx');
export const ADMIN_APP_TEXT = readFileSync(ADMIN_APP_PATH, 'utf8');

export interface AdminRoute {
  /** Full address pattern: `/admin/events/:id`. The index route is `/admin`. */
  pattern: string;
  /** The raw `<Route ...>` text, for readers that need it. */
  chunk: string;
  /** Capitalised components that draw the screen (wrappers left out). */
  screens: string[];
  /** Redirect targets, with any query they carry, as written. */
  redirects: string[];
}

const WRAPPERS = new Set(['Route', 'Navigate', 'ProtectedRoute', 'PageTransition', 'Suspense', 'Fragment', 'Routes']);

function normalise(pathname: string): string {
  const parts: string[] = [];
  for (const seg of pathname.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop(); else parts.push(seg);
  }
  return '/' + parts.join('/');
}

export function adminRoutes(): AdminRoute[] {
  const start = ADMIN_APP_TEXT.indexOf('<Routes>');
  const end = ADMIN_APP_TEXT.indexOf('</Routes>');
  if (start < 0 || end < 0) throw new Error('AdminApp.tsx no longer has a <Routes> block this guard can read');
  const block = ADMIN_APP_TEXT.slice(start, end);
  const chunks = block.split(/(?=<Route\s)/).filter(c => /^<Route\s/.test(c));
  return chunks.map(chunk => {
    const rel = /<Route\s+path="([^"]*)"/.exec(chunk)?.[1];
    if (rel === undefined) throw new Error(`A <Route> in AdminApp.tsx has no literal path: ${chunk.slice(0, 80)}`);
    const pattern = rel === '/' ? '/admin' : rel === '*' ? '/admin/*' : '/admin/' + rel;
    const screens = [...new Set([...chunk.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)].map(m => m[1]).filter(n => !WRAPPERS.has(n)))];
    const redirects = [...chunk.matchAll(/carryQuery\(\s*"([^"]+)"/g)].map(m => {
      const target = m[1];
      if (target.startsWith('/')) return target;
      // A relative target resolves against /admin/<route> as the router does.
      const [p, q] = target.split('?');
      return normalise('/admin/' + rel + '/' + p) + (q ? '?' + q : '');
    });
    return { pattern, chunk, screens, redirects };
  });
}

function patternToRegExp(pattern: string): RegExp {
  const body = pattern.split('/').map(seg => (seg.startsWith(':') ? '[^/]+' : seg === '*' ? '.*' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/');
  return new RegExp('^' + body + '/?$');
}

/** The route that serves an address, the splat route last. Null only when there is no splat. */
export function matchRoute(routes: AdminRoute[], pathname: string): AdminRoute | null {
  const exact = routes.filter(r => r.pattern !== '/admin/*').find(r => patternToRegExp(r.pattern).test(pathname));
  return exact ?? routes.find(r => r.pattern === '/admin/*') ?? null;
}

export interface Resolved {
  /** Routes that finally draw something, after following redirects. */
  leaves: AdminRoute[];
  /** The chain of redirect targets followed, for the failure message. */
  via: string[];
  /** True when the address matched no route and fell to the splat redirect. */
  unmatched: boolean;
}

/** Follow `<Navigate>` redirects from an address to the routes that draw screens. */
export function resolveAddress(routes: AdminRoute[], address: string, seen = new Set<string>()): Resolved {
  const pathname = address.split('?')[0].replace(/\/$/, '') || '/admin';
  const route = matchRoute(routes, pathname);
  if (!route || seen.has(pathname)) return { leaves: [], via: [], unmatched: !route };
  seen.add(pathname);
  const unmatched = route.pattern === '/admin/*';
  const leaves: AdminRoute[] = [];
  const via: string[] = [];
  if (route.screens.length > 0 || route.redirects.length === 0) leaves.push(route);
  for (const target of route.redirects) {
    via.push(target);
    const next = resolveAddress(routes, target, seen);
    leaves.push(...next.leaves);
    via.push(...next.via);
  }
  return { leaves, via, unmatched };
}

// ---- screens ------------------------------------------------------------

/** Component name to the file it is imported from in AdminApp.tsx (static, lazy, default or named). */
export function adminAppImports(): Map<string, string> {
  const map = new Map<string, string>();
  const add = (names: string[], spec: string) => {
    const abs = resolveImport(ADMIN_APP_PATH, spec);
    if (abs) for (const n of names) map.set(n, abs);
  };
  for (const m of ADMIN_APP_TEXT.matchAll(/^import\s+(?!type\b)([\w$]+)?\s*,?\s*(?:\{([^}]*)\})?\s*from\s+['"]([^'"]+)['"]/gm)) {
    const names: string[] = [];
    if (m[1]) names.push(m[1]);
    if (m[2]) names.push(...m[2].split(',').map(s => s.trim().split(/\s+as\s+/).pop()!).filter(Boolean));
    add(names, m[3]);
  }
  for (const m of ADMIN_APP_TEXT.matchAll(/^const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]/gm)) add([m[1]], m[2]);
  return map;
}

/** The text of a component defined inside AdminApp.tsx (`const Name ... = ... => {` to its closing `};`). */
export function localComponentText(name: string): string | null {
  const start = ADMIN_APP_TEXT.search(new RegExp(`^const ${name}\\b`, 'm'));
  if (start < 0) return null;
  const end = ADMIN_APP_TEXT.indexOf('\n};', start);
  return end < 0 ? null : ADMIN_APP_TEXT.slice(start, end + 3);
}
