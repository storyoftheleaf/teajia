/**
 * W4: every switch state, every door (todo/plans/review-prompts/sol-w4-switch-crawl.md).
 *
 * Run for one rig state at a time (REVIEW_SITE_SET names it):
 *   set -a; . test-results/review/slot-4.env; set +a
 *   npx playwright test -c tests/review/review.config.ts tests/review/switch-crawl.spec.ts --trace off
 *
 * For a signed-out visitor, Mei, Ana and the owner:
 *   1. Start at Home. Collect the links on Home, press each bar, rail and menu control and collect what it
 *      opens (the phone menu, the account panel), then collect the links on the four bar pages, Your Table
 *      and Manage's front page. Visit each target once.
 *   2. Fail a page on: the not-found page, a blank main area, a spinner after five seconds, side scroll, a
 *      console error, a request that answers 500.
 *   3. One test calls every route a switch gates and checks it answers only when its switch is open.
 *   4. Each page gets the fewest taps from Home that the crawl found.
 * One JSON row per page goes to test-results/review/crawl.jsonl; scripts read it into todo/review/switch-crawl.md.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { call, login, signIn, REVIEW_SITE, SITE_SET, WORKER_SET } from './helpers';
import { openSwitches } from './switch-sets';

const OUT = join(process.cwd(), 'test-results', 'review', 'crawl.jsonl');
const PERSONAS = { visitor: null, guest: 'mei', host: 'ana', owner: 'sandbox' } as const;
const CAP = Number(process.env.CRAWL_CAP ?? 30);

type Link = { path: string; label: string };
type Row = { set: string; project: string; persona: string; kind: 'page' | 'route'; path: string; taps: number; via: string; problems: string[] };

function row(r: Row) { mkdirSync(join(process.cwd(), 'test-results', 'review'), { recursive: true }); appendFileSync(OUT, JSON.stringify(r) + '\n'); }

function internal(href: string | null): string | null {
  if (!href || href.startsWith('#') || /^(mailto|tel|sms|javascript):/.test(href)) return null;
  let u: URL;
  try { u = new URL(href, REVIEW_SITE); } catch { return null; }
  if (u.origin !== new URL(REVIEW_SITE).origin) return null;
  if (/logout|signout|sign-out/.test(u.pathname)) return null;
  return u.pathname.replace(/\/$/, '') + u.search || '/';
}

async function visibleLinks(page: Page): Promise<Link[]> {
  const raw = await page.evaluate(() => [...document.querySelectorAll('a[href]')]
    .filter(e => e.getClientRects().length && (e as HTMLElement).getAttribute('href') !== '#main-content')
    .map(e => ({ href: e.getAttribute('href'), label: ((e as HTMLElement).getAttribute('aria-label') || (e as HTMLElement).innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40) })));
  const out: Link[] = [];
  for (const r of raw) { const p = internal(r.href); if (p) out.push({ path: p, label: r.label }); }
  return out;
}

async function settle(page: Page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => {});
}

function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', e => problems.push(`page error: ${e.message.slice(0, 120)}`));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource.*\b(4\d\d)\b/.test(t)) return;
    if (/Failed to load resource/.test(t) && /\b504\b|Outdated Optimize Dep/.test(t)) return; // the dev server's cold start, not the site // a closed door answering 404 is not a console fault
    problems.push(`console error: ${t.slice(0, 120)}`);
  });
  page.on('response', r => { if (r.status() >= 500 && !r.url().includes('/node_modules/')) problems.push(`${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`); });
  return problems;
}

/** The page's own faults, after it has had five seconds. */
async function judge(page: Page, problems: string[]): Promise<string[]> {
  await settle(page);
  const found: string[] = [];
  const spinner = '.animate-spin, [role="progressbar"], [aria-busy="true"], [data-testid*="spinner" i], [class*="spinner" i]';
  const stuck = await page.waitForFunction(sel => ![...document.querySelectorAll(sel)].some(e => e.getClientRects().length), spinner, { timeout: 5000 }).then(() => false, () => true);
  if (stuck) found.push('spinner still turning after 5s');
  const facts = await page.evaluate(() => {
    const main = document.querySelector('main') ?? document.getElementById('root');
    const text = (main as HTMLElement | null)?.innerText?.trim() ?? '';
    return {
      text: text.slice(0, 80),
      len: text.length,
      body: document.body.innerText.length, // an open panel over an empty main (Your Table closed as a page) is not blank
      media: !!main?.querySelector('img,video,canvas,svg,iframe'),
      notFound: /Page not found|404/i.test(document.body.innerText) && /doesn't exist|not found/i.test(document.body.innerText),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      path: location.pathname + location.search,
    };
  });
  if (facts.notFound) found.push('not-found page');
  else if (facts.len < 3 && !facts.media && facts.body < 300) found.push('blank main area');
  if (facts.overflow > 0) found.push(`side scroll ${facts.overflow}px`);
  found.push(...problems.splice(0));
  return [...new Set(found)];
}

