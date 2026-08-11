import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { api } from '../../lib/api';
import {
  canShowReferenceIssueFlag,
  FlagReferenceIssueAction,
} from './FlagReferenceIssueSheet';

const referencePage = {
  id: 'lincang',
  slug: 'lincang',
  kind: 'major_region',
  label: 'Lincang',
  route: '/wisdom/region/lincang',
  sections: [
    {
      key: 'scope',
      label: 'Northern Pu\u2019er country',
      text: 'Lincang lies north of Pu\u2019 Prefecture and against Myanmar to the west.',
      sourceIds: ['teadb-lincang'],
    },
    {
      key: 'history',
      label: 'History beyond single origins',
      text: 'Older blended productions provide a historical thread.',
      sourceIds: ['teadb-lincang'],
    },
  ],
};

function renderFor(platformRole: string | null): string {
  const canShow = canShowReferenceIssueFlag(true, Boolean(platformRole), platformRole);
  return canShow
    ? renderToStaticMarkup(<FlagReferenceIssueAction page={referencePage} onOpen={() => {}} />)
    : '';
}

describe('Tea Reference revision flag visibility', () => {
  it('shows Flag for revision only to the authenticated platform owner', () => {
    expect(canShowReferenceIssueFlag(true, true, 'platform_owner')).toBe(true);
    expect(canShowReferenceIssueFlag(false, true, 'platform_owner')).toBe(false);
    expect(canShowReferenceIssueFlag(true, false, 'platform_owner')).toBe(false);
    expect(renderFor('platform_owner')).toContain('Flag for revision');
    expect(renderFor('platform_admin')).not.toContain('Flag for revision');
    expect(renderFor(null)).not.toContain('Flag for revision');
    expect(renderFor('unknown_role')).not.toContain('Flag for revision');
  });

  it('keeps the owner action immediately before the final public correction invitation', () => {
    const source = readFileSync(new URL('./ReferenceFactSections.tsx', import.meta.url), 'utf8');
    expect(source.indexOf('<FlagReferenceIssueSheet')).toBeGreaterThan(-1);
    expect(source.indexOf('<FlagReferenceIssueSheet')).toBeLessThan(source.indexOf('<Invitation'));
  });

  it('builds the exact four-field request and preserves the note after failure', async () => {
    const module = await import('./FlagReferenceIssueSheet');
    const createInitialState = (module as Record<string, unknown>).createInitialFlagIssueState as ((page: typeof referencePage) => unknown) | undefined;
    const reduce = (module as Record<string, unknown>).reduceFlagIssueState as ((state: any, action: any) => any) | undefined;
    const submission = (module as Record<string, unknown>).flagIssueSubmission as ((page: typeof referencePage, state: any) => unknown) | undefined;

    const initial = createInitialState?.(referencePage);
    expect(initial).toEqual(expect.objectContaining({
      category: 'incorrect_information',
      sectionKey: 'scope',
      note: '',
    }));
    const written = reduce?.(initial, { type: 'note', value: 'The place relationship is unclear.' });
    const failed = reduce?.(written, { type: 'failed', message: 'Could not flag this section. Try again.' });
    expect(failed.note).toBe('The place relationship is unclear.');
    expect(submission?.(referencePage, failed)).toEqual({
      page_id: 'lincang',
      section_key: 'scope',
      category: 'incorrect_information',
      note: 'The place relationship is unclear.',
    });
  });

  it('uses every approved category id and resolves the selected section preview', async () => {
    const module = await import('./FlagReferenceIssueSheet');
    const categories = (module as Record<string, unknown>).TEA_REFERENCE_ISSUE_CATEGORIES as Array<{ id: string }> | undefined;
    const selectedSection = (module as Record<string, unknown>).selectedFlagSection as ((page: typeof referencePage, key: string) => unknown) | undefined;

    expect(categories?.map(option => option.id)).toEqual([
      'incorrect_information',
      'translation',
      'unclear_writing',
      'wrong_source',
      'geography_or_hierarchy',
      'missing_information',
    ]);
    expect(selectedSection?.(referencePage, 'history')).toEqual(referencePage.sections[1]);
  });

  it('renders the compact labelled form with a read-only current-section preview', async () => {
    const module = await import('./FlagReferenceIssueSheet');
    const Form = (module as Record<string, unknown>).FlagReferenceIssueForm as React.FC<any> | undefined;
    expect(Form).toBeTypeOf('function');
    if (!Form) return;

    const html = renderToStaticMarkup(
      <Form
        page={referencePage}
        state={{
          category: 'geography_or_hierarchy',
          sectionKey: 'history',
          note: 'The hierarchy needs another look.',
          error: 'Could not flag this section. Try again.',
          outcome: null,
        }}
        isPending={false}
        onCategory={() => {}}
        onSection={() => {}}
        onNote={() => {}}
        onCancel={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(html).toContain('Issue category');
    expect(html).toContain('Affected section');
    expect(html).toContain('Your note');
    expect(html).toContain('Current section text');
    expect(html).toContain('History beyond single origins');
    expect(html).toContain('Older blended productions provide a historical thread.');
    expect(html).toContain('The hierarchy needs another look.');
    expect(html).toContain('Could not flag this section. Try again.');
    expect(html).toContain('required=""');
    expect(html).toContain('min-h-11');
    expect(html).not.toMatch(/replacement prose|regeneration prompt/i);
  });

  it('renders duplicate creation as a successful existing flag', async () => {
    const module = await import('./FlagReferenceIssueSheet');
    const Form = (module as Record<string, unknown>).FlagReferenceIssueForm as React.FC<any> | undefined;
    expect(Form).toBeTypeOf('function');
    if (!Form) return;

    const html = renderToStaticMarkup(
      <Form
        page={referencePage}
        state={{
          category: 'incorrect_information',
          sectionKey: 'scope',
          note: 'Already noted.',
          error: '',
          outcome: 'duplicate',
        }}
        isPending={false}
        onCategory={() => {}}
        onSection={() => {}}
        onNote={() => {}}
        onCancel={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(html).toMatch(/already open/i);
    expect(html).not.toContain('role="alert"');
  });

  it('adds the four authenticated issue operations to the shared API client', () => {
    const issueApi = (api as Record<string, unknown>).teaReferenceIssues as Record<string, unknown> | undefined;
    expect(issueApi).toEqual(expect.objectContaining({
      create: expect.any(Function),
      list: expect.any(Function),
      exportBrief: expect.any(Function),
      resolve: expect.any(Function),
    }));
  });
});
