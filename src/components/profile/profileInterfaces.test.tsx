import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProfileEditor } from './ProfileEditor';
import { ProfileFavoritesEditor } from './ProfileFavoritesEditor';
import { PublicFavoritesCollection } from './PublicFavoritesCollection';
import { PaymentChooser } from './PaymentChooser';
import {
  buildPaymentPageUrl,
  canManageHostedMasterSelection,
  canStartProfileDraft,
  favoriteWriteFromTea,
  moveFavorite,
  parsePaymentContext,
  primaryTeaMasterAccount,
  profileReadiness,
  visiblePublicFavorites,
} from './profileDomain';
import type {
  PaymentMethod,
  ProfileFavorite,
  SelfProfile,
} from './types';

const profile: SelfProfile = {
  id: 'adrian',
  slug: 'adrian',
  display_name: 'Adrian Rasmussen',
  business_name: null,
  chinese_name: null,
  inspirations: null,
  closing: null,
  beginnings: 'Tea sourcing, service, and education from Bali.',
  now_text: null,
  location_line: 'Bali, Indonesia',
  languages: ['English', 'Bahasa Indonesia'],
  avatar_url: null,
  portrait_url: null,
  links: [],
  gallery_images: [],
  publication_state: 'draft',
  approval_state: 'pending',
  is_published: false,
  associations: [
    { account_id: 'teajia', account_slug: 'teajia', account_name: 'Teajia', public_role: 'Tea Master', is_host: true },
  ],
};

const favorites: ProfileFavorite[] = [
  {
    tea_profile_id: 'rou-gui',
    note: 'Roast held in reserve behind the fruit.',
    position: 0,
    is_public: true,
    tea: { id: 'rou-gui', name: 'Rou Gui', type: 'Oolong', is_public: true, image_url: null },
  },
  {
    tea_profile_id: 'private-cake',
    note: 'Not ready to share.',
    position: 1,
    is_public: false,
    tea: { id: 'private-cake', name: 'Private Cake', type: 'Pu-erh', is_public: true, image_url: null },
  },
  {
    tea_profile_id: 'hidden-tea',
    note: null,
    position: 2,
    is_public: true,
    tea: { id: 'hidden-tea', name: 'Hidden Tea', type: 'Green', is_public: false, image_url: null },
  },
];

const methods: PaymentMethod[] = [
  {
    id: 'bank-bali',
    account_id: 'teajia',
    method_type: 'bank_transfer',
    label: 'Indonesian bank transfer',
    recipient_name: 'Adrian Rasmussen',
    account_identifier: 'Account details supplied by the Tea Master',
    instructions: 'Use the reference shown above.',
    external_url: null,
    qr_image_url: null,
    position: 0,
    is_published: true,
  },
];

