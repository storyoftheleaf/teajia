import { expect, test } from '@playwright/test';

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'owner', role: 'owner', active_account_id: 'acct', memberships: [{ account_id: 'acct', role: 'owner' }], exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const article = { id: 'legacy', account_id: 'acct', title: 'Legacy Article', slug: 'legacy', status: 'draft', author_id: 'legacy-writer', subject_ids: [], pull_quote: '', pull_quote_subject: '', tags: [], blocks: [], created_at: '2026-01-01', updated_at: '2026-01-01' };

test('article editor selects account contributors while preserving the current legacy author', async ({ page }) => {
  let update: any = null;
  await page.addInitScript(jwt => localStorage.setItem('teajia_token', jwt), token);
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (path === '/api/admin/articles' && request.method() === 'GET') return route.fulfill({ json: [article] });
    if (path === '/api/admin/articles/legacy' && request.method() === 'GET') return route.fulfill({ json: article });
    if (path === '/api/admin/articles/legacy' && request.method() === 'PUT') { update = JSON.parse(request.postData() || '{}'); return route.fulfill({ json: { ...article, ...update } }); }
    if (path === '/api/admin/contributors') return route.fulfill({ json: { contributors: [
      { id: 'writer-one', display_name: 'Writer One', account_id: 'acct', links: [], is_published: 1 },
      { id: 'subject-one', display_name: 'Subject One', account_id: 'acct', links: [], is_published: 1 },
    ] } });
    return route.fulfill({ json: {} });
  });
  await page.goto('/admin/magazine');
  await page.getByRole('button', { name: /Legacy Article/ }).click();
  const mobileMetadata = page.getByText('Article Metadata', { exact: true });
  if (await mobileMetadata.isVisible()) await mobileMetadata.click();
  const author = page.locator('select[aria-label="Author"]:visible');
  await expect(author).toHaveValue('legacy-writer');
  await expect(author.locator('option:checked')).toHaveText('Legacy author: legacy-writer');
  await author.selectOption('writer-one');
  await page.locator('select[aria-label="Pull quote subject"]:visible').selectOption('subject-one');
  await page.getByLabel('Pull quote', { exact: true }).filter({ visible: true }).fill('A synthetic pull quote.');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => update).toMatchObject({ author_id: 'writer-one', pull_quote_subject: 'subject-one', pull_quote: 'A synthetic pull quote.' });
  expect(JSON.stringify(update)).not.toContain('Barry');
});
