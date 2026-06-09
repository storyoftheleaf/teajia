import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle, Circle } from '@phosphor-icons/react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';

/**
 * BriefingPage — Adrian's working feature guide. Admin-only internal workbench
 * for ironing out everything being built into Teajia.
 *
 * Shape (rebuilt to cut visual load): you land on the site's real navigation
 * sections (Read, Craft, Advise, Shop, then the admin sections Curate, Stock,
 * Sales, Events, People, Capture, plus The Assistant). Each section is one calm
 * card. Tap one to enter it and see its features — each written as a plain
 * "what it does / how you use it", with the status controls and a one-click
 * Open to go test it live. You never face more than one section at a time.
 *
 * Per feature, four independent marks persist to D1 (feature_status):
 *   stage   — idea | building | needs_testing | solid
 *   works   — unknown | works | needs_revision | broken
 *   tested  — yes/no
 *   visual  — unknown | good | needs_redesign
 * plus freeform notes. Gated on isAdmin (route) and isOwner (Your Table tile).
 */

const API = 'https://teajia-api.lightcodes.workers.dev';

type Item = {
  id: string;
  name: string;
  to?: string;
  href?: string;
  /** What it does + how you use it, in plain language. */
  desc: string;
  kind?: 'read' | 'write' | 'owner' | 'public';
};
type SectionDef = {
  id: string;
  title: string;
  /** One plain line: what this whole section is for. */
  blurb: string;
  endpoint?: string;
  tokenTo?: string;
  items: Item[];
};

type Status = { stage: string; works: string; tested: boolean; visual: string; notes: string };
const DEFAULT_STATUS: Status = { stage: 'needs_testing', works: 'unknown', tested: false, visual: 'unknown', notes: '' };

const STAGES = [
  { v: 'idea', label: 'Idea' }, { v: 'building', label: 'Building' },
  { v: 'needs_testing', label: 'Needs testing' }, { v: 'solid', label: 'Solid' },
];
const WORKS = [
  { v: 'unknown', label: 'Unknown' }, { v: 'works', label: 'Works' },
  { v: 'needs_revision', label: 'Needs revision' }, { v: 'broken', label: 'Broken' },
];
const VISUAL = [
  { v: 'unknown', label: 'Unknown' }, { v: 'good', label: 'Looks good' }, { v: 'needs_redesign', label: 'Needs redesign' },
];