describe('profile interfaces', () => {
  it('shows draft, approval, and read-only store association states', () => {
    const html = renderToStaticMarkup(
      <ProfileEditor profile={profile} onSave={async () => {}} onSaveGallery={async () => {}} onUnpublish={async () => {}} />,
    );

    expect(html).toContain('Awaiting approval');
    expect(html).not.toContain('Draft · public identity');
    expect(html).toContain('Teajia');
    expect(html).toContain('Store associations are managed by an owner');
    expect(html).toContain('Changes remain private until approved.');
    expect(html).toContain('Save draft');
  });

  it('describes a published profile as live without claiming edits are a private draft', () => {
    const html = renderToStaticMarkup(
      <ProfileEditor
        profile={{ ...profile, publication_state: 'published', approval_state: 'approved', is_published: true }}
        onSave={async () => {}}
        onSaveGallery={async () => {}}
        onUnpublish={async () => {}}
      />,
    );

    expect(html).toContain('Published · public identity');
    expect(html).toContain('Save for review');
    expect(html).not.toContain('Draft · public identity');
    expect(html).not.toContain('Changes remain private until approved.');
  });

  it('names a pending draft on a published profile without relabeling the live profile', () => {
    const publishedWithDraft = {
      ...profile,
      publication_state: 'published' as const,
      approval_state: 'approved' as const,
      is_published: true,
      has_pending_draft: true,
    };
    const html = renderToStaticMarkup(
      <ProfileEditor profile={publishedWithDraft} onSave={async () => {}} onSaveGallery={async () => {}} onUnpublish={async () => {}} />,
    );

    expect(html).toContain('Published · public identity');
    expect(html).toContain('Update pending draft');
    expect(html).toContain('Your live profile is unchanged.');
  });

  it('shows the reviewer note when changes are requested', () => {
    const html = renderToStaticMarkup(
      <ProfileEditor
        profile={{ ...profile, approval_state: 'changes_requested', publication_state: 'draft', reviewer_note: 'Please add your current location.' }}
        onSave={async () => {}}
        onSaveGallery={async () => {}}
        onUnpublish={async () => {}}
      />,
    );

    expect(html).toContain('Reviewer note');
    expect(html).toContain('Please add your current location.');
  });

  it('offers only public teas that have a usable public representation', () => {
    const html = renderToStaticMarkup(
      <ProfileFavoritesEditor
        favorites={[]}
        availableTeas={[
          { id: 'public-listing', name: 'Public Listing', is_public: true, public_path: '/shop/product/public-listing' },
          { id: 'public-profile', name: 'Public Profile', is_public: true, public_path: '/tea/public-profile' },
          { id: 'hidden', name: 'Hidden Tea', is_public: false, public_path: '/tea/hidden' },
          { id: 'unrepresented', name: 'Unrepresented Tea', is_public: true, public_path: null },
        ]}
        onCreate={async () => {}}
        onUpdate={async () => {}}
        onDelete={async () => {}}
        onReorder={async () => {}}
      />,
    );

    expect(html).toContain('Public Listing');
    expect(html).toContain('Public Profile');
    expect(html).not.toContain('Hidden Tea');
    expect(html).not.toContain('Unrepresented Tea');
  });

  it('uses a name-first public favorites picker instead of exposing canonical ids', () => {
    const html = renderToStaticMarkup(
      <ProfileFavoritesEditor
        favorites={[]}
        availableTeas={[
          { id: 'tp_019cf41', name: 'Spring Rou Gui', type: 'Oolong', origin: 'Wuyi', is_public: true, public_path: '/tea/spring-rou-gui' },
        ]}
        onCreate={async () => {}}
        onUpdate={async () => {}}
        onDelete={async () => {}}
        onReorder={async () => {}}
      />,
    );

    expect(html).toContain('Public favorites');
    expect(html).toContain('Choose Spring Rou Gui');
    expect(html).toContain('Spring Rou Gui');
    expect(html).not.toContain('Canonical tea ID');
    expect(html).not.toContain('tp_019cf41');
  });

  it('reorders favorites without changing their identity', () => {
    expect(moveFavorite(favorites, 0, 2).map(item => item.tea_profile_id)).toEqual([
      'private-cake',
      'hidden-tea',
      'rou-gui',
    ]);
  });

  it('omits private and hidden teas without leaking placeholders or counts', () => {
    const visible = visiblePublicFavorites(favorites);
    const html = renderToStaticMarkup(
      <PublicFavoritesCollection contributorName="Adrian Rasmussen" favorites={visible} />,
    );

    expect(visible).toHaveLength(1);
    expect(html).toContain('Rou Gui');
    expect(html).not.toContain('/tea/rou-gui');
    expect(html).not.toContain('Private Cake');
    expect(html).not.toContain('Hidden Tea');
    expect(html).not.toContain('3 teas');
  });

  it('accepts bounded display context and rejects invalid payment claims', () => {
    expect(parsePaymentContext(new URLSearchParams('amount=180000&currency=IDR&reference=Tea%20session'))).toEqual({
      amount: '180000',
      currency: 'IDR',
      reference: 'Tea session',
      display: null,
      errors: [],
    });
    expect(parsePaymentContext(new URLSearchParams('amount=-1&currency=bitcoin&reference=' + 'x'.repeat(100))))
      .toMatchObject({ amount: null, currency: null, reference: null, errors: expect.any(Array) });
  });

  it('encodes the Teajia chooser in the QR and never claims payment success', () => {
    const destination = buildPaymentPageUrl(
      'adrian',
      'teajia',
      'https://teajia.com',
      { amount: '180000', currency: 'IDR', reference: 'Tea session', display: null, errors: [] },
    );
    const html = renderToStaticMarkup(
      <PaymentChooser
        contributorName="Adrian Rasmussen"
        methods={methods}
        destination={destination}
        context={{ amount: '180000', currency: 'IDR', reference: 'Tea session', display: null, errors: [] }}
      />,
    );

    expect(destination).toBe('https://teajia.com/people/adrian/pay?account=teajia&amount=180000&currency=IDR&reference=Tea+session');
    expect(html).toContain('Indonesian bank transfer');
    expect(html).toContain('180000');
    expect(html).toContain('Tea session');
    expect(html).toContain('Bank transfer');
    expect(html).not.toMatch(/payment (complete|successful|confirmed)/i);
  });

  it('describes the operating-hub readiness without treating a store as the person', () => {
    expect(profileReadiness(profile, { publicFavorites: 2, paymentMethods: 1 })).toEqual([
      expect.objectContaining({ id: 'profile', ready: true }),
      expect.objectContaining({ id: 'associations', ready: true, detail: '1 associated account' }),
      expect.objectContaining({ id: 'selection', ready: false }),
      expect.objectContaining({ id: 'favorites', ready: true }),
      expect.objectContaining({ id: 'payments', ready: true }),
    ]);
  });

  it('leaves the selling items out for a tea master who has no store at all', () => {
    const shopless = { ...profile, associations: [] };

    expect(profileReadiness(shopless, { publicFavorites: 2, paymentMethods: 1 }).map(item => item.id))
      .toEqual(['profile', 'favorites', 'payments']);
  });

  it('lets a shopless tea master finish every item on the list', () => {
    const shopless = { ...profile, associations: [] };

    expect(profileReadiness(shopless, { publicFavorites: 1, paymentMethods: 1 }).every(item => item.ready)).toBe(true);
    expect(profileReadiness(shopless, { publicFavorites: 0, paymentMethods: 0 }).filter(item => !item.ready).map(item => item.id))
      .toEqual(['favorites', 'payments']);
  });

  it('counts an attached store as met rather than asking for a second one', () => {
    const noSelectionYet = profileReadiness(profile, { publicFavorites: 0, paymentMethods: 0 });

    expect(noSelectionYet.find(item => item.id === 'associations')).toMatchObject({ ready: true });
    expect(noSelectionYet.find(item => item.id === 'selection')).toMatchObject({ ready: false });
  });

  it('uses only a hosted master account as the primary Tea Master selection home', () => {
    expect(primaryTeaMasterAccount([
      { account_id: 'guest', account_slug: 'guest-shop', account_name: 'Guest Shop', public_role: 'Guest', is_host: true, account_kind: 'location' },
      { account_id: 'rayi', account_slug: 'rayi', account_name: 'Rayi', public_role: 'Tea Master', is_host: true, account_kind: 'master' },
    ])?.account_id).toBe('rayi');
    expect(primaryTeaMasterAccount([
      { account_id: 'guest', account_slug: 'guest-shop', account_name: 'Guest Shop', public_role: 'Guest', is_host: true, account_kind: 'location' },
    ])).toBeNull();
  });

  it('only enables stock management inside the hosted master account', () => {
    const primary = { account_id: 'rayi', account_slug: 'rayi', account_name: 'Rayi', public_role: 'Tea Master', is_host: true, account_kind: 'master' as const };
    expect(canManageHostedMasterSelection(primary, 'rayi', true)).toBe(true);
    expect(canManageHostedMasterSelection(primary, 'teajia', true)).toBe(false);
    expect(canManageHostedMasterSelection(null, 'rayi', true)).toBe(false);
  });

  it('offers first-time creation without requiring tenant membership', () => {
    expect(canStartProfileDraft(true, null)).toBe(true);
    expect(canStartProfileDraft(true, 'rayi-master')).toBe(true);
    expect(canStartProfileDraft(false, 'rayi-master')).toBe(false);
  });

  it('preserves source listing provenance when adding a public favorite', () => {
    expect(favoriteWriteFromTea({
      id: 'rou-gui', name: 'Rou Gui', is_public: true, public_path: '/shop/product/rg-1',
      source_account_id: 'rayi', source_listing_id: 'listing-rg', source_product_id: null,
    })).toEqual({
      tea_profile_id: 'rou-gui', source_account_id: 'rayi', source_listing_id: 'listing-rg', source_product_id: undefined, note: null, is_public: false,
    });
  });

  it('omits private payment methods and explains when no public method remains', () => {
    const html = renderToStaticMarkup(
      <PaymentChooser
        contributorName="Adrian Rasmussen"
        methods={[{ ...methods[0], id: 'private-bank', label: 'Private bank', is_published: false }]}
        destination="https://teajia.com/people/adrian/pay"
        context={{ amount: null, currency: null, reference: null, display: null, errors: [] }}
      />,
    );

    expect(html).not.toContain('Private bank');
    expect(html).toContain('I have not published a way to pay here yet. Ask Adrian Rasmussen directly.');
    expect(html).not.toContain('Share this payment page');
    expect(html).not.toContain('QR code for this Teajia payment page');
  });
});
