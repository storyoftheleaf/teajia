import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle, Circle } from '@phosphor-icons/react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';

/**
 * BriefingPage — a clear, one-page map of everything Teajia can do, for the
 * owner. Sectioned by where things live on the site (Read, Craft, Advise,
 * Shop, the admin sections, the Assistant), all visible on a single scroll —
 * no drilling, no tabs. Each item shows in plain language what it does, an
 * Open link to go straight there, and one checkbox to mark it as checked.
 *
 * Deliberately simple: this is a reference + checklist, not a project tracker.
 * The single "checked" mark persists to D1 (feature_status.tested) via
 * /api/admin/feature-status. Admin-only at the route; owner-only at the tile.
 */

const API = 'https://teajia-api.lightcodes.workers.dev';

type Item = {
  id: string;
  name: string;
  to?: string;     // internal route — React-Router navigation
  href?: string;   // external — new tab
  /** Plain "what it does", shown inline. */
  desc: string;
};
type Section = { id: string; title: string; blurb: string; endpoint?: string; tokenTo?: string; items: Item[] };

const SECTIONS: Section[] = [
  {
    id: 'read', title: 'Read', blurb: 'The magazine and journal — your published writing.',
    items: [
      { id: 'pub:magazine', name: 'Magazine', to: '/magazine', desc: 'Your articles in a vertical reader built to screenshot straight to Instagram. Open it to read any piece the way a visitor does.' },
    ],
  },
  {
    id: 'craft', title: 'Craft', blurb: 'The learning hub.',
    items: [
      { id: 'pub:craft', name: 'Learn hub', to: '/craft', desc: 'Modules grouped into tea tracks a visitor works through. Open to see the curriculum as a learner sees it.' },
    ],
  },
  {
    id: 'advise', title: 'Advise', blurb: 'Guiding a visitor to the right tea or next step.',
    items: [
      { id: 'pub:consult', name: 'Consult flow', to: '/consult', desc: 'A question-led path that points a visitor toward what suits them, instead of a wall of products.' },
      { id: 'pub:b2b', name: 'For Your Space', to: '/for-your-space', desc: 'The B2B inquiry page for hotels, studios, and retreat centers wanting tea service.' },
      { id: 'pub:spaces', name: 'Spaces', to: '/spaces', desc: 'Your three Bali locations, each with a WhatsApp inquiry button.' },
    ],
  },
  {
    id: 'shop', title: 'Shop', blurb: 'The storefront — browsing and buying.',
    items: [
      { id: 'pub:home', name: 'Home', to: '/', desc: 'The front door — hero, the grounding lines, the four ways in.' },
      { id: 'pub:shop', name: 'Catalog', to: '/shop', desc: 'The full shop. Visitors filter by type, mood, and flavor. Open and try the filters as a shopper would.' },
      { id: 'pub:start', name: 'Start Here', to: '/start', desc: 'Six entry paths for someone who lands cold and doesn\'t know where to begin.' },
    ],
  },
  {
    id: 'table', title: 'Your Table', blurb: 'A member\'s own space.',
    items: [
      { id: 'pub:table', name: 'Your Table', to: '/account', desc: 'The role-adaptive hub each person sees — reader, member, operator, or staff get different tiles.' },
      { id: 'pub:journal', name: 'Tasting journal', to: '/account/journal', desc: 'A member\'s own tasting history, synced across devices, filled before and after a session.' },
      { id: 'pub:collections', name: 'Collections', to: '/account/collections', desc: 'Curated tea sets shared with a member; they can request a basket from one.' },
    ],
  },
  {
    id: 'curate', title: 'Curate', blurb: 'Building collections and writing.',
    items: [
      { id: 'admin:collections', name: 'Collections builder', to: '/admin/collections', desc: 'Assemble curated, publishable sets that become editorial bands on the storefront.' },
      { id: 'admin:magazine', name: 'Magazine editor', to: '/admin/magazine', desc: 'The block editor for articles, with Smart Paste to drop in formatted text.' },
      { id: 'admin:catalog', name: 'Catalog', to: '/admin/catalog', desc: 'Product setup — conditional fields per tea, vendor picker, the cost engine, pricing automation.' },
      { id: 'admin:teaware', name: 'Teaware', to: '/admin/teaware', desc: 'The teaware side of the catalog, managed the same way as teas.' },
    ],
  },
  {
    id: 'stock', title: 'Stock', blurb: 'Inventory — what you have, what\'s low, what came in.',
    items: [
      { id: 'admin:stock', name: 'Inventory', to: '/admin/stock', desc: 'The core stock screen: edit in place, bulk-act, fuzzy-search, year-strip, batches, QR codes.' },
      { id: 'io:csv-import', name: 'CSV import', to: '/admin/stock', desc: 'Drop a whole spreadsheet of teas at once and review before it commits. Inside Stock → import.' },
      { id: 'admin:sources', name: 'Sources / Vendors', to: '/admin/sources', desc: 'Where each tea comes from — vendor lineage and cost analysis.' },
      { id: 'io:po-pdf', name: 'Purchase orders', to: '/admin/purchase-orders', desc: 'Inbound purchase orders you can export as a PDF.' },
    ],
  },
  {
    id: 'sales', title: 'Sales', blurb: 'Orders, invoices, money.',
    items: [
      { id: 'admin:dashboard', name: 'Dashboard', to: '/admin/dashboard', desc: 'The money view in real time — cost, retail, margin, currency exposure, stock by region.' },
      { id: 'admin:orders', name: 'Orders', to: '/admin/orders', desc: 'The order pipeline: Pending to Filled to Void, with fulfillment preview and a timeline per order.' },
      { id: 'admin:records', name: 'Records & activity', to: '/admin/records', desc: 'The archive, activity logs, stock ledger, and CSV export — the audit trail.' },
      { id: 'admin:currency', name: 'Currency', to: '/admin/currency', desc: 'Exchange-rate admin that feeds every account\'s pricing.' },
    ],
  },
  {
    id: 'events', title: 'Events', blurb: 'Tea gatherings — public pages and running a session.',
    items: [
      { id: 'pub:events', name: 'Public events', to: '/events', desc: 'How a gathering looks to a visitor — the page, RSVP, capacity, the recap.' },
      { id: 'admin:events', name: 'Events manager', to: '/admin/events', desc: 'Full control: capacity and waitlist, attendee list, tea-menu editor, recap.' },
      { id: 'admin:tasting-events', name: 'Tasting events', to: '/admin/tasting-events', desc: 'Live guided tastings with a structured taxonomy you drive in the room.' },
    ],
  },
  {
    id: 'people', title: 'People', blurb: 'Customers, contacts, and access.',
    items: [
      { id: 'admin:people', name: 'People / CRM', to: '/admin/people', desc: 'Your customers — tags, purchase history, lifetime spend, vendor cost analysis.' },
      { id: 'admin:contact-tags', name: 'Contact tags', to: '/admin/contact-tags', desc: 'Freeform admin-only tags on contacts, used to target who a collection is shared with.' },
      { id: 'admin:access', name: 'Members & access', to: '/admin/access', desc: 'Who\'s on the team and what they can touch — tiers from Guest to Owner, plus capability bundles.' },
      { id: 'admin:network', name: 'Network', to: '/admin/network', desc: 'The multi-store side — listings, wholesale orders, adoptions, cross-pollination.' },
    ],
  },
  {
    id: 'capture', title: 'Capture', blurb: 'Getting tea data in fast.',
    items: [
      { id: 'admin:capture', name: 'Quick Capture', to: '/admin/capture', desc: 'Snap or upload a photo and let AI pull the tea details out, in a pipeline you bulk-approve.' },
    ],
  },
  {
    id: 'assistant', title: 'The Assistant', blurb: 'Voice/AI control of the shop.',
    endpoint: API + '/mcp', tokenTo: '/admin/mcp-tokens',
    items: [
      { id: 'admin:mcp-tokens', name: 'Assistant tokens', to: '/admin/mcp-tokens', desc: 'Mint and revoke the tokens that let a voice or AI assistant act on your shop. Shown once on creation.' },
      { id: 'mcp:read', name: 'What it can look up', desc: 'Connected, your assistant can search teas, read a customer\'s history, pull an invoice, and summarize sales — without changing anything.' },
      { id: 'mcp:write', name: 'What it can change', desc: 'With the right token it can take stock in or out, record a sale, and create or fulfill invoices — each change previews first, then confirms.' },
      { id: 'mcpp:public', name: 'Public shop assistant', href: API + '/mcp/public', desc: 'A no-login, read-only assistant any shopper\'s AI can connect to — it browses the catalog and builds a WhatsApp order link, never placing the order.' },
    ],
  },
  {
    id: 'reference', title: 'Reference', blurb: 'Docs and discoverability.',
    items: [
      { id: 'data:library', name: 'Development Library', to: '/account/docs', desc: 'Every design and build doc, rendered in-app. The written record of what\'s been built.' },
      { id: 'data:llms', name: 'llms.txt', href: '/llms.txt', desc: 'A machine-readable guide that makes the shop legible to outside AI assistants.' },
    ],
  },
];