// Sections mirror the site's real navigation. Descriptions are written as
// "what it does / how you use it" — first-pass drafts Adrian corrects in place.
const SECTIONS: SectionDef[] = [
  {
    id: 'read', title: 'Read', blurb: 'The magazine and journal — your published writing.',
    items: [
      { id: 'pub:magazine', name: 'Magazine', to: '/magazine', desc: 'Your published articles, shown in a vertical 4:5 reader built to screenshot straight to Instagram. Open it to read any piece the way a visitor does.' },
      { id: 'pub:article', name: 'An article page', to: '/magazine', desc: 'A single story in the immersive reader — paginated so nothing scrolls off the fixed frame. Open the magazine and tap any piece.' },
    ],
  },
  {
    id: 'craft', title: 'Craft', blurb: 'The learning hub — teaching people about tea.',
    items: [
      { id: 'pub:craft', name: 'Learn hub', to: '/craft', desc: 'The teaching section — modules grouped into tea tracks a visitor can work through. Open it to see the curriculum as a learner sees it.' },
    ],
  },
  {
    id: 'advise', title: 'Advise', blurb: 'Guiding a visitor to the right tea or next step.',
    items: [
      { id: 'pub:consult', name: 'Consult flow', to: '/consult', desc: 'A question-led path that points a visitor toward what suits them, with path cards instead of a wall of products. Open it and walk the questions.' },
      { id: 'pub:b2b', name: 'For Your Space', to: '/for-your-space', desc: 'The B2B inquiry page for hotels, studios, and retreat centers wanting tea service. Open to see the pitch and the inquiry form.' },
      { id: 'pub:spaces', name: 'Spaces', to: '/spaces', desc: 'Your three Bali locations, each with a WhatsApp inquiry button. Open to check the listings read right.' },
    ],
  },
  {
    id: 'shop', title: 'Shop', blurb: 'The storefront — browsing and buying tea.',
    items: [
      { id: 'pub:home', name: 'Home', to: '/', desc: 'The front door — hero, the grounding lines, and the four ways in. Open to see what a first visitor lands on.' },
      { id: 'pub:shop', name: 'Catalog', to: '/shop', desc: 'The full shop. Visitors filter by type, by mood, and by flavor. Open and try the filters the way a shopper would.' },
      { id: 'pub:product', name: 'A tea page', to: '/shop', desc: 'One tea in full — lore, tasting notes, terroir, brewing, and a WhatsApp inquiry instead of a cart. Open the shop and tap any tea.' },
      { id: 'pub:start', name: 'Start Here', to: '/start', desc: 'Six entry paths for someone who lands cold and does not know where to begin. Open to check each path still leads somewhere real.' },
    ],
  },
  {
    id: 'table', title: 'Your Table', blurb: 'The personal hub — a member\'s own space.',
    items: [
      { id: 'pub:table', name: 'Your Table', to: '/account', desc: 'The role-adaptive hub each person sees — reader, member, operator, or staff get different tiles. Open to see your own (owner) version.' },
      { id: 'pub:journal', name: 'Tasting journal', to: '/account/journal', desc: 'A member\'s own tasting history, synced across devices, meant to be filled before and after a session, never during. Open to see your entries.' },
      { id: 'pub:collections', name: 'Collections', to: '/account/collections', desc: 'Curated tea sets shared with a member; they can request a basket from one. Open to see what\'s been shared with you.' },
    ],
  },
  {
    id: 'curate', title: 'Curate', blurb: 'Building collections and shaping what gets shown.',
    items: [
      { id: 'admin:collections', name: 'Collections builder', to: '/admin/collections', desc: 'Where you assemble curated, publishable sets that become editorial bands on the storefront. Open to build or edit a collection.' },
      { id: 'admin:magazine', name: 'Magazine editor', to: '/admin/magazine', desc: 'The block editor for writing articles, with Smart Paste to drop in formatted text. Open to write or edit a piece.' },
      { id: 'admin:catalog', name: 'Catalog', to: '/admin/catalog', desc: 'Product management — conditional fields per tea, vendor picker, the cost engine, and pricing automation. Open to edit how a tea is set up.' },
      { id: 'admin:teaware', name: 'Teaware', to: '/admin/teaware', desc: 'The teaware side of the catalog, managed the same way as teas. Open to manage pots, cups, and tools.' },
    ],
  },
  {
    id: 'stock', title: 'Stock', blurb: 'Inventory — what you have, what\'s low, what came in.',
    items: [
      { id: 'admin:stock', name: 'Inventory', to: '/admin/stock', desc: 'The core stock screen: edit in place, bulk-act on many teas, fuzzy-search, year-strip, batches, QR codes. Open to manage what\'s on hand.' },
      { id: 'io:csv-import', name: 'CSV stock import', to: '/admin/stock', desc: 'Drop a whole spreadsheet of teas at once — name, grams, cost, currency, stock, batch — and review before it commits. Open Stock, then the import.' },
      { id: 'admin:sources', name: 'Sources / Vendors', to: '/admin/sources', desc: 'Where each tea comes from — vendor lineage and cost analysis. Open to manage who you source from.' },
      { id: 'io:po-pdf', name: 'Purchase orders', to: '/admin/purchase-orders', desc: 'Inbound purchase orders you can export as a PDF. Open to raise or review a PO.' },
      { id: 'io:qr', name: 'QR codes', to: '/admin/stock', desc: 'Per-product QR codes and brewing-guide cards you can share over WhatsApp. Open Stock and generate from a tea.' },
    ],
  },
  {
    id: 'sales', title: 'Sales', blurb: 'Orders, invoices, money, and the numbers.',
    items: [
      { id: 'admin:dashboard', name: 'Dashboard', to: '/admin/dashboard', desc: 'The money view in real time — cost, retail, margin, currency exposure, and where stock sits by region. Open for the financial read.' },
      { id: 'admin:orders', name: 'Orders', to: '/admin/orders', desc: 'The order pipeline: Pending to Filled to Void, with a fulfillment preview and an activity timeline per order. Open to work an order.' },
      { id: 'io:invoice-pdf', name: 'Invoice PDF', to: '/admin/orders', desc: 'Any invoice as a downloadable, shareable PDF. Open an order and download it.' },
      { id: 'admin:records', name: 'Records & activity', to: '/admin/records', desc: 'The archive, activity logs, stock ledger, and CSV export — the audit trail. Open to look back or export.' },
      { id: 'admin:currency', name: 'Currency', to: '/admin/currency', desc: 'Exchange-rate admin that feeds every account\'s pricing. Open to set a rate.' },
    ],
  },
  {
    id: 'events', title: 'Events', blurb: 'Tea gatherings — public pages and running a session.',
    items: [
      { id: 'pub:events', name: 'Public events', to: '/events', desc: 'How a gathering looks to a visitor — the page, RSVP, capacity, and the post-session recap. Open to see the public side.' },
      { id: 'admin:events', name: 'Events manager', to: '/admin/events', desc: 'Full event control: capacity and waitlist, the attendee list, the tea-menu editor, and the recap. Open to create or run an event.' },
      { id: 'admin:tasting-events', name: 'Tasting events', to: '/admin/tasting-events', desc: 'Live guided tastings with a structured taxonomy you drive in the room. Open to set up or run a tasting.' },
    ],
  },
  {
    id: 'people', title: 'People', blurb: 'Customers, contacts, and who can do what.',
    items: [
      { id: 'admin:people', name: 'People / CRM', to: '/admin/people', desc: 'Your customers — tags, purchase history, lifetime spend, and vendor cost analysis. Open to look someone up.' },
      { id: 'admin:contact-tags', name: 'Contact tags', to: '/admin/contact-tags', desc: 'Freeform, admin-only tags on contacts, used to target who a collection gets shared with. Open to manage tags.' },
      { id: 'admin:access', name: 'Members & access', to: '/admin/access', desc: 'Who\'s on the team and what they can touch — tiers from Guest to Owner, plus the six capability bundles. Open to grant or change access.' },
      { id: 'admin:network', name: 'Network', to: '/admin/network', desc: 'The multi-store side — listings, wholesale orders, adoptions, and cross-pollination between accounts. Open to work the network.' },
      { id: 'admin:audit', name: 'Platform audit log', to: '/admin/platform/audit-log', desc: 'Every cross-account change, owner-only — your accountability trail when acting across stores. Open to review.' },
    ],
  },
  {
    id: 'capture', title: 'Capture', blurb: 'Getting tea data in fast, including by camera.',
    items: [
      { id: 'admin:capture', name: 'Quick Capture', to: '/admin/capture', desc: 'Snap or upload a photo and let AI pull the tea details out, in a two-stage pipeline you bulk-approve. Open to capture new stock fast.' },
    ],
  },
  {
    id: 'assistant', title: 'The Assistant', blurb: 'Voice/AI control of the shop, and the public shop assistant.',
    endpoint: API + '/mcp', tokenTo: '/admin/mcp-tokens',
    items: [
      { id: 'admin:mcp-tokens', name: 'Assistant tokens', to: '/admin/mcp-tokens', desc: 'Mint and revoke the tokens that let a voice or AI assistant act on your shop. Shown once on creation. Open to manage connections.' },
      { id: 'mcp:read', name: 'What it can look up', desc: 'Connected, your assistant can search teas, read a customer\'s history, pull an invoice, and summarize sales — without changing anything. Read-only tools.', kind: 'read' },
      { id: 'mcp:write', name: 'What it can change', desc: 'With the right token it can take stock in or out, record a sale, and create or fulfill invoices — each mutating step previews first, then confirms. Operator tools.', kind: 'write' },
      { id: 'mcp:owner', name: 'Owner-only actions', desc: 'Pricing, archiving, customer edits, vendor links, and the exchange rate (which touches every account) are gated to an owner token. Owner tools.', kind: 'owner' },
      { id: 'mcpp:public', name: 'Public shop assistant', href: API + '/mcp/public', desc: 'A no-login, read-only assistant any shopper\'s AI can connect to — it browses the public catalog and builds a WhatsApp order link, never placing the order itself. Public-safe fields only.', kind: 'public' },
    ],
  },
  {
    id: 'reference', title: 'Reference', blurb: 'Docs and machine-readable discoverability.',
    items: [
      { id: 'data:library', name: 'Development Library', to: '/account/docs', desc: 'Every design and build doc, rendered in-app. The written record of what\'s been built. Open to read any of them.' },
      { id: 'data:llms', name: 'llms.txt', href: '/llms.txt', desc: 'A machine-readable guide that makes the shop legible to outside AI assistants. Open to see what they see.' },
    ],
  },
];

