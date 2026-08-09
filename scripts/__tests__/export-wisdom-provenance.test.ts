import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '../..');
const exportScript = resolve(projectRoot, 'scripts/export-wisdom-dataset.mjs');
const datasetPath = resolve(projectRoot, 'public/wisdom/tea-wisdom.json');

function runExport() {
  return spawnSync(process.execPath, [exportScript, '2026-08-09'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
}

const digest = () => createHash('sha256').update(readFileSync(datasetPath)).digest('hex');

describe('public wisdom provenance export', () => {
  it('publishes bibliographic metadata, field citations, and potential profiles', () => {
    const result = runExport();
    expect(result.status).toBe(0);
    const dataset = JSON.parse(readFileSync(datasetPath, 'utf8'));
    expect(dataset.researchSources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'yunnan-sourcing-yi-bang-2025', publisher: 'Yunnan Sourcing' }),
    ]));
    expect(dataset.citations).toEqual(expect.arrayContaining([
      expect.objectContaining({ entryId: 'yi-bang-village-yunnan', fields: ['description'] }),
    ]));
    expect(dataset.potentialProfiles).toEqual([]);
  });

  it('never exports internal research or verification state', () => {
    const result = runExport();
    expect(result.status).toBe(0);
    const bytes = readFileSync(datasetPath, 'utf8');
    expect(bytes).not.toContain('privateEvidenceRef');
    expect(bytes).not.toContain('"trust"');
    expect(bytes).not.toContain('verifiedByUserId');
    expect(bytes).not.toContain('contentHash');
  });

  it('writes identical bytes for a fixed export date', () => {
    expect(runExport().status).toBe(0);
    const first = digest();
    expect(runExport().status).toBe(0);
    expect(digest()).toBe(first);
  });
});
