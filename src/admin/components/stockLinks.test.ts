import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// InventoryView reads ?panel=<productId> and never ?search=, so a link to a
// tea that has its id in hand must use panel.
describe('links to a tea open its panel', () => {
  for (const file of ['DashboardView.tsx', 'CustomersView.tsx', 'CommandPalette.tsx']) {
    it(`${file} does not link to /admin/stock?search=`, () => {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
      expect(source).not.toContain('/admin/stock?search=');
      expect(source).toContain('/admin/stock?panel=');
    });
  }
});
