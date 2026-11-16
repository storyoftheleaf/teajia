import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  adminAppImports, adminRoutes, ADMIN_APP_TEXT, localComponentText, resolveAddress, type AdminRoute,
} from './routeTable.testkit';
import {
  appSourceFiles, importClosure, isCommentLine, isTestSupportFile, lineOf, REPO_ROOT, SRC_ROOT,
} from './sourceFiles.testkit';

// GUARD: every admin link that carries a query has a reader.
//
// The audit found links such as /admin/stock?search=<name> that nothing read,
// so the tap landed on an unfiltered page. This test finds every place the app
// writes an admin address with a query parameter (string and template
// literals: navigate(), <Link to>, href, window.location, helpers that build
// them), resolves the address through the <Navigate> table in AdminApp.tsx to
// the screen that finally draws, and asks whether that screen reads the
// parameter.
//
// "Reads" means the screen's own file or a file it imports (two levels down,
// leaving out src/lib and tests) holds `.get('<param>')`, `.getAll('<param>')`
// or `.has('<param>')`, or AdminApp.tsx seeds it for that path (the Stock
// search box). A parameter that arrives only through a variable name is not
// seen; add it to the list below with a note rather than loosening this.

/** One address written in the source. */
interface Written { path: string; param: string; file: string; line: number }

const READ_DEPTH = 2;

