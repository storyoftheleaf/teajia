import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '../..');
const exportScript = resolve(projectRoot, 'scripts/export-wisdom-dataset.mjs');
const trackedOutDir = resolve(projectRoot, 'public/wisdom');
const temporaryRoots: string[] = [];

function outputRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'teajia-wisdom-export-test-'));
  temporaryRoots.push(root);
  return root;
}

function runExport(outDir: string) {
  return spawnSync(process.execPath, [exportScript, '2026-08-09'], {
    cwd: projectRoot,
    env: { ...process.env, WISDOM_EXPORT_ROOT: outDir },
    encoding: 'utf8',
  });
}

function directoryDigest(root: string): string {
  const hash = createHash('sha256');
  const visit = (directory: string) => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) visit(path);
      else {
        hash.update(relative(root, path));
        hash.update(readFileSync(path));
      }
    }
  };
  visit(root);
  return hash.digest('hex');
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('public wisdom provenance export', () => {
  it('publishes bibliographic metadata, field citations, and potential profiles in an isolated output root', () => {
    const outDir = outputRoot();
    const trackedBefore = directoryDigest(trackedOutDir);
    const result = runExport(outDir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(outDir);
    expect(directoryDigest(trackedOutDir)).toBe(trackedBefore);

    const dataset = JSON.parse(readFileSync(join(outDir, 'tea-wisdom.json'), 'utf8'));
    expect(dataset.researchSources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'yunnan-sourcing-yi-bang-2025', publisher: 'Yunnan Sourcing' }),
    ]));
    expect(dataset.citations).toEqual(expect.arrayContaining([
      expect.objectContaining({ entryId: 'yi-bang-village-yunnan', fields: ['description'] }),
    ]));
    expect(dataset.potentialProfiles).toEqual([]);
  });

  it('never exports internal research or verification state', () => {
    const outDir = outputRoot();
    expect(runExport(outDir).status).toBe(0);
    const bytes = readFileSync(join(outDir, 'tea-wisdom.json'), 'utf8');
    expect(bytes).not.toContain('privateEvidenceRef');
    expect(bytes).not.toContain('"trust"');
    expect(bytes).not.toContain('verifiedByUserId');
    expect(bytes).not.toContain('contentHash');
  });

  it('exports the region description in CSV with an exact stable header', () => {
    const outDir = outputRoot();
    expect(runExport(outDir).status).toBe(0);
    const csv = readFileSync(join(outDir, 'tea-wisdom-regions.csv'), 'utf8');
    expect(csv.split('\n')[0]).toBe('id,name,country,province,altitude,climate,description');
    expect(csv).toContain(
      'yi-bang-village-yunnan,"Yi Bang Village, Yunnan",China,"Northern Yiwu, Mengla County, Xishuangbanna, Yunnan",,,"A tea-producing village in northern Yiwu, within Mengla County, Xishuangbanna, Yunnan."',
    );
  });

  it('writes identical output trees for a fixed export date', () => {
    const outDir = outputRoot();
    expect(runExport(outDir).status).toBe(0);
    const first = directoryDigest(outDir);
    expect(runExport(outDir).status).toBe(0);
    expect(directoryDigest(outDir)).toBe(first);
  });
});
