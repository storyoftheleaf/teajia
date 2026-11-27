/**
 * Shared helpers for the review walks (tests/review/README.md).
 *
 *   signIn(page, who)            signs in through the rig's worker and stores the token, as the site does
 *   noSideScroll(page, where)    soft-fails on any horizontal overflow
 *   quiet(page)                  collects page errors and failed /api calls; call .check() at the end
 *   task(page, name, budget, fn) counts clicks, fields filled and address changes inside fn, and
 *                                appends one row to test-results/review/steps.json
 *
 * The tap budget (the run sheet, "How much is a tap budget?"): two taps to reach
 * anything from Home or from the page of the thing it belongs to. For entering,
 * only what the site cannot know. A row over budget is recorded, not failed;
 * U1 reads the ledger.
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { expect, stubBrowserServices } from '../fixtures';

export const REVIEW_SITE = process.env.REVIEW_SITE ?? 'http://localhost:7910';
export const REVIEW_API = process.env.REVIEW_API ?? 'http://127.0.0.1:8910';
export const SITE_SET = process.env.REVIEW_SITE_SET ?? 'all';
export const WORKER_SET = process.env.REVIEW_WORKER_SET ?? SITE_SET;
export const BALI = 'acc_teajia_bali';

/** The fixture people. Passwords are the usernames. */
export const PEOPLE = {
  /** The shop's owner (Adrian's role). */
  owner: 'sandbox',
  /** An approved host with a finished table, one on now and one ahead. */
  host: 'ana',
  /** A guest with an account, a finished table and an order. */
  guest: 'mei',
} as const;
export type Who = keyof typeof PEOPLE | (string & {});

export type Session = { token: string; account: string };

// The worker limits sign-ins, and the walks sign the same three people in many
// times, so a token is kept per worker address for the rig's life.
const TOKENS = join(process.cwd(), 'test-results', 'review', 'tokens.json');
function cachedTokens(): Record<string, Session> {
  try { return JSON.parse(readFileSync(TOKENS, 'utf8')); } catch { return {}; }
}

export async function login(page: Page, who: Who, api = REVIEW_API, opts: { fresh?: boolean } = {}): Promise<Session> {
  const name = (PEOPLE as Record<string, string>)[who] ?? who;
  const key = `${api} ${name}`;
  const cached = cachedTokens()[key];
  if (cached && !opts.fresh) {
    const check = await page.request.get(`${api}/api/auth/me`, { headers: { Authorization: `Bearer ${cached.token}` } });
    if (check.ok()) return { ...cached };
  }
  const response = await page.request.post(`${api}/api/auth/login`, { data: { identifier: name, password: name } });
  expect(response.status(), `sign in ${name}`).toBe(200);
  const body = await response.json() as { token: string; active_account_id: string | null };
  const session = { token: body.token, account: body.active_account_id ?? '' };
  mkdirSync(dirname(TOKENS), { recursive: true });
  writeFileSync(TOKENS, JSON.stringify({ ...cachedTokens(), [key]: session }, null, 2));
  return { ...session };
}

/** Signs in and stores the token before any page script runs. Call before the first goto. */
export async function signIn(page: Page, who: Who, opts: { account?: string } = {}): Promise<Session> {
  await stubBrowserServices(page.context());
  const session = await login(page, who);
  if (opts.account) session.account = opts.account;
  await page.context().addInitScript(({ token, account }) => {
    localStorage.setItem('teajia_token', token);
    if (account) localStorage.setItem('teajia_active_account', account);
  }, session);
  return session;
}

/** Calls the rig's worker directly, as a person or signed out. */
export async function call(page: Page, session: Session | null, path: string, init: { method?: string; data?: unknown; account?: string } = {}) {
  const headers: Record<string, string> = {};
  if (session) headers.Authorization = `Bearer ${session.token}`;
  const account = init.account ?? session?.account;
  if (account) headers['X-Teajia-Account'] = account;
  const response = await page.request.fetch(`${REVIEW_API}${path}`, {
    method: init.method ?? 'GET', headers, ...(init.data !== undefined ? { data: init.data } : {}),
  });
  const text = await response.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { status: response.status(), body };
}

export async function noSideScroll(page: Page, where: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect.soft(overflow, `horizontal overflow in px: ${where}`).toBeLessThanOrEqual(0);
}

/**
 * Watches for page errors and failed API calls. A 404 from a closed switch is
 * not a failure here; pass allow to name others that are expected.
 */
