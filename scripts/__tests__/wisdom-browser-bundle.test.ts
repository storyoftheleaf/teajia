import { build } from 'esbuild';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '../..');

describe('wisdom browser barrel', () => {
  it('does not statically bundle cultivar stories, tasting taxonomy, or build validation', async () => {
    const result = await build({
      entryPoints: [resolve(projectRoot, 'src/wisdom/index.ts')],
      bundle: true,
      format: 'esm',
      platform: 'browser',
      splitting: true,
      outdir: 'out',
      write: false,
      metafile: true,
      logLevel: 'silent',
    });
    const entryOutput = Object.values(result.metafile.outputs)
      .find(output => output.entryPoint?.replaceAll('\\', '/').endsWith('src/wisdom/index.ts'));
    expect(entryOutput).toBeDefined();
    const inputs = Object.keys(entryOutput?.inputs ?? {}).map(path => path.replaceAll('\\', '/'));
    expect(inputs.some(path => path.endsWith('src/wisdom/stories/cultivars.json'))).toBe(false);
    expect(inputs.some(path => path.endsWith('src/data/teajia-tasting-taxonomy.json'))).toBe(false);
    expect(inputs.some(path => path.endsWith('src/wisdom/researchValidation.ts'))).toBe(false);
  });
});
