/**
 * A host connects ChatGPT or Claude by signing in (OAuth), on the site's own
 * page, with mocked routes. The page names the app, says what it reaches,
 * and sends the host's own approval, never shop scopes.
 */
import { expect, test } from './fixtures';

test.use({ viewport: { width: 390, height: 844 } });

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = [encode({ alg: 'HS256', typ: 'JWT' }), encode({
  sub: 'ana', email: 'ana@example.test', name: 'Ana Host', role: 'user', memberships: [],
  active_account_id: null, exp: Math.floor(Date.now() / 1000) + 3600,
}), 'signature'].join('.');

test('a signed-in host connects Claude, and only their own part is asked for', async ({ page }) => {
  const decisions: unknown[] = [];
  await page.addInitScript(jwt => localStorage.setItem('teajia_token', jwt), token);
  await page.route('**/oauth/authorize/request/req-1', route => route.fulfill({
    json: { client_id: 'c1', client_name: 'Claude', redirect_uri: 'https://claude.ai/api/mcp/auth_callback', code_challenge: 'x', code_challenge_method: 'S256' },
  }));
  await page.route('**/oauth/authorize/decision', async route => {
    decisions.push(route.request().postDataJSON());
    return route.fulfill({ json: { redirect_to: `${new URL(page.url()).origin}/account/host?connected=1` } });
  });
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await page.goto('/connect/req-1');
  await expect(page.getByRole('heading', { level: 1, name: 'Connect Claude' })).toBeVisible();
  await expect(page.getByText('Nothing of the shop.', { exact: false })).toBeVisible();
  await page.getByTestId('connect-assistant-allow').click();
  await expect(page).toHaveURL(/\/account\/host\?connected=1$/);
  expect(decisions).toEqual([{ request_id: 'req-1', host: true }]);
});

test('signed out, the page asks to sign in and comes back here', async ({ page }) => {
  await page.route('**/oauth/authorize/request/req-2', route => route.fulfill({
    json: { client_id: 'c1', client_name: 'ChatGPT', redirect_uri: 'https://chatgpt.com/connector_platform_oauth_redirect' },
  }));
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await page.goto('/connect/req-2');
  await expect(page.getByRole('heading', { level: 1, name: 'Connect ChatGPT' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in to connect' })).toHaveAttribute('href', /returnTo=%2Fconnect%2Freq-2/);
});
