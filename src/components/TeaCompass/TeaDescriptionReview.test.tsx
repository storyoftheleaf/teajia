import { describe, expect, it } from 'vitest';
import { teaDescriptionReviewConflict, teaDescriptionSourceSignature } from './TeaDescriptionReview';
const scope = { accountId: 'shop', userId: 'author', revision: 2, entryId: 'tea' };
const sources = [{ id: 'note:1', title: 'Exact voice note', text: 'A spring tea.' }];
const input = { capturedScope: scope, currentScope: scope, capturedSources: teaDescriptionSourceSignature(sources), currentSources: teaDescriptionSourceSignature(sources), baseDescription: 'Original', currentDescription: 'Original' };
describe('description review ownership and freshness', () => {
  it('permits only the same current description, source selection and identity scope', () => {
    expect(teaDescriptionReviewConflict(input)).toBeNull();
  });
  it.each(['accountId', 'userId', 'revision', 'entryId'] as const)('refuses a changed %s', key => {
    const currentScope = { ...scope, [key]: key === 'revision' ? 3 : 'other' };
    expect(teaDescriptionReviewConflict({ ...input, currentScope })).toContain('record changed');
  });
  it('refuses another edit while preserving exact absence semantics', () => {
    expect(teaDescriptionReviewConflict({ ...input, currentDescription: 'Human correction' })).toContain('description changed');
    expect(teaDescriptionReviewConflict({ ...input, baseDescription: null, currentDescription: undefined })).toBeNull();
  });
  it('refuses changed excerpts, source identity and provenance titles', () => {
    for (const source of [{ ...sources[0], text: 'Different passage.' }, { ...sources[0], id: 'other' }, { ...sources[0], title: 'Other speaker' }]) {
      expect(teaDescriptionReviewConflict({ ...input, currentSources: teaDescriptionSourceSignature([source]) })).toContain('source material changed');
    }
  });
  it('requires signed-in account and person even if two empty scopes match', () => {
    const empty = { ...scope, accountId: null, userId: null };
    expect(teaDescriptionReviewConflict({ ...input, capturedScope: empty, currentScope: empty })).toContain('record changed');
  });
});