const ALL_ITEMS = SECTIONS.flatMap((s) => s.items);
const KIND_LABEL: Record<string, string> = { read: 'Read', write: 'Write · Operator', owner: 'Write · Owner', public: 'Public · read-only' };

// Tiny status dot for the collapsed scan.
function dotColor(works: string, tested: boolean): string {
  if (works === 'broken') return 'bg-tea-gold';            // attention (brand accent, not red — palette has no red)
  if (works === 'needs_revision') return 'bg-tea-gold/50';
  if (works === 'works' && tested) return 'bg-tea-gold-lt';
  if (works === 'works') return 'bg-tea-text-sec';
  return 'bg-tea-text-dim/40';                              // unknown
}

function Segmented({ value, options, onChange }: {
  value: string; options: { v: string; label: string }[]; onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-full bg-tea-elevated p-0.5 gap-0.5">
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button key={o.v} onClick={() => onChange(o.v)}
            className={`font-sans text-ui-11 px-2.5 py-1 rounded-full transition-colors tap-target ${
              active ? 'bg-tea-gold/18 text-tea-text' : 'text-tea-text-dim hover:text-tea-text-sec'
            }`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function BriefingPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    api.featureStatus.list()
      .then((map) => setStatuses(map as Record<string, Status>))
      .catch(() => { /* first run — defaults apply */ });
  }, [isAdmin]);

  const statusFor = useCallback((id: string): Status => statuses[id] ?? DEFAULT_STATUS, [statuses]);
  const patch = useCallback((id: string, p: Partial<Status>) => {
    setStatuses((prev) => ({ ...prev, [id]: { ...(prev[id] ?? DEFAULT_STATUS), ...p } }));
    api.featureStatus.save(id, p).catch(() => { /* optimistic */ });
  }, []);

  // Per-section "needs attention" count: anything untested, broken, needs revision, or needing redesign.
  const attentionCount = useCallback((s: SectionDef) => s.items.reduce((n, it) => {
    const st = statusFor(it.id);
    const needs = !st.tested || st.works === 'broken' || st.works === 'needs_revision' || st.visual === 'needs_redesign';
    return n + (needs ? 1 : 0);
  }, 0), [statusFor]);

  if (!isAdmin) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center pb-nav">
        <div className="font-display text-[22px] text-tea-text mb-2">Not available</div>
        <p className="font-serif text-ui-15 text-tea-text-sec max-w-[320px]">The feature guide is visible to the platform owner only.</p>
        <button onClick={() => navigate('/account')} className="mt-6 text-ui-13 text-tea-text-sec hover:text-tea-text underline underline-offset-2">Back to Your Table</button>
      </div>
    );
  }

  const section = SECTIONS.find((s) => s.id === openSection) || null;

  // ── Level 2: inside one section ───────────────────────────────────────────
  if (section) {
    const isMcp = section.id === 'assistant';
    return (
      <div className="min-h-dvh bg-tea-bg pb-nav-gap-lg">
        <div className="sticky top-0 z-10 bg-tea-bg/95 backdrop-blur-sm border-b border-tea-border">
          <div className="max-w-[720px] mx-auto px-6 lg:px-8 py-3 flex items-center gap-3">
            <button onClick={() => { setOpenSection(null); setOpenItem(null); }} className="flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text tap-target">
              <ArrowLeft className="w-4 h-4" weight="bold" />
              <span className="text-ui-13">All sections</span>
            </button>
          </div>
        </div>

        <div className="max-w-[720px] mx-auto px-6 lg:px-8 pt-8">
          <h1 className="font-display text-ui-26 text-tea-text tracking-[0.01em]">{section.title}</h1>
          <p className="font-serif text-ui-15 text-tea-text-sec mt-2 mb-6 leading-[1.6]">{section.blurb}</p>

          {section.endpoint && (
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <code className="font-mono text-ui-13 text-tea-gold-lt bg-tea-elevated rounded-xl px-3 py-1.5">{section.endpoint}</code>
              {section.tokenTo && (
                <button onClick={() => navigate(section.tokenTo!)} className="inline-flex items-center gap-1.5 font-sans text-ui-13 font-medium text-tea-gold-lt border border-tea-gold/35 rounded-full px-3 py-1.5 hover:bg-tea-gold/12 hover:border-tea-gold tap-target">
                  Mint a token <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                </button>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            {section.items.map((it) => {
              const st = statusFor(it.id);
              const expanded = openItem === it.id;
              return (
                <div key={it.id} className="bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
                  {/* Collapsed row — scannable: dot, name, open */}
                  <button
                    onClick={() => setOpenItem(expanded ? null : it.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-tea-gold/[0.03] transition-colors"
                  >
                    <span className={`shrink-0 w-2 h-2 rounded-full ${dotColor(st.works, st.tested)}`} />
                    <span className="flex-1 min-w-0">
                      <span className="font-sans text-ui-14 font-semibold text-tea-text">
                        {isMcp && it.kind ? it.name : it.name}
                      </span>
                    </span>
                    {it.kind && <span className="font-sans text-ui-10 uppercase tracking-[0.06em] text-tea-text-dim shrink-0">{KIND_LABEL[it.kind]}</span>}
                    <ArrowRight className={`w-3.5 h-3.5 text-tea-text-dim shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} weight="bold" />
                  </button>

                  {/* Expanded — description, controls, notes, open */}
                  {expanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-tea-border">
                      <p className="font-serif text-ui-15 text-tea-text-sec leading-[1.6] mt-3 mb-4">{it.desc}</p>

                      {(it.to || it.href) && (
                        <div className="mb-4">
                          {it.to && (
                            <button onClick={() => navigate(it.to!)} className="inline-flex items-center gap-1.5 font-sans text-ui-13 font-medium text-tea-gold-lt border border-tea-gold/35 rounded-full px-3.5 py-1.5 hover:bg-tea-gold/12 hover:border-tea-gold tap-target">
                              Open it <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                            </button>
                          )}
                          {it.href && (
                            <a href={it.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-sans text-ui-13 font-medium text-tea-gold-lt border border-tea-gold/35 rounded-full px-3.5 py-1.5 hover:bg-tea-gold/12 hover:border-tea-gold tap-target">
                              Open it <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                            </a>
                          )}
                        </div>
                      )}

                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-sans text-ui-11 uppercase tracking-[0.06em] text-tea-text-dim w-12">Stage</span>
                          <Segmented value={st.stage} options={STAGES} onChange={(v) => patch(it.id, { stage: v })} />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-sans text-ui-11 uppercase tracking-[0.06em] text-tea-text-dim w-12">Works</span>
                          <Segmented value={st.works} options={WORKS} onChange={(v) => patch(it.id, { works: v })} />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-sans text-ui-11 uppercase tracking-[0.06em] text-tea-text-dim w-12">Visual</span>
                          <Segmented value={st.visual} options={VISUAL} onChange={(v) => patch(it.id, { visual: v })} />
                        </div>
                        <button onClick={() => patch(it.id, { tested: !st.tested })} className="flex items-center gap-1.5 self-start tap-target">
                          {st.tested ? <CheckCircle className="w-4 h-4 text-tea-gold-lt" weight="fill" /> : <Circle className="w-4 h-4 text-tea-text-dim" weight="regular" />}
                          <span className={`font-sans text-ui-12 ${st.tested ? 'text-tea-text' : 'text-tea-text-sec'}`}>I've tested this</span>
                        </button>
                      </div>

                      <NotesField value={st.notes} onCommit={(v) => patch(it.id, { notes: v })} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Level 1: the section list (calm landing) ──────────────────────────────
  return (
    <div className="min-h-dvh bg-tea-bg pb-nav-gap-lg">
      <div className="max-w-[720px] mx-auto px-6 lg:px-8 pt-8">
        <button onClick={() => navigate('/account')} className="flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text mb-6 tap-target">
          <ArrowLeft className="w-4 h-4" weight="bold" />
          <span className="text-ui-13">Your Table</span>
        </button>

        <div className="font-sans text-ui-12 uppercase tracking-[0.14em] text-tea-text-dim">Working Feature Guide</div>
        <h1 className="font-display text-ui-26 text-tea-text tracking-[0.01em] mt-2">What you've built</h1>
        <p className="font-serif text-ui-15 text-tea-text-sec mt-3 mb-8 leading-[1.65]">
          Organized by where things live on the site. Tap a section to see what's in it, what each one does, and a
          link to go test it. Mark each as you work through it. Your marks save on their own.
        </p>

        <div className="flex flex-col gap-2.5">
          {SECTIONS.map((s) => {
            const needs = attentionCount(s);
            return (
              <button
                key={s.id}
                onClick={() => { setOpenSection(s.id); setOpenItem(null); }}
                className="text-left bg-tea-surface border border-tea-border rounded-xl px-5 py-4 hover:border-tea-gold/40 transition-colors flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-display text-ui-20 text-tea-text tracking-[0.01em]">{s.title}</div>
                  <div className="font-serif text-ui-14 text-tea-text-sec mt-0.5 leading-[1.45]">{s.blurb}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-sans text-ui-13 text-tea-text-sec">{s.items.length}</div>
                  {needs > 0 && <div className="font-sans text-ui-11 text-tea-gold-lt mt-0.5">{needs} to check</div>}
                </div>
                <ArrowRight className="w-4 h-4 text-tea-text-dim shrink-0" weight="bold" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Notes commit on blur to avoid a save per keystroke.
function NotesField({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft !== value) onCommit(draft); }}
      placeholder="Notes — what's left, bugs, ideas…"
      className="w-full mt-4 bg-tea-elevated rounded-xl px-3 py-2 font-serif text-ui-14 text-tea-text placeholder:text-tea-text-dim border border-transparent focus:border-tea-gold/30 focus:outline-none"
    />
  );
}
