import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE_DESCRIPTION, SITE_PREVIEW_IMAGE_PATH, SITE_TITLE } from './siteMeta';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('the site says one thing about itself', () => {
  it('index.html carries the same title, line and picture as siteMeta.ts', () => {
    const html = read('index.html');
    expect(html).toContain(`<title>${SITE_TITLE}</title>`);
    expect(html.match(/content="([^"]+)"/g)?.filter((tag) => tag.includes(SITE_DESCRIPTION)).length).toBeGreaterThanOrEqual(3);
    expect(html).toContain(`property="og:title" content="${SITE_TITLE}"`);
    expect(html).toContain(`property="og:image" content="https://teajia.com${SITE_PREVIEW_IMAGE_PATH}"`);
    expect(html).toContain(`name="twitter:image" content="https://teajia.com${SITE_PREVIEW_IMAGE_PATH}"`);
  });

  it('the manifest and the picture agree', () => {
    const manifest = JSON.parse(read('public/manifest.json'));
    expect(manifest.name).toBe(SITE_TITLE);
    expect(manifest.description).toBe(SITE_DESCRIPTION);
    expect(fs.existsSync(path.join(root, 'public', SITE_PREVIEW_IMAGE_PATH))).toBe(true);
  });
});