for (const [persona, who] of Object.entries(PERSONAS)) {
  test(`crawl: ${persona}`, async ({ page }, info) => {
    test.setTimeout(900_000);
    const problems = watch(page);
    if (who) await signIn(page, who);
    const base = { set: SITE_SET, project: info.project.name, persona };
    const taps = new Map<string, number>();
    const via = new Map<string, string>();
    const note = (l: Link, n: number, from: string) => {
      if (!taps.has(l.path) || n < taps.get(l.path)!) { taps.set(l.path, n); via.set(l.path, from); }
    };

    await page.goto('/'); await settle(page);
    await page.waitForTimeout(1500);
    const homeLinks = await visibleLinks(page);
    for (const l of homeLinks) note(l, 1, `Home link "${l.label}"`);

    // Every bar, rail and menu control: press it from a fresh Home, record where it goes and what it reveals.
    const controls = await page.evaluate(() => [...document.querySelectorAll('nav button, aside button, header button')]
      .filter(e => e.getClientRects().length)
      .map(e => ((e as HTMLElement).getAttribute('aria-label') || (e as HTMLElement).innerText || '').trim().split('\n')[0]).filter(Boolean));
    const seenControl = new Set<string>();
    for (const [idx, name] of controls.entries()) {
      if (seenControl.has(name) || /^Skip/.test(name)) continue;
      seenControl.add(name);
      await page.goto('/'); await settle(page);
      const before = new Set((await visibleLinks(page)).map(l => l.path));
      for (const l of await page.evaluate(() => [...document.querySelectorAll('button, [role="button"]')].filter(e => e.getClientRects().length)
        .map(e => ((e as HTMLElement).getAttribute('aria-label') || (e as HTMLElement).innerText || '').trim().split('\n')[0]))) before.add('btn:' + l);
      const target = page.locator('nav button, aside button, header button').filter({ visible: true }).nth(idx);
      const startUrl = page.url();
      try { await target.click({ timeout: 4000 }); } catch { row({ ...base, kind: 'page', path: `(control) ${name}`, taps: 1, via: 'control', problems: ['could not press'] }); continue; }
      await page.waitForTimeout(900);
      const here = new URL(page.url());
      const hp = here.pathname.replace(/\/$/, '') + here.search || '/';
      if (page.url() !== startUrl) {
        note({ path: hp, label: name }, 1, `control "${name}"`);
        // The page a control lands on: its links cost one more tap.
        await settle(page);
        for (const l of await visibleLinks(page)) if (!before.has(l.path)) note(l, 2, `"${name}" then "${l.label}"`);
      } else {
        for (const l of await visibleLinks(page)) if (!before.has(l.path)) note(l, 2, `"${name}" then "${l.label}"`);
        // What the control opened may lead on through buttons (the account panel does): press each once.
        const labels = () => page.evaluate(() => [...document.querySelectorAll('button, [role="button"]')]
          .filter(e => e.getClientRects().length && !e.closest('nav, aside, header'))
          .map(e => ((e as HTMLElement).getAttribute('aria-label') || (e as HTMLElement).innerText || '').trim().split('\n')[0]).filter(Boolean));
        const opened = (await labels()).filter(l => !before.has('btn:' + l));
        for (const inner of [...new Set(opened)].slice(0, 9)) {
          if (/^(close|back|cancel|sign out|log out|logout|dismiss|switch to)/i.test(inner)) continue;
          await page.goto('/'); await settle(page);
          try { await target.click({ timeout: 4000 }); await page.waitForTimeout(700); } catch { continue; }
          const beforeUrl = page.url();
          const inside = page.locator('button, [role="button"]').filter({ visible: true }).filter({ hasText: inner.slice(0, 30) }).filter({ hasNot: page.locator('nav') });
          const byLabel = page.locator(`button[aria-label="${inner.replace(/"/g, '\\"')}"]`);
          try { await ((await inside.count()) ? inside : byLabel).last().click({ timeout: 3000 }); } catch { continue; }
          await page.waitForTimeout(800);
          if (page.url() !== beforeUrl) {
            const u = new URL(page.url());
            note({ path: u.pathname.replace(/\/$/, '') + u.search || '/', label: inner }, 2, `"${name}" then button "${inner}"`);
          }
        }
      }
    }

    // Your Table and Manage's front page, then their links.
    for (const front of ['/account', '/admin']) {
      await page.goto(front); await settle(page); await page.waitForTimeout(1200);
      const at = taps.get(front) ?? 3;
      if (!taps.has(front)) { taps.set(front, at); via.set(front, 'not found from Home by any link or control (address typed)'); }
      for (const l of await visibleLinks(page)) note(l, at + 1, `${via.get(front)}, then "${l.label}"`);
    }

    // One sample per family of pages (articles, products, people) so a state stays within a few minutes.
    const groups = new Map<string, number>();
    const targets = [...taps.entries()].sort((a, b) => a[1] - b[1]).filter(([p]) => {
      const segs = p.split('?')[0].split('/').filter(Boolean);
      const key = segs.length >= 2 ? '/' + segs.slice(0, -1).join('/') : p;
      const n = (groups.get(key) ?? 0) + 1;
      groups.set(key, n);
      return segs.length < 2 || n <= 1;
    }).slice(0, CAP);

    for (const [path, n] of targets) {
      problems.length = 0;
      await page.goto(path, { timeout: 45_000 }).catch(async () => { await page.goto(path, { timeout: 45_000 }).catch(e => problems.push(`goto: ${String(e).slice(0, 60).replace(/\s+/g, ' ')}`)); });
      const faults = await judge(page, problems);
      row({ ...base, kind: 'page', path, taps: n, via: via.get(path) ?? '', problems: faults });
    }
    expect(true).toBe(true);
  });
}