export default function BriefingPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isAdmin) return;
    api.featureStatus.list()
      .then((map) => {
        const next: Record<string, boolean> = {};
        for (const [id, s] of Object.entries(map)) next[id] = (s as { tested?: boolean }).tested === true;
        setChecked(next);
      })
      .catch(() => { /* first run — nothing checked yet */ });
  }, [isAdmin]);

  const toggle = useCallback((id: string) => {
    setChecked((prev) => {
      const value = !prev[id];
      api.featureStatus.save(id, { tested: value }).catch(() => { /* optimistic */ });
      return { ...prev, [id]: value };
    });
  }, []);

  if (!isAdmin) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center pb-nav">
        <div className="font-display text-[22px] text-tea-text mb-2">Not available</div>
        <p className="font-serif text-ui-15 text-tea-text-sec max-w-[320px]">This map is visible to the platform owner only.</p>
        <button onClick={() => navigate('/account')} className="mt-6 text-ui-13 text-tea-text-sec hover:text-tea-text underline underline-offset-2">Back to Your Table</button>
      </div>
    );
  }

  const total = SECTIONS.reduce((n, s) => n + s.items.length, 0);
  const done = Object.values(checked).filter(Boolean).length;

  return (
    <div className="min-h-dvh bg-tea-bg pb-nav-gap-lg">
      <div className="max-w-[760px] mx-auto px-6 lg:px-8 pt-8">
        <button onClick={() => navigate('/account')} className="flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text mb-6 tap-target">
          <ArrowLeft className="w-4 h-4" weight="bold" />
          <span className="text-ui-13">Your Table</span>
        </button>

        <div className="font-sans text-ui-12 uppercase tracking-[0.14em] text-tea-text-dim">The Map</div>
        <h1 className="font-display text-ui-26 text-tea-text tracking-[0.01em] mt-2">Everything Teajia can do</h1>
        <p className="font-serif text-ui-15 text-tea-text-sec mt-3 leading-[1.65]">
          Every part of the site, what it does, and a link to go straight there. Check things off as you look them over.
        </p>
        <p className="font-sans text-ui-12 text-tea-text-dim mt-2 mb-10">{done} of {total} checked</p>

        {SECTIONS.map((s) => (
          <section key={s.id} className="mb-10">
            <div className="flex items-baseline gap-2.5 mb-0.5">
              <h2 className="font-display text-ui-20 text-tea-text tracking-[0.01em]">{s.title}</h2>
              <span className="font-serif text-ui-13 text-tea-text-dim italic">{s.blurb}</span>
            </div>

            {s.endpoint && (
              <div className="mt-2 mb-3 flex flex-wrap items-center gap-2">
                <code className="font-mono text-ui-12 text-tea-gold-lt bg-tea-elevated rounded-xl px-2.5 py-1">{s.endpoint}</code>
                {s.tokenTo && (
                  <button onClick={() => navigate(s.tokenTo!)} className="font-sans text-ui-12 text-tea-gold-lt underline underline-offset-2 hover:text-tea-gold tap-target">
                    mint a token
                  </button>
                )}
              </div>
            )}

            <div className="mt-2 divide-y divide-tea-border border-y border-tea-border">
              {s.items.map((it) => {
                const isOn = !!checked[it.id];
                return (
                  <div key={it.id} className="flex items-start gap-3 py-3">
                    {/* Checkbox */}
                    <button onClick={() => toggle(it.id)} className="shrink-0 mt-0.5 tap-target" aria-label={isOn ? 'Checked' : 'Not checked'}>
                      {isOn
                        ? <CheckCircle className="w-5 h-5 text-tea-gold-lt" weight="fill" />
                        : <Circle className="w-5 h-5 text-tea-text-dim" weight="regular" />}
                    </button>

                    {/* Name + what it does */}
                    <div className="flex-1 min-w-0">
                      <div className={`font-sans text-ui-14 font-semibold ${isOn ? 'text-tea-text-sec' : 'text-tea-text'}`}>{it.name}</div>
                      <p className="font-serif text-ui-14 text-tea-text-sec leading-[1.5] mt-0.5">{it.desc}</p>
                    </div>

                    {/* Open */}
                    {it.to && (
                      <button onClick={() => navigate(it.to!)} className="shrink-0 inline-flex items-center gap-1 font-sans text-ui-13 font-medium text-tea-gold-lt hover:text-tea-gold tap-target">
                        Open <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                      </button>
                    )}
                    {it.href && (
                      <a href={it.href} target="_blank" rel="noreferrer" className="shrink-0 inline-flex items-center gap-1 font-sans text-ui-13 font-medium text-tea-gold-lt hover:text-tea-gold tap-target">
                        Open <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
