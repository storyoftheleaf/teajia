import { describe, expect, it } from 'vitest';
import { canonicalizeWisdomVerification, fingerprintWisdomEntry } from './verificationFingerprint';

const publicEntry = {
  entry: { id: 'rou-gui', name: 'Rou Gui', details: { region: 'Wuyi', year: 1985 } },
  citations: [{ id: 'citation-1', fields: ['details.region'], sourceIds: ['source-1'] }],
  potentialProfile: { tasting: { flavor: ['mineral', 'roasted'] } },
};

describe('Wisdom verification fingerprint', () => {
  it('is byte deterministic across recursive object-key order', async () => {
    const reordered = {
      potentialProfile: { tasting: { flavor: ['mineral', 'roasted'] } },
      citations: [{ sourceIds: ['source-1'], fields: ['details.region'], id: 'citation-1' }],
      entry: { name: 'Rou Gui', details: { year: 1985, region: 'Wuyi' }, id: 'rou-gui' },
    };

    expect(canonicalizeWisdomVerification(publicEntry)).toBe(canonicalizeWisdomVerification(reordered));
    expect(await fingerprintWisdomEntry(publicEntry)).toBe(await fingerprintWisdomEntry(reordered));
    expect(await fingerprintWisdomEntry(publicEntry)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('retains semantic array order', async () => {
    const reorderedTerms = structuredClone(publicEntry);
    reorderedTerms.potentialProfile.tasting.flavor.reverse();
    expect(await fingerprintWisdomEntry(publicEntry)).not.toBe(await fingerprintWisdomEntry(reorderedTerms));
  });

  it('becomes stale after entry, citation, or profile changes', async () => {
    const base = await fingerprintWisdomEntry(publicEntry);
    const changedEntry = structuredClone(publicEntry);
    changedEntry.entry.name = 'Rougui';
    const changedCitation = structuredClone(publicEntry);
    changedCitation.citations[0].fields.push('details.year');
    const changedProfile = structuredClone(publicEntry);
    changedProfile.potentialProfile.tasting.flavor.push('orchid');

    expect(await fingerprintWisdomEntry(changedEntry)).not.toBe(base);
    expect(await fingerprintWisdomEntry(changedCitation)).not.toBe(base);
    expect(await fingerprintWisdomEntry(changedProfile)).not.toBe(base);
  });

  it.each([
    ['privateEvidenceRef', { entry: { id: 'rou-gui' }, citations: [{ privateEvidenceRef: 'vault:secret' }] }],
    ['private_evidence_ref', { entry: { id: 'rou-gui' }, citations: [{ private_evidence_ref: 'vault:secret' }] }],
    ['trust', { entry: { id: 'rou-gui' }, citations: [{ source: { trust: 'primary' } }] }],
    ['sourceTrust', { entry: { id: 'rou-gui' }, citations: [{ sourceTrust: 'strong' }] }],
    ['verificationState', { entry: { id: 'rou-gui', nested: { verificationState: 'verified' } }, citations: [] }],
    ['verification_receipt', { entry: { id: 'rou-gui' }, citations: [], verification_receipt: { content_hash: 'x' } }],
  ])('rejects the private %s key at any depth', async (_name, input) => {
    expect(() => canonicalizeWisdomVerification(input)).toThrow(/private verification input/i);
    await expect(fingerprintWisdomEntry(input)).rejects.toThrow(/private verification input/i);
  });
});
