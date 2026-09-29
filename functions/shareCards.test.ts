/**
 * Every published Read piece has a link-preview card, and it was drawn from
 * what the piece says now. When this fails, run `npm run share:cards` and
 * commit what it draws.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readShareCardPath, shareCardInputs } from './shareCardInputs';
import { resolveStaticReadMeta } from './_middleware';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const drawnFrom = JSON.parse(fs.readFileSync(path.join(root, 'functions/share-cards.generated.json'), 'utf8'));
const inputs = shareCardInputs();

describe('Read link-preview cards', () => {
  it('covers the pieces published today', () => {
    expect(Object.keys(inputs)).toContain('/read/porcelain-and-tea');
  });

  for (const [route, input] of Object.entries(inputs)) {
    it(`${route} has its own card, drawn from what it says now`, () => {
      const file = path.join(root, 'public', readShareCardPath(route));
      expect(fs.existsSync(file), `${route} has no card: run npm run share:cards`).toBe(true);
      expect(drawnFrom[route], `${route}'s card is out of date: run npm run share:cards`).toEqual(input);
      expect(resolveStaticReadMeta(route)?.image).toBe(`https://www.teajia.com${readShareCardPath(route)}`);
    });
  }
});