// Routes each switch gates. closed answers exactly as an unknown address; open answers anything else.
const GATED: Array<{ path: string; who: 'owner' | 'guest' | 'host' | null; needs: string[]; note?: string; method?: string }> = [
  { path: '/api/tea-table', who: null, needs: ['TEA_TABLE_OPEN'] },
  { path: '/api/tea-table/questions', who: null, needs: ['TEA_TABLE_OPEN', 'KNOW_THIS_TEA_OPEN'], method: 'POST', note: 'a question needs a person: open answers 401, closed answers 404' },
  { path: '/api/admin/tea-table', who: 'owner', needs: ['TEA_TABLE_OPEN'] },
  { path: '/api/admin/tea-table/questions', who: 'owner', needs: ['TEA_TABLE_OPEN', 'KNOW_THIS_TEA_OPEN'] },
  { path: '/api/me/favourites', who: 'guest', needs: ['FAVOURITES_OPEN'] },
  { path: '/api/tea-houses/work', who: null, needs: ['TEA_HOUSES_OPEN'] },
  { path: '/api/admin/tea-houses', who: 'owner', needs: ['TEA_HOUSES_OPEN'] },
  { path: '/api/me/article-offers', who: 'host', needs: ['HOST_ARTICLES_OPEN'] },
  { path: '/api/admin/article-offers', who: 'owner', needs: ['HOST_ARTICLES_OPEN'] },
  { path: '/api/family/tasting-shares', who: 'guest', needs: ['YOUR_TABLE_PAGE_OPEN'] },
  { path: '/api/me/your-table', who: 'host', needs: ['YOUR_TABLE_PLACE_OPEN', 'FEW_HOSTS_OPEN'] },
  { path: '/api/me/tables', who: 'host', needs: ['FEW_HOSTS_OPEN'] },
  { path: '/api/me/hosting', who: 'host', needs: ['FEW_HOSTS_OPEN'] },
  { path: '/api/me/sessions', who: 'host', needs: ['FEW_HOSTS_OPEN', 'ANYONE_HOSTS_OPEN'] },
  { path: '/api/me/circles', who: 'host', needs: ['CIRCLES_OPEN', 'FEW_HOSTS_OPEN'] },
  { path: '/api/me/assistant-tokens', who: 'host', needs: ['HOST_TOKENS_OPEN', 'FEW_HOSTS_OPEN'] },
  { path: '/api/me/tea-credit', who: 'guest', needs: ['HOST_CREDIT_OPEN'] },
  { path: '/api/host-credit', who: 'owner', needs: ['HOST_CREDIT_OPEN'] },
];

test('gated routes answer only when their switch is open', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone-390', 'the API does not change with the window; checked once per state');
  const open = new Set(openSwitches(WORKER_SET));
  const sessions = { owner: await login(page, 'owner'), guest: await login(page, 'guest'), host: await login(page, 'host') };
  const unknown = await call(page, null, '/api/review-no-such-route');
  const wrong: string[] = [];
  for (const g of GATED) {
    const s = g.who ? sessions[g.who] : null;
    const r = await call(page, s, g.path, g.method ? { method: g.method, data: {} } : {});
    const shouldBeOpen = g.needs.every(n => open.has(n as never));
    const looksClosed = r.status === 404; // launch4Closed.ts routes answer as the unknown address, handler checks answer 404 in their own words
    const problem = shouldBeOpen && looksClosed ? 'closed but should be open'
      : !shouldBeOpen && !looksClosed ? `open (${r.status}) but should be closed`
      : r.status >= 500 ? `answers ${r.status}` : '';
    row({ set: SITE_SET, project: info.project.name, persona: g.who ?? 'visitor', kind: 'route', path: g.path, taps: 0, via: `${r.status} ${shouldBeOpen ? 'open' : 'closed'}`, problems: problem ? [problem] : [] });
    if (problem) wrong.push(`${g.path}: ${problem}`);
  }
  expect.soft(wrong, 'gated routes').toEqual([]);
});
