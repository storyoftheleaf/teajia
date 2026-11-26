import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const slug = 'oolong-evening';
const cardPath = `/admin/events/${slug}/card`;
const publicUrl = `https://teajia.com/event/${slug}`;

const teas = [
  { id: 'three', brew_order: 3, custom_name: 'Last Pour' },
  {
    id: 'one', brew_order: 1, product_name: 'Spring Rou Gui',
    product_year: 2024, product_origin_region: 'Wuyi', product_origin_country: 'China',
    retail_price_per_gram_usd: 123.45, stock_grams: 987,
  },
  { id: 'two', brew_order: 2, product_name: 'Mountain Oolong', product_origin_country: 'Taiwan' },
];

async function openCard(page: Page, menu = teas) {
  const headers = { 'access-control-allow-origin': '*' };
  await page.route(`**/api/events/${slug}/public`, route => route.fulfill({
    headers,
    json: {
      title: 'An Oolong Evening', slug, event_date: '2026-11-26T17:30:00Z',
      timezone: 'Asia/Taipei',
      hosts: [{ display_name: 'Lin Chen', role: 'lead_host' }],
      personal_link: 'https://teajia.com/after-sit/#private',
    },
  }));
  await page.route(`**/api/events/${slug}/tea-menu`, route => route.fulfill({ headers, json: menu }));

  // Mount the exports under the intended route until the build owner wires Manage.
  // Keep the Vite HTML preamble and the site's styles in this fixture.
  await page.route(`**${cardPath}*`, async route => {
    const [response, entry] = await Promise.all([route.fetch(), page.request.get('/src/index.tsx')]);
    const imports = await entry.text();
    const dep = (name: string) => {
      const path = [...imports.matchAll(/from "([^"]+)"/g)]
        .map(match => match[1])
        .find(url => url.includes(`/${name}.js?`) || url.endsWith(`/${name}.js`));
      if (!path) throw new Error(`Vite did not resolve ${name} in the app entry`);
      return JSON.stringify(path);
    };
    const html = (await response.text()).replace(
      '<script type="module" src="/src/index.tsx"></script>',
      `<script type="module">
        import React from ${dep('react')};
        import ReactDOM from ${dep('react-dom_client')};
        import { BrowserRouter, Routes, Route } from ${dep('react-router-dom')};
        import { QueryClient, QueryClientProvider } from ${dep('@tanstack_react-query')};
        import SessionCardPage from '/src/pages/SessionCardPage.tsx';
        import '/src/styles/tailwind.css';
        import '/src/styles/card-utilities.css';

        const h = React.createElement;
        ReactDOM.createRoot(document.getElementById('root')).render(
          h(QueryClientProvider, { client: new QueryClient() },
            h(BrowserRouter, null,
              h('div', { className: 'h-dvh overflow-hidden flex' },
                h('nav', { 'aria-label': 'Manage' }, 'Manage navigation'),
                h('main', { id: 'main-content', className: 'min-h-screen overflow-auto flex-1' },
                  h('header', null, 'Manage header'),
                  h(Routes, null, h(Route, { path: '/admin/events/:slug/card', element: h(SessionCardPage) }))
                )
              )
            )
          )
        );
      </script>`,
    );
    await route.fulfill({ response, body: html });
  });

  await page.goto(`${cardPath}?invite=private#private`);
  await expect(page.getByRole('heading', { name: 'An Oolong Evening' })).toBeVisible();
}

test('prints the tea names and available details in pouring order', async ({ page }) => {
  await openCard(page);
  const card = page.getByRole('article');
  await expect(card).toContainText('Friday, November 27, 2026');
  await expect(card).toContainText('Hosted by Lin Chen');
  await expect(card.getByRole('listitem')).toHaveText([
    /Spring Rou Gui\s*2024 · Wuyi, China/,
    /Mountain Oolong\s*Taiwan/,
    'Last Pour',
  ]);
  await expect(card).not.toContainText(/123\.45|987|private/);
  await expect(card.getByText('Afterward', { exact: true })).toBeVisible();
  await expect(card.getByRole('img', { name: 'Session link QR code' })).toBeVisible();
  await expect(card.getByRole('link', { name: 'teajia.com/event/oolong-evening' })).toHaveAttribute('href', publicUrl);

  await page.evaluate(() => { window.print = () => document.body.setAttribute('data-printed', 'yes'); });
  await page.getByRole('button', { name: 'Print', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-printed', 'yes');
});

test('an empty card prints only the name, day and host', async ({ page }) => {
  await openCard(page, []);
  await page.emulateMedia({ media: 'print' });
  const card = page.getByRole('article');
  await expect(card).toHaveText(/An Oolong Evening\s*Friday, November 27, 2026\s*Hosted by Lin Chen/);
  await expect(card.getByRole('list')).toHaveCount(0);
  await expect(card.getByText('Afterward')).toHaveCount(0);
  await expect(card.getByRole('img')).toHaveCount(0);
});

test('print output is one portrait A5 page without chrome or horizontal overflow', async ({ page }) => {
  await openCard(page);
  await page.setViewportSize({ width: 484, height: 718 });
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('navigation', { name: 'Manage', includeHidden: true })).toBeHidden();
  await expect(page.getByText('Manage header')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Print', exact: true, includeHidden: true })).toBeHidden();
  const card = page.getByRole('article');
  await expect(card).toHaveCSS('color', 'rgb(0, 0, 0)');
  await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(card.getByRole('heading', { name: 'An Oolong Evening' })).toHaveCSS('color', 'rgb(0, 0, 0)');
  await expect(card.getByRole('heading', { name: 'Afterward' })).toHaveCSS('color', 'rgb(0, 0, 0)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(484);
  const bounds = await card.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(484);
  expect(bounds!.height).toBeLessThanOrEqual(718);

  await page.screenshot({ path: test.info().outputPath('session-card-print.png') });
  const pdf = (await page.pdf({ preferCSSPageSize: true })).toString('latin1');
  expect(pdf.match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  const mediaBox = pdf.match(/\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/);
  expect(Math.abs(Number(mediaBox?.[1]) - 148 * 72 / 25.4)).toBeLessThan(2);
  expect(Math.abs(Number(mediaBox?.[2]) - 210 * 72 / 25.4)).toBeLessThan(2);
});