/** Read `/admin...?a=1&b=${x}` starting at an `/admin` that follows a quote, backtick or `}`. */
export function scanAdminLinks(text: string, file: string): Written[] {
  const out: Written[] = [];
  const lines = text.split('\n');
  const starts = text.matchAll(/(?<=['"`}])\/admin(?![A-Za-z0-9_-])/g);
  for (const start of starts) {
    const begin = start.index!;
    if (isCommentLine(lines[lineOf(text, begin) - 1])) continue;
    let i = begin + '/admin'.length;
    let path = '/admin';
    // Path: literal segments, with ${...} standing for one dynamic segment.
    for (;;) {
      const ch = text[i];
      if (ch === '$' && text[i + 1] === '{') { i = skipInterpolation(text, i); path += 'x'; continue; }
      if (ch !== undefined && /[A-Za-z0-9_\-/]/.test(ch)) { path += ch; i++; continue; }
      break;
    }
    if (text[i] !== '?') continue;
    i++;
    // Query: up to the end of the literal.
    const params: string[] = [];
    let current = '';
    let dynamicName = false;
    const flush = () => {
      if (current !== '') params.push(dynamicName ? '${dynamic}' : current);
      current = ''; dynamicName = false;
    };
    let inName = true;
    for (;;) {
      const ch = text[i];
      if (ch === undefined || /['"`\s)<>]/.test(ch)) break;
      if (ch === '$' && text[i + 1] === '{') {
        if (inName) dynamicName = true;
        i = skipInterpolation(text, i);
        continue;
      }
      if (ch === '&') { flush(); inName = true; i++; continue; }
      if (ch === '=') { inName = false; i++; continue; }
      if (inName) current += ch;
      i++;
    }
    flush();
    for (const param of params) out.push({ path: path.replace(/\/$/, ''), param, file, line: lineOf(text, begin) });
  }
  return out;
}

function skipInterpolation(text: string, at: number): number {
  let depth = 0;
  let i = at + 1;
  for (; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') { depth--; if (depth === 0) return i + 1; }
  }
  return i;
}

/** Every application file's admin links with a query, as (path, param) with all writing sites. */
function writtenPairs(): Map<string, Written[]> {
  const pairs = new Map<string, Written[]>();
  for (const f of appSourceFiles()) {
    for (const w of scanAdminLinks(f.text, f.rel)) {
      const key = `${w.path}?${w.param}`;
      pairs.set(key, [...(pairs.get(key) ?? []), w]);
    }
  }
  return pairs;
}

// ---- readers ------------------------------------------------------------

const importsOfAdminApp = adminAppImports();
const closureCache = new Map<string, string[]>();

function readsParam(text: string, param: string): boolean {
  const q = param.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\.(?:get|getAll|has)\\(\\s*['"\`]${q}['"\`]\\s*\\)`).test(text);
}

function filesOfScreen(name: string): string[] {
  if (closureCache.has(name)) return closureCache.get(name)!;
  const skip = (abs: string) => {
    const rel = abs.slice(REPO_ROOT.length + 1).split('\\').join('/');
    return isTestSupportFile(rel) || /^src\/lib\//.test(rel) || /\/types\.ts$/.test(rel);
  };
  const files = new Set<string>();
  const imported = importsOfAdminApp.get(name);
  if (imported) {
    importClosure(imported, READ_DEPTH, skip).forEach(f => files.add(f));
  } else {
    // A component defined inside AdminApp.tsx: its own body, and what it renders.
    const body = localComponentText(name) ?? '';
    for (const m of body.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)) {
      const target = importsOfAdminApp.get(m[1]);
      if (target) importClosure(target, READ_DEPTH, skip).forEach(f => files.add(f));
    }
  }
  const out = [...files];
  closureCache.set(name, out);
  return out;
}

/** Who reads `param` for the route that draws the screen: file labels, empty when nobody does. */
function readersOf(leaf: AdminRoute, param: string): string[] {
  const readers: string[] = [];
  for (const screen of leaf.screens) {
    const local = localComponentText(screen);
    if (local && readsParam(local, param)) readers.push(`AdminApp.tsx (${screen})`);
    for (const abs of filesOfScreen(screen)) {
      if (readsParam(readFileSync(abs, 'utf8'), param)) readers.push(abs.slice(REPO_ROOT.length + 1).split('\\').join('/'));
    }
  }
  // The shell: an effect in AdminApp.tsx that reads a param for one path, as Stock's search seed does.
  const pathname = leaf.pattern;
  for (const m of ADMIN_APP_TEXT.matchAll(/pathname\.includes\('([^']+)'\)[\s\S]{0,400}?\.get\('([A-Za-z0-9_]+)'\)/g)) {
    if (m[2] === param && (pathname === m[1] || pathname.startsWith(m[1] + '/'))) readers.push('AdminApp.tsx (shell seeding effect)');
  }
  // The index route draws nothing of its own; the shell is the reader.
  if (leaf.screens.length === 0) {
    if (readsParam(ADMIN_APP_TEXT, param)) readers.push('AdminApp.tsx (shell)');
    // The sign-in bounce (/admin?next=) is read by the helper the shell calls.
    const authReturn = readFileSync(`${SRC_ROOT}admin/authNavigation.ts`, 'utf8');
    if (readsParam(authReturn, param)) readers.push('src/admin/authNavigation.ts');
  }
  return readers;
}

/** The writing sites of a pair whose address, followed through redirects, ends at a screen that does not read it. */
function unreadPairs(): Map<string, { written: Written[]; via: string[]; unmatched: boolean }> {
  const routes = adminRoutes();
  const unread = new Map<string, { written: Written[]; via: string[]; unmatched: boolean }>();
  for (const [key, written] of writtenPairs()) {
    const { path, param } = written[0];
    const resolved = resolveAddress(routes, path);
    const leaves = resolved.leaves;
    const everyLeafReads = leaves.length > 0 && leaves.every(leaf => readersOf(leaf, param).length > 0);
    if (!everyLeafReads) unread.set(key, { written, via: resolved.via, unmatched: resolved.unmatched });
  }
  return unread;
}

// ---- the allow-list -----------------------------------------------------
//
// Pairs written today that no screen reads. The list may only shrink: a pair
// that gets a reader (or stops being written) must be removed, and a new
// unread pair is a failure, not an addition. Each entry names the file that
// writes it; the line is where it was on 2026-11-11 and may drift.
//
// Format: 'path?param': 'file:line, what the tap does today'
const UNREAD_TODAY: Record<string, string> = {
  // OrdersView links an order with no session to the Sessions list, filtered by
  // the customer's name. EventsManager keeps its search in component state and
  // never reads the address, so the tap lands on the full list.
  '/admin/events?search':
    'src/admin/components/OrdersView.tsx:642, :748 and :931; lands on the unfiltered Sessions list',
  // SoldItemsView sends "view in catalog" to /admin/catalog. CatalogView does not
  // read search (only a platform account is redirected to Stock, which seeds the
  // search box), so everyone else lands on the whole catalog.
  '/admin/catalog?search':
    'src/admin/components/SoldItemsView.tsx:303 and :579; lands on the unfiltered catalog for a non-platform account',
  // "Add to Curate" from a sample page. Nothing in either Curate reads
  // fromSample, so the tap opens Sourcing without the sample attached.
  '/admin/compass?fromSample':
    'src/pages/SamplePage.tsx:574; opens Sourcing with nothing carried over',
};

describe('every admin link with a query has a reader', () => {
  const unread = unreadPairs();
  const pairs = writtenPairs();

  it('finds the links (the scanner has not gone blind)', () => {
    expect(pairs.size).toBeGreaterThan(25);
    expect(pairs.has('/admin/stock?panel')).toBe(true);
    expect(pairs.has('/admin/activity?tab')).toBe(true);
    expect(pairs.has('/admin/events/x?tab')).toBe(true);
  });

  it('names no parameter through a variable', () => {
    const dynamic = [...pairs.entries()].filter(([key]) => key.endsWith('?${dynamic}'));
    expect(dynamic.map(([, w]) => `${w[0].file}:${w[0].line}`)).toEqual([]);
  });

  it('has no unread parameter that is not on the allow-list', () => {
    const fresh = [...unread.entries()].filter(([key]) => !(key in UNREAD_TODAY));
    const message = fresh.map(([key, v]) => {
      const where = v.written.map(w => `${w.file}:${w.line}`).join(', ');
      const via = v.via.length ? ` (redirects to ${v.via.join(', ')})` : '';
      return `${key}${via} written at ${where}`;
    });
    expect(
      message,
      'These links carry a query parameter that the screen they open never reads, so the tap lands on an unfiltered page. '
      + 'Make the screen read the parameter (useSearchParams), or link without it. Do not add it to UNREAD_TODAY.',
    ).toEqual([]);
  });

  it('keeps the allow-list honest: every entry is still written and still unread', () => {
    const gone = Object.keys(UNREAD_TODAY).filter(key => !pairs.has(key));
    expect(gone, 'No longer written anywhere: delete these from UNREAD_TODAY.').toEqual([]);
    const nowRead = Object.keys(UNREAD_TODAY).filter(key => pairs.has(key) && !unread.has(key));
    expect(nowRead, 'A screen reads these now: delete them from UNREAD_TODAY so the list shrinks.').toEqual([]);
  });

  it('names the files that write each allow-listed pair', () => {
    for (const [key, note] of Object.entries(UNREAD_TODAY)) {
      const files = (pairs.get(key) ?? []).map(w => w.file);
      expect(files.some(f => note.includes(f)), `${key}: the note must name a writing file (${files.join(', ')})`).toBe(true);
    }
  });
});