export function quiet(page: Page, allow: RegExp[] = []) {
  const problems: string[] = [];
  page.on('pageerror', e => problems.push(`page error: ${e.message}`));
  page.on('response', r => {
    const url = r.url();
    if (!url.includes('/api/') || r.status() < 500) return;
    if (allow.some(a => a.test(url))) return;
    problems.push(`${r.status()} ${r.request().method()} ${url}`);
  });
  return {
    problems,
    check(where = '') { expect.soft(problems, `errors ${where}`).toEqual([]); },
  };
}

export type StepRow = {
  task: string;
  test: string;
  project: string;
  site_set: string;
  worker_set: string;
  clicks: number;
  fields: number;
  address_changes: number;
  budget: { clicks: number; fields?: number };
  over_budget: boolean;
  path: string[];
  at: string;
};

const STEPS = join(process.cwd(), 'test-results', 'review', 'steps.json');

type Counts = { clicks: number; fields: number; address_changes: number };
const COUNTERS = new WeakMap<Page, Counts>();

/** The page's one counter. exposeFunction binds once per page, so every task on a page shares it. */
async function pageCounter(page: Page): Promise<Counts> {
  const existing = COUNTERS.get(page);
  if (existing) return existing;
  const counts: Counts = { clicks: 0, fields: 0, address_changes: 0 };
  COUNTERS.set(page, counts);
  await page.exposeFunction('__reviewCount', (kind: 'click' | 'field') => {
    if (kind === 'click') counts.clicks++; else counts.fields++;
  });
  const install = () => {
    const w = window as any;
    if (w.__reviewInstalled) return;
    w.__reviewInstalled = true;
    const seen = new WeakSet<EventTarget>();
    document.addEventListener('click', e => { if (e.isTrusted) w.__reviewCount?.('click'); }, true);
    // A field counts once per focus in which it changes.
    document.addEventListener('focusin', e => { if (e.target) seen.delete(e.target); }, true);
    document.addEventListener('input', e => {
      if (!e.isTrusted || !e.target || seen.has(e.target)) return;
      seen.add(e.target);
      w.__reviewCount?.('field');
    }, true);
  };
  await page.addInitScript(install);
  await page.evaluate(install).catch(() => { /* no document yet */ });
  return counts;
}

/**
 * Runs fn and counts what a person would do in it: clicks and taps, fields
 * filled or typed into, and changes of address. The row goes to steps.json
 * (an array, appended to). Over budget is recorded, never failed.
 */
export async function task<T>(
  page: Page,
  name: string,
  budget: number | { clicks: number; fields?: number },
  fn: () => Promise<T>,
  info?: TestInfo,
): Promise<T> {
  const b = typeof budget === 'number' ? { clicks: budget } : budget;
  const counts = await pageCounter(page);
  const path: string[] = [new URL(page.url() || REVIEW_SITE, REVIEW_SITE).pathname];
  const onNav = (frame: any) => {
    if (frame !== page.mainFrame()) return;
    const p = new URL(frame.url()).pathname + new URL(frame.url()).search;
    if (p !== path[path.length - 1]) { counts.address_changes++; path.push(p); }
  };
  page.on('framenavigated', onNav);
  // One counter per page, shared by every task on it; each task reads the difference.
  const start = { ...counts };
  try {
    return await fn();
  } finally {
    page.off('framenavigated', onNav);
    const row: StepRow = {
      task: name,
      test: info?.title ?? '',
      project: info?.project.name ?? '',
      site_set: SITE_SET,
      worker_set: WORKER_SET,
      clicks: counts.clicks - start.clicks,
      fields: counts.fields - start.fields,
      address_changes: counts.address_changes - start.address_changes,
      budget: b,
      over_budget: counts.clicks - start.clicks > b.clicks || (b.fields !== undefined && counts.fields - start.fields > b.fields),
      path,
      at: new Date().toISOString(),
    };
    recordStep(row);
  }
}

export function recordStep(row: StepRow) {
  mkdirSync(dirname(STEPS), { recursive: true });
  // One JSON row per line in a side file, so parallel workers never clobber each other.
  appendFileSync(`${STEPS}l`, JSON.stringify(row) + '\n');
  const rows = readFileSync(`${STEPS}l`, 'utf8').trim().split('\n').map(l => JSON.parse(l));
  writeFileSync(STEPS, JSON.stringify(rows, null, 2) + '\n');
}

export function readSteps(): StepRow[] {
  return existsSync(STEPS) ? JSON.parse(readFileSync(STEPS, 'utf8')) : [];
}
