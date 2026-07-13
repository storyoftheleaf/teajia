import { expect, test } from '@playwright/test';

test('failed inquiry remains editable and offers a populated email fallback', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/inquiries', route => {
    attempts += 1;
    return attempts === 1
      ? route.fulfill({ status: 503, json: { error: 'offline' } })
      : route.fulfill({ status: 201, json: { ok: true } });
  });
  await page.goto('/advise');
  await page.getByRole('button', { name: 'Start a conversation' }).first().click();
  await page.getByLabel('Your name').fill('Lin Chen');
  await page.getByLabel('your@email.com').fill('lin@example.com');
  await page.getByLabel(/Tell me what you're envisioning/).fill('I would like a tea program for a small studio.');
  await page.getByLabel('your@email.com').press('Enter');

  await expect(page.getByRole('alert')).toContainText('not delivered');
  await expect(page.getByText("Thank you. I'll be in touch soon.")).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  const href = await page.getByRole('link', { name: 'email hello@teajia.com' }).getAttribute('href');
  expect(href).toContain('mailto:hello@teajia.com');
  expect(decodeURIComponent(href || '')).toContain('Lin Chen');
  expect(decodeURIComponent(href || '')).toContain('I would like a tea program for a small studio.');
  const draft = await page.evaluate(() => localStorage.getItem('teajia_inquiry_draft'));
  expect(JSON.parse(draft || '{}').email).toBe('lin@example.com');

  await page.getByLabel('your@email.com').press('Enter');
  await expect(page.getByText("Thank you. I'll be in touch soon.")).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('teajia_inquiry_draft'))).toBeNull();
});

test('storage failure never claims that the inquiry draft was saved', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'teajia_inquiry_draft') throw new DOMException('blocked', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.route('**/api/inquiries', route => route.fulfill({ status: 503, json: { error: 'offline' } }));
  await page.goto('/advise');
  await page.getByRole('button', { name: 'Start a conversation' }).first().click();
  await page.getByLabel('Your name').fill('Mei');
  await page.getByLabel('your@email.com').fill('mei@example.com');
  await page.getByLabel(/Tell me what you're envisioning/).fill('A small private tea gathering.');
  await page.getByLabel('your@email.com').press('Enter');

  await expect(page.getByRole('alert')).toContainText('could not save your draft');
  await expect(page.getByRole('alert')).not.toContainText('draft is saved');
  await expect(page.getByRole('link', { name: 'email hello@teajia.com' })).toHaveAttribute('href', /mailto:hello@teajia\.com/);
});

test('corrupt saved fields fall back safely without breaking interests or email fallback', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('teajia_inquiry_draft', JSON.stringify({ interests: null, name: 42 }));
  });
  await page.route('**/api/inquiries', route => route.fulfill({ status: 503, json: { error: 'offline' } }));
  await page.goto('/advise');
  await page.getByRole('button', { name: 'Start a conversation' }).first().click();

  await expect(page.getByLabel('Your name')).toHaveValue('');
  await page.getByRole('button', { name: 'Tell us more (optional)' }).click();
  await page.getByText('Tea sourcing', { exact: true }).click();
  await expect(page.getByLabel('Tea sourcing')).toBeChecked();
  await page.getByLabel('Your name').fill('Ari');
  await page.getByLabel('your@email.com').fill('ari@example.com');
  await page.getByLabel(/Tell me what you're envisioning/).fill('A guided tasting.');
  await page.getByLabel('your@email.com').press('Enter');

  const fallback = page.getByRole('link', { name: 'email hello@teajia.com' });
  await expect(fallback).toBeVisible();
  expect(decodeURIComponent(await fallback.getAttribute('href') || '')).toContain('Tea sourcing');
});
