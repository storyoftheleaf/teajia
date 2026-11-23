import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The phone's bottom bar is z-nav (75). A label scanner drawn at z-modal (40)
// sat under it, so a tap on the shutter opened Today instead (2026-11-23).
describe('the label scanner covers the bottom bar', () => {
  for (const file of ['src/components/TeaCompass/PhotoCapture.tsx', 'src/components/CurateV2/PhotoCapture.tsx']) {
    it(file, () => {
      const src = readFileSync(join(process.cwd(), file), 'utf8');
      const modal = src.slice(src.indexOf('const scannerModal'), src.indexOf('const scannerModal') + 600);
      expect(modal).toMatch(/fixed inset-0 z-takeover/);
    });
  }
});
