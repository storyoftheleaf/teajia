/**
 * Launch 5, M6 part two: a host's own assistant key, at phone size, with
 * mocked routes (todo/plans/guests-and-tea-masters-launch-5-run.md, hard
 * question 2).
 *
 * On their own page, a host makes a key for their assistant, sees its secret
 * once, closes it, sees the key listed without the secret, and disconnects
 * it. Making one and the question before disconnecting are steps in the
 * address, so back closes either. Nothing on the page counts anything.
 *
 * Needs a site started with VITE_FEW_HOSTS_OPEN=true and
 * VITE_HOST_TOKENS_OPEN=true, and is skipped otherwise.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

test.skip(
  process.env.VITE_FEW_HOSTS_OPEN !== 'true' || process.env.VITE_HOST_TOKENS_OPEN !== 'true',
  'Needs a site started with VITE_FEW_HOSTS_OPEN=true and VITE_HOST_TOKENS_OPEN=true',
);
test.use({ viewport: { width: 390, height: 844 } });

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = [encode({ alg: 'HS256', typ: 'JWT' }), encode({
  sub: 'ana', email: 'ana@example.test', name: 'Ana Host', role: 'user', memberships: [],
  active_account_id: null, exp: Math.floor(Date.now() / 1000) + 3600,
}), 'signature'].join('.');

const SECRET = 'tjmcp_ThisIsTheOneTimeSecretForAnaHostAssistant0001';
const MCP_URL = 'https://api.teajia.test/mcp';
type Key = { id: string; label: string; prefix: string; created_at: string; last_used_at: string | null };

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function openHostPage(page: Page) {
  const state = { keys: [] as Key[], made: [] as unknown[], revoked: [] as string[] };
  await page.addInitScript(jwt => localStorage.setItem('teajia_token', jwt), token);
  await page.route('**/api/**', async route => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();
    if (pathname === '/api/me/hosting') return route.fulfill({ json: { approved: true, account_id: 'ana-personal', doors: ['request', 'link'] } });
    if (pathname === '/api/me/tables' && method === 'GET') return route.fulfill({ json: { tables: [] } });
    if (pathname === '/api/me/assistant-tokens' && method === 'GET') {
      return route.fulfill({ json: { tokens: state.keys, may_connect: true, mcp_url: MCP_URL } });
    }
    if (pathname === '/api/me/assistant-tokens' && method === 'POST') {
      const body = request.postDataJSON() as { label: string };
      state.made.push(body);
      const key = { id: 'k-1', label: body.label, prefix: SECRET.slice(0, 14), created_at: '2026-11-26 09:00:00', last_used_at: null };
      state.keys = [key, ...state.keys];
      return route.fulfill({ status: 201, json: { ...key, token: SECRET, mcp_url: MCP_URL } });
    }
    const off = pathname.match(/^\/api\/me\/assistant-tokens\/([^/]+)$/);
    if (off && method === 'DELETE') {
      state.revoked.push(decodeURIComponent(off[1]));
      state.keys = state.keys.filter(key => key.id !== off[1]);
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto('/account/host');
  await expect(page.getByRole('heading', { name: 'Your assistant', level: 2 })).toBeVisible();
  return state;
}

test('a host makes a key for their assistant, sees it once, and disconnects it', async ({ page }) => {
  const state = await openHostPage(page);
  const section = page.getByTestId('host-assistant');

  await section.getByRole('button', { name: 'Connect an assistant' }).click();
  await expect(page).toHaveURL(/[?&]assistant=new/);
  // Back closes the form: it is a step in the address.
  await page.goBack();
  await expect(section.getByTestId('host-assistant-new')).toHaveCount(0);
  await page.goForward();
  const form = section.getByTestId('host-assistant-new');
  await expect(form).toBeVisible();
  await expect(form).toContainText(MCP_URL);

  const make = form.getByRole('button', { name: 'Make the key' });
  await expect(make).toBeDisabled();
  await form.getByRole('textbox', { name: 'Name it' }).fill('ChatGPT on my phone');
  await noSideScroll(page);
  await make.click();

  expect(state.made).toEqual([{ label: 'ChatGPT on my phone' }]);
  const shown = section.getByTestId('host-assistant-secret');
  await expect(shown).toBeVisible();
  await expect(shown.getByTestId('host-assistant-secret-value')).toHaveValue(SECRET);
  await expect(shown).toContainText('shown this once');
  await noSideScroll(page);
  await shown.getByRole('button', { name: 'Done' }).click();

  // The secret is gone from the page and never comes back in the list.
  await expect(page).not.toHaveURL(/assistant=/);
  await expect(section.getByTestId('host-assistant-secret')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(SECRET);
  const row = section.getByTestId('host-assistant-key');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('ChatGPT on my phone');
  await expect(row).toContainText('Not used yet');
  // Nothing here counts anything.
  await expect(section).not.toContainText(/\d+ (keys|assistants|calls|uses)/);

  await row.getByRole('button', { name: 'Disconnect' }).click();
  await expect(page).toHaveURL(/[?&]assistant=off-k-1/);
  const ask = row.getByTestId('host-assistant-disconnect');
  await expect(ask).toContainText('It stops working at once');
  // Back closes the question without disconnecting.
  await page.goBack();
  await expect(row.getByTestId('host-assistant-disconnect')).toHaveCount(0);
  expect(state.revoked).toEqual([]);
  await page.goForward();
  await noSideScroll(page);
  await row.getByTestId('host-assistant-disconnect').getByRole('button', { name: 'Disconnect' }).click();

  expect(state.revoked).toEqual(['k-1']);
  await expect(section.getByTestId('host-assistant-key')).toHaveCount(0);
  await expect(page).not.toHaveURL(/assistant=/);
  await expect(section.getByRole('button', { name: 'Connect an assistant' })).toBeVisible();
});
