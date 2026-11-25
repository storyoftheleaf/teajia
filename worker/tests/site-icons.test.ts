import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MCP_SERVER_ICONS, siteIconRedirect } from '../src/siteIcons';

const PUBLIC = resolve(__dirname, '../../public');

describe('the emblem icon on the API host', () => {
  it('points favicon lookups at the site copy of the emblem', () => {
    for (const path of ['/favicon.ico', '/favicon.svg', '/favicon-32x32.png', '/apple-touch-icon.png', '/icon-512.png']) {
      const response = siteIconRedirect(new Request(`https://api.teajia.com${path}`));
      expect(response?.status).toBe(301);
      expect(response?.headers.get('Location')).toBe(`https://teajia.com${path}`);
    }
    expect(siteIconRedirect(new Request('https://api.teajia.com/apple-touch-icon-precomposed.png'))?.headers.get('Location'))
      .toBe('https://teajia.com/apple-touch-icon.png');
  });

  it('leaves every other path and method to the API', () => {
    expect(siteIconRedirect(new Request('https://api.teajia.com/mcp'))).toBeNull();
    expect(siteIconRedirect(new Request('https://api.teajia.com/api/products'))).toBeNull();
    expect(siteIconRedirect(new Request('https://api.teajia.com/favicon.ico', { method: 'POST' }))).toBeNull();
  });

  it('names only icons the site actually has', () => {
    for (const icon of MCP_SERVER_ICONS) {
      const file = new URL(icon.src).pathname;
      expect(existsSync(resolve(PUBLIC, `.${file}`)), file).toBe(true);
    }
    for (const file of ['favicon.ico', 'favicon.svg', 'favicon-16x16.png', 'apple-touch-icon.png', 'icon-maskable-512.png']) {
      expect(existsSync(resolve(PUBLIC, file)), file).toBe(true);
    }
  });
});
