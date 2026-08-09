import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const projectRoot = resolve(import.meta.dirname, '../..');
const buildScript = join(projectRoot, 'scripts/build-wisdom.mjs');
const temporaryRoots: string[] = [];

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'teajia-wisdom-build-'));
  temporaryRoots.push(root);
  cpSync(join(projectRoot, 'data/tea-wisdom-source'), join(root, 'data/tea-wisdom-source'), { recursive: true });
  return root;
}

function runBuild(root: string) {
  return spawnSync(process.execPath, [buildScript], {
    cwd: projectRoot,
    env: { ...process.env, WISDOM_ROOT: root },
    encoding: 'utf8',
  });
}

function rewriteJson(root: string, name: string, update: (value: any) => void) {
  const path = join(root, 'data/tea-wisdom-source', name);
  const value = JSON.parse(readFileSync(path, 'utf8'));
  update(value);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function researchModuleHash(root: string): string {
  const hash = createHash('sha256');
  for (const name of ['citations.ts', 'potentialProfiles.ts', 'researchSources.ts']) {
    hash.update(readFileSync(join(root, 'src/wisdom/generated', name)));
  }
  return hash.digest('hex');
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('wisdom research build', () => {
  it('fails for unknown source, entry, and field references', () => {
    const cases = [
      ['source', (citation: any) => { citation.sourceIds = ['missing-source']; }, 'unknown source missing-source'],
      ['entry', (citation: any) => { citation.entryId = 'missing-region'; }, 'unknown region entry missing-region'],
      ['field', (citation: any) => { citation.fields = ['vendor']; }, 'unknown field vendor'],
    ] as const;

    for (const [, mutate, expected] of cases) {
      const root = fixtureRoot();
      rewriteJson(root, 'citations.json', citations => mutate(citations[0]));
      const result = runBuild(root);
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain(expected);
    }
  });

  it('fails for cross-category tasting ids and citation scope', () => {
    const crossCategoryRoot = fixtureRoot();
    rewriteJson(crossCategoryRoot, 'potential-profiles.json', profiles => profiles.push({
      entryKind: 'region',
      entryId: 'yi-bang-village-yunnan',
      tasting: { body: ['honey'] },
      citationIds: ['yi-bang-place-source'],
    }));
    const crossCategory = runBuild(crossCategoryRoot);
    expect(crossCategory.status).not.toBe(0);
    expect(`${crossCategory.stdout}${crossCategory.stderr}`).toContain('invalid body id honey');

    const scopeRoot = fixtureRoot();
    rewriteJson(scopeRoot, 'citations.json', citations => citations.push({
      ...citations[0],
      id: 'other-region-source',
      entryId: 'anji-county-zhejiang',
    }));
    rewriteJson(scopeRoot, 'potential-profiles.json', profiles => profiles.push({
      entryKind: 'region',
      entryId: 'yi-bang-village-yunnan',
      tasting: { body: ['full'] },
      citationIds: ['other-region-source'],
    }));
    const scope = runBuild(scopeRoot);
    expect(scope.status).not.toBe(0);
    expect(`${scope.stdout}${scope.stderr}`).toContain('targets region:anji-county-zhejiang');
  });

  it('generates public-safe deterministic browser modules', () => {
    const root = fixtureRoot();
    const first = runBuild(root);
    expect(first.status).toBe(0);
    const firstHash = researchModuleHash(root);
    const second = runBuild(root);
    expect(second.status).toBe(0);
    expect(researchModuleHash(root)).toBe(firstHash);

    const bytes = ['citations.ts', 'potentialProfiles.ts', 'researchSources.ts']
      .map(name => readFileSync(join(root, 'src/wisdom/generated', name), 'utf8'))
      .join('\n');
    expect(bytes).not.toContain('privateEvidenceRef');
    expect(bytes).not.toContain('trust');
  });

  it('allowlists every field written to public browser modules', () => {
    const root = fixtureRoot();
    rewriteJson(root, 'research-sources.json', sources => {
      sources[0].adversarialSourceKey = 'source-secret';
    });
    rewriteJson(root, 'citations.json', citations => {
      citations[0].adversarialCitationKey = 'citation-secret';
    });
    rewriteJson(root, 'potential-profiles.json', profiles => profiles.push({
      entryKind: 'region',
      entryId: 'yi-bang-village-yunnan',
      tasting: { body: ['full'] },
      citationIds: ['yi-bang-place-source'],
      adversarialProfileKey: 'profile-secret',
    }));

    const result = runBuild(root);
    expect(result.status).toBe(0);
    const bytes = ['citations.ts', 'potentialProfiles.ts', 'researchSources.ts']
      .map(name => readFileSync(join(root, 'src/wisdom/generated', name), 'utf8'))
      .join('\n');
    expect(bytes).not.toContain('adversarialSourceKey');
    expect(bytes).not.toContain('adversarialCitationKey');
    expect(bytes).not.toContain('adversarialProfileKey');
    expect(bytes).not.toContain('source-secret');
    expect(bytes).not.toContain('citation-secret');
    expect(bytes).not.toContain('profile-secret');
  });
});
