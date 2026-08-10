import { expect, test, type Page } from '@playwright/test';

const SERVICES = [
  ['design', 'Tea House Design & Curation', '$5,000 – $100,000+', 'From concept through opening. Design, curation, tea selection, training, and operations.'],
  ['sourcing', 'Tea Curation & Sourcing', 'By inquiry', 'Direct sourcing from Taiwan, China, and trusted origins, for collectors, spaces, and communities.'],
  ['sessions', 'Sessions & Guidance', 'From $50', 'In the Bali studio or wherever you are.'],
] as const;

const OFFERINGS = [
  ['Open Sit', 'Free', 'Share tea at the studio. Event based or appointment.'],
  ['Guided Practice Setup', '$265', '2+ hours. Leave fully equipped. Includes $100 teaware credit.'],
  ['Group Ceremonial', 'Inquire', 'Up to 24 across two tearooms.'],
  ['Private & Events', 'From $500', 'Your gathering, your venue or ours. Retreats, dinners, festivals, celebrations.'],
] as const;

async function openAdvise(page: Page, theme: 'dark' | 'light' = 'dark') {
  await page.addInitScript(selectedTheme => localStorage.setItem('teajia_theme', selectedTheme), theme);
  await page.goto('/advise', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Tea spaces, sourcing, guidance.' })).toBeVisible();
}

test('preserves the Advice writing and groups the full offer into one ledger', async ({ page }) => {
  await openAdvise(page);
  const ledger = page.getByTestId('advise-services');
  await expect(ledger.getByRole('article')).toHaveCount(3);

  for (const [id, title, price, description] of SERVICES) {
    const row = ledger.locator(`[data-service-id="${id}"]`);
    await expect(row.getByRole('heading', { name: title })).toBeVisible();
    await expect(row.getByText(price, { exact: true })).toBeVisible();
    await expect(row.getByText(description, { exact: true })).toBeVisible();
  }

  const design = ledger.locator('[data-service-id="design"]');
  await expect(design.getByRole('link', { name: /Hotels, studios, and teams/i })).toHaveAttribute('href', '/for-your-space');

  const sessions = ledger.locator('[data-service-id="sessions"]');
  for (const [name, price, description] of OFFERINGS) {
    const offering = sessions.locator(`[data-offering-name="${name}"]`);
    await expect(offering.getByRole('heading', { name })).toBeVisible();
    await expect(offering.getByText(price, { exact: true })).toBeVisible();
    await expect(offering.getByText(description, { exact: true })).toBeVisible();
  }
});

test('uses distinct theme-aware section surfaces in dark and light modes', async ({ page }) => {
  for (const theme of ['dark', 'light'] as const) {
    await openAdvise(page, theme);
    const colors = await page.getByTestId('advise-page').evaluate(root => {
      const read = (id: string) => {
        const element = root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
        return element ? getComputedStyle(element).backgroundColor : '';
      };
      return {
        hero: read('advise-hero'),
        services: read('advise-services-band'),
        testimonial: read('advise-testimonial-band'),
        closing: read('advise-closing-band'),
      };
    });
    expect(colors.services).not.toBe(colors.hero);
    expect(colors.services).not.toBe(colors.testimonial);
    expect(colors.closing).not.toBe(colors.testimonial);
  }
});

test('stays within mobile width and leaves the locked bottom bar unchanged', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAdvise(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(2);

  const bottomBar = page.getByTestId('bottom-tab-bar');
  await expect(bottomBar).toBeVisible();
  await expect(bottomBar.getByRole('button', { name: 'Read' })).toBeVisible();
  await expect(bottomBar.getByRole('button', { name: 'Craft' })).toBeVisible();
  await expect(bottomBar.getByRole('button', { name: 'Advise' })).toHaveAttribute('aria-current', 'page');
  await expect(bottomBar.getByRole('button', { name: 'Shop' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Start a conversation', exact: true })).toHaveClass(/bottom-nav-gap/);
});

test('keeps the existing conversation action wired to the inquiry form', async ({ page }) => {
  await openAdvise(page);
  await page.getByRole('button', { name: /Every engagement begins with a conversation/i }).click();
  await expect(page.getByLabel('Your name')).toBeVisible();
});
