import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AdminContributor } from '../../types';
import { canEditContributorAssociation, ContributorEditorPanel, shouldPersistContributorAssociations } from './ContributorEditorPanel';

const contributor = {
  id: 'adrian',
  slug: 'adrian',
  account_id: 'teajia',
  display_name: 'Adrian Rasmussen',
  links: [],
  is_published: 1,
  created_at: '2026-08-10T00:00:00Z',
  updated_at: '2026-08-10T00:00:00Z',
} as AdminContributor;

describe('ContributorEditorPanel publication controls', () => {
  it('previews and offers approval for a submitted Tea Master draft', () => {
    const html = renderToStaticMarkup(
      <ContributorEditorPanel
        contributor={{
          ...contributor,
          display_name: 'Submitted Name',
          has_pending_draft: true,
          approval_state: 'pending',
          draft_diff: {
            submitted_at: '2026-08-10T01:00:00Z',
            updated_at: '2026-08-10T01:00:00Z',
            changed_fields: ['display_name'],
            live: { display_name: 'Adrian Rasmussen' },
            pending: { display_name: 'Submitted Name' },
          },
        }}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );

    expect(html).toContain('Submitted changes awaiting review');
    expect(html).toContain('Approving publishes this exact draft');
    expect(html).toContain('Approve submitted changes');
    expect(html).toContain('Request changes');
    expect(html).toContain('Live profile');
    expect(html).toContain('Submitted draft');
    expect(html).toContain('value="Adrian Rasmussen"');
    expect(html).not.toContain('Publish contributor');
    expect(html).not.toContain('Save changes');
  });

  it('does not overwrite canonical associations until the editor changes them', () => {
    expect(shouldPersistContributorAssociations(false)).toBe(false);
    expect(shouldPersistContributorAssociations(true)).toBe(true);
  });

  it('limits non-platform association edits to the active account', () => {
    expect(canEditContributorAssociation('teajia', 'teajia', null)).toBe(true);
    expect(canEditContributorAssociation('barry-master', 'teajia', null)).toBe(false);
    expect(canEditContributorAssociation('barry-master', 'teajia', 'platform_owner')).toBe(true);
  });

  it('does not show draft approval controls without a pending submission', () => {
    const html = renderToStaticMarkup(
      <ContributorEditorPanel contributor={contributor} onClose={() => {}} onSaved={() => {}} />,
    );

    expect(html).not.toContain('Submitted changes awaiting review');
    expect(html).not.toContain('Approve submitted changes');
  });

  it('manages account associations without the legacy single host checkbox', () => {
    const html = renderToStaticMarkup(
      <ContributorEditorPanel
        contributor={{
          ...contributor,
          accounts: [{ slug: 'teajia', name: 'Teajia', public_role: 'Tea Master', is_host: 1, display_order: 0 }],
        }}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );

    expect(html).toContain('Store and account associations');
    expect(html).toContain('Public role');
    expect(html).toContain('Host profile');
    expect(html).not.toContain('Public host for');
  });
});
