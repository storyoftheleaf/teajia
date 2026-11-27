import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProfileEditor } from './ProfileEditor';
import { ContributorEditorPanel } from '../../admin/components/ContributorEditorPanel';
import { FAMILY_PAGE_WORDS, familyPageAllowsPay, familyPageNeedsReview } from '../../lib/familyContract';
import type { AdminContributor } from '../../types';
import type { SelfProfile } from './types';

// Teajia family, stage 3: the word on a person's page, in the editor the
// person sees and in the owner's Manage panel.

const base: SelfProfile = {
  id: 'mei-lin', slug: 'mei-lin', display_name: 'Mei Lin', business_name: null, chinese_name: null, role: null,
  portrait_focus: null, inspirations: null, closing: null, beginnings: null, now_text: null, location_line: null,
  languages: [], avatar_url: null, portrait_url: null, links: [], gallery_images: [],
  publication_state: 'published', approval_state: 'approved', is_published: true, associations: [],
};

const editor = (profile: SelfProfile) => renderToStaticMarkup(
  <ProfileEditor profile={profile} onSave={async () => {}} onSaveGallery={async () => {}} onUnpublish={async () => {}} />,
);

describe('the word on a page', () => {
  it('says which pages are reviewed and which carry Pay', () => {
    expect(familyPageNeedsReview('family')).toBe(false);
    expect(familyPageNeedsReview('creator')).toBe(true);
    expect(familyPageNeedsReview('master')).toBe(true);
    expect(familyPageNeedsReview(null)).toBe(true);
    expect(familyPageAllowsPay('family')).toBe(false);
    expect(familyPageAllowsPay('creator')).toBe(false);
    expect(familyPageAllowsPay('master')).toBe(true);
    expect(familyPageAllowsPay(null)).toBe(true);
    expect(Object.values(FAMILY_PAGE_WORDS)).toEqual(['Teajia family', 'Tea creator', 'Host']);
  });
});

describe('the editor a person sees', () => {
  it('goes live at once for a family page: the word is shown and fixed, and the save is plain', () => {
    const html = editor({ ...base, page_tier: 'family' });
    expect(html).toContain('Teajia family');
    expect(html).toContain('On Teajia as');
    expect(html).not.toContain('What you do');
    expect(html).toContain('What you save goes on it at once.');
    expect(html).not.toContain('Save for review');
    expect(html).not.toContain('Changes go to Teajia to approve first.');
  });

  it('keeps the approval step and the free role for a page with no family word', () => {
    const html = editor(base);
    expect(html).toContain('What you do');
    expect(html).toContain('Save for review');
    expect(html).toContain('Changes go to Teajia to approve first.');
    expect(html).not.toContain('On Teajia as');
  });

  it('keeps the approval step for a tea master', () => {
    const html = editor({ ...base, page_tier: 'master' });
    expect(html).toContain('value="Host"');
    expect(html).toContain('Save for review');
  });
});

const contributor = {
  id: 'mei-lin', slug: 'mei-lin', account_id: 'teajia', display_name: 'Mei Lin', links: [], is_published: 1,
  created_at: '2026-11-20T00:00:00Z', updated_at: '2026-11-20T00:00:00Z',
} as AdminContributor;

describe('the owner\'s Manage panel', () => {
  const panel = (value: AdminContributor) => renderToStaticMarkup(<ContributorEditorPanel contributor={value} onClose={() => {}} onSaved={() => {}} />);

  it('offers the three words and marks the one the person has', () => {
    const html = panel({ ...contributor, page_tier: 'creator' });
    expect(html).toContain('data-testid="section-page-word"');
    for (const word of Object.values(FAMILY_PAGE_WORDS)) expect(html).toContain(word);
    expect(html).toMatch(/name="page-word" checked="" value="creator"/);
    expect(html).not.toMatch(/name="page-word" checked="" value="family"/);
  });

  it('says a page from before the family has no word yet and keeps what it had', () => {
    const html = panel(contributor);
    expect(html).toContain('Not chosen yet.');
    expect(html).not.toMatch(/name="page-word" checked=/);
  });
});
