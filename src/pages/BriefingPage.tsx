import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle, Circle } from '@phosphor-icons/react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';

/**
 * BriefingPage — Adrian's working feature guide. An admin-only internal
 * workbench for ironing out everything being built into Teajia: every feature
 * is a row he can mark across independent dimensions (stage, does it work, has
 * he tested it, do the visuals need a redesign), jot notes on, and open in one
 * click to go test it live.
 *
 * Status persists to D1 (feature_status table) via /api/admin/feature-status,
 * so the guide is a real tracker he returns to, not a static link list.
 *
 * Gated on isAdmin at the route and on isOwner at the Your Table tile.
 */

const API = 'https://teajia-api.lightcodes.workers.dev';

type Item = {
  id: string;          // stable feature id, persisted as feature_status.feature_id
  name: string;
  to?: string;         // internal app route — React-Router navigation
  href?: string;       // external URL — new tab
  desc: string;
  how?: string;
  kind?: 'read' | 'write' | 'owner' | 'public';
};
type SectionDef = { id: string; title: string; note: string; endpoint?: string; tokenTo?: string; items: Item[] };

type Status = { stage: string; works: string; tested: boolean; visual: string; notes: string };
const DEFAULT_STATUS: Status = { stage: 'needs_testing', works: 'unknown', tested: false, visual: 'unknown', notes: '' };

const STAGES = [
  { v: 'idea', label: 'Idea' },
  { v: 'building', label: 'Building' },
  { v: 'needs_testing', label: 'Needs testing' },
  { v: 'solid', label: 'Solid' },
];
const WORKS = [
  { v: 'unknown', label: 'Unknown' },
  { v: 'works', label: 'Works' },
  { v: 'broken', label: 'Broken' },
];
const VISUAL = [
  { v: 'unknown', label: 'Unknown' },
  { v: 'good', label: 'Looks good' },
  { v: 'needs_redesign', label: 'Needs redesign' },
];

const SECTIONS: SectionDef[] = [
  {
    id: 'public', title: 'Public surfaces',
    note: 'What a visitor or customer sees.',
    items: [
      { id: 'pub:home', name: 'Home', to: '/', desc: 'The storefront entry — hero, grounding lines, the four sections.' },
      { id: 'pub:shop', name: 'Shop', to: '/shop', desc: 'The full catalog. Filter by type, mood, and flavor; open any tea.' },
      { id: 'pub:magazine', name: 'Magazine / Journal', to: '/magazine', desc: 'Editorial articles in the 4:5 immersive reader, shareable to Instagram.' },
      { id: 'pub:craft', name: 'Learn / Craft', to: '/craft', desc: 'The learning hub — modules across tea tracks.' },
      { id: 'pub:consult', name: 'Consult / Advise', to: '/consult', desc: 'Question-driven guidance flow with path cards.' },
      { id: 'pub:events', name: 'Events', to: '/events', desc: 'Tea gatherings — public event pages, RSVP, capacity, recaps.' },
      { id: 'pub:start', name: 'Start Here', to: '/start', desc: 'Six entry paths for a first-time visitor.' },
      { id: 'pub:spaces', name: 'Spaces', to: '/spaces', desc: 'The three Bali locations with WhatsApp inquiry.' },
      { id: 'pub:b2b', name: 'For Your Space', to: '/for-your-space', desc: 'B2B inquiry for hotels, studios, retreat centers.' },
      { id: 'pub:table', name: 'Your Table', to: '/account', desc: 'The personal hub — role-adaptive (Reader / Member / Operator / Staff).' },
      { id: 'pub:journal', name: 'Tasting Journal', to: '/account/journal', desc: 'Your tasting history with sync; off-phone-during-tea by design.' },
      { id: 'pub:collections', name: 'Collections', to: '/account/collections', desc: 'Curated tea sets shared with you; request a basket.' },
    ],
  },
  {
    id: 'admin', title: 'Admin tools',
    note: 'The operating system of the shop. Each opens its admin view directly.',
    items: [
      { id: 'admin:dashboard', name: 'Dashboard', to: '/admin/dashboard', desc: 'Real-time financial intelligence: cost, retail, margin, currency exposure, regional spread.' },
      { id: 'admin:stock', name: 'Stock (Inventory)', to: '/admin/stock', desc: 'The inventory system: inline editing, bulk ops, fuzzy search, QR codes, year-strip, batches.' },
      { id: 'admin:catalog', name: 'Catalog', to: '/admin/catalog', desc: 'Product management — conditional fields, vendor picker, cost engine, pricing automation.' },
      { id: 'admin:teaware', name: 'Teaware', to: '/admin/teaware', desc: 'The teaware side of the catalog.' },
      { id: 'admin:orders', name: 'Orders', to: '/admin/orders', desc: 'Order pipeline: Pending to Filled to Void, fulfillment preview, activity timeline.' },
      { id: 'admin:po', name: 'Purchase Orders', to: '/admin/purchase-orders', desc: 'Inbound purchase orders with PDF output.' },
      { id: 'admin:people', name: 'People / CRM', to: '/admin/people', desc: 'Customers: tags, purchase history, lifetime spend, vendor cost analysis.' },
      { id: 'admin:sources', name: 'Sources / Vendors', to: '/admin/sources', desc: 'Where teas come from — vendor lineage, cost analysis.' },
      { id: 'admin:contact-tags', name: 'Contact Tags', to: '/admin/contact-tags', desc: 'Freeform admin-only contact tags + tag-aware share picker.' },
      { id: 'admin:capture', name: 'Quick Capture', to: '/admin/capture', desc: 'Camera/file upload with AI data extraction — two-stage pipeline, bulk approve.' },
      { id: 'admin:events', name: 'Events Manager', to: '/admin/events', desc: 'Full CRUD: capacity, waitlist, attendees, tea-menu editor, post-session recap.' },
      { id: 'admin:tasting-events', name: 'Tasting Events', to: '/admin/tasting-events', desc: 'Live guided tasting sessions with structured taxonomy.' },
      { id: 'admin:magazine', name: 'Magazine Editor', to: '/admin/magazine', desc: 'D1 block editor with Smart Paste for building articles.' },
      { id: 'admin:collections', name: 'Collections', to: '/admin/collections', desc: 'Build curated, publishable collections — editorial bands on the storefront.' },
      { id: 'admin:network', name: 'Network', to: '/admin/network', desc: 'Multi-store: listings, wholesale orders, adoptions, cross-pollination.' },
      { id: 'admin:access', name: 'Members & Access', to: '/admin/access', desc: 'Tiers (Guest to Owner) and capability bundles (Catalog, Stock, Publish, Gather, Sell, Members).' },
      { id: 'admin:currency', name: 'Currency', to: '/admin/currency', desc: 'Exchange-rate admin used across all accounts.' },
      { id: 'admin:records', name: 'Records & Activity', to: '/admin/records', desc: 'Archive, activity logs, stock ledger, CSV export.' },
      { id: 'admin:mcp-tokens', name: 'MCP Tokens', to: '/admin/mcp-tokens', desc: 'Mint and revoke tokens for the voice/agent assistant. Shown once on creation.' },
      { id: 'admin:audit', name: 'Platform Audit Log', to: '/admin/platform/audit-log', desc: 'Every cross-account state change, owner-only.' },
      { id: 'admin:library', name: 'Development Library', to: '/account/docs', desc: 'Every design and build doc, rendered in-app. Owner-only.' },
    ],
  },
  {
    id: 'imports', title: 'Imports & exports',
    note: 'Getting data in and out in bulk.',
    items: [
      { id: 'io:csv-import', name: 'CSV stock import', to: '/admin/stock', desc: 'Import a whole spreadsheet of teas at once — name, grams, cost, currency, stock, batch. Staged with review before commit.', how: 'Admin → Stock → import.' },
      { id: 'io:csv-export', name: 'CSV export', to: '/admin/records', desc: 'Export records, activity, and stock ledger as CSV.' },
      { id: 'io:invoice-pdf', name: 'Invoice PDF', to: '/admin/orders', desc: 'Generate an invoice as a downloadable/shareable PDF.', how: 'Open an order, download PDF.' },
      { id: 'io:po-pdf', name: 'Purchase Order PDF', to: '/admin/purchase-orders', desc: 'Generate a purchase order as a PDF.' },
      { id: 'io:ledger-pdf', name: 'Tasting Ledger PDF', to: '/account/journal', desc: 'Export the Compass tasting ledger as a PDF.' },
      { id: 'io:qr', name: 'QR codes', to: '/admin/stock', desc: 'Per-product QR codes and brewing-guide QR cards with WhatsApp share.' },
    ],
  },
  {
    id: 'mcp-auth', title: 'MCP — your assistant',
    note: 'Connect a voice/agent assistant to the authenticated server. Mutating tools use a two-step preview then confirm. Mint a token, then point your assistant at the endpoint.',
    endpoint: API + '/mcp', tokenTo: '/admin/mcp-tokens',
    items: [
      { id: 'mcp:search_tea', name: 'search_tea', kind: 'read', desc: 'Fuzzy-search inventory by name, Chinese name, region, or vendor.' },
      { id: 'mcp:get_tea', name: 'get_tea', kind: 'read', desc: 'Full record for one tea, including the last 10 stock-ledger entries.' },
      { id: 'mcp:list_low_stock', name: 'list_low_stock', kind: 'read', desc: 'Teas below their per-product low-stock threshold — the reorder queue.' },
      { id: 'mcp:find_customer', name: 'find_customer', kind: 'read', desc: 'Fuzzy-search customers by name, company, email, phone, or WhatsApp.' },
      { id: 'mcp:get_customer', name: 'get_customer', kind: 'read', desc: 'Full customer dossier: contact, tags, lifetime spend, last 10 invoices.' },
      { id: 'mcp:get_account_context', name: 'get_account_context', kind: 'read', desc: 'Orientation: currency, invoice prefix/next number, WhatsApp number, rates, live counts.' },
      { id: 'mcp:list_invoices', name: 'list_invoices', kind: 'read', desc: 'Invoices newest-first; filter by status, payment, customer, or free text.' },
      { id: 'mcp:get_invoice', name: 'get_invoice', kind: 'read', desc: 'Full invoice by id or number, with line items and totals.' },
      { id: 'mcp:sales_summary', name: 'sales_summary', kind: 'read', desc: 'Revenue and volume over N days: paid vs unpaid, grams sold, top 5 teas.' },
      { id: 'mcp:create_tea', name: 'create_tea', kind: 'write', desc: 'Create a new product. Use add_stock for restocks of an existing tea.' },
      { id: 'mcp:add_stock', name: 'add_stock', kind: 'write', desc: 'Receive stock for an existing tea — writes a purchase-receipt ledger row.' },
      { id: 'mcp:remove_stock', name: 'remove_stock', kind: 'write', desc: 'Adjust stock down with a reason.' },
      { id: 'mcp:record_sale', name: 'record_sale', kind: 'write', desc: 'Log a sale — creates + fills an invoice through the real fulfillment path.' },
      { id: 'mcp:set_low_stock_threshold', name: 'set_low_stock_threshold', kind: 'write', desc: 'Set the reorder trigger for a tea.' },
      { id: 'mcp:update_invoice', name: 'update_invoice', kind: 'write', desc: 'Edit an existing invoice.' },
      { id: 'mcp:void_invoice', name: 'void_invoice', kind: 'write', desc: 'Void an invoice.' },
      { id: 'mcp:fulfill_invoice', name: 'fulfill_invoice', kind: 'write', desc: 'Fulfill an invoice — fires stock ledger, listing mirror, low-stock alerts.' },
      { id: 'mcp:mark_invoice_paid', name: 'mark_invoice_paid', kind: 'write', desc: 'Mark an invoice paid.' },
      { id: 'mcp:create_customer', name: 'create_customer', kind: 'owner', desc: 'Add a new customer record.' },
      { id: 'mcp:update_customer', name: 'update_customer', kind: 'owner', desc: 'Edit customer details.' },
      { id: 'mcp:tag_customer', name: 'tag_customer', kind: 'owner', desc: 'Apply a contact tag.' },
      { id: 'mcp:untag_customer', name: 'untag_customer', kind: 'owner', desc: 'Remove a contact tag.' },
      { id: 'mcp:link_vendor', name: 'link_vendor', kind: 'owner', desc: 'Link a tea to a vendor/source.' },
      { id: 'mcp:unlink_vendor', name: 'unlink_vendor', kind: 'owner', desc: 'Unlink a vendor.' },
      { id: 'mcp:update_tea_pricing', name: 'update_tea_pricing', kind: 'owner', desc: 'Change a tea\'s pricing.' },
      { id: 'mcp:set_archive_status', name: 'set_archive_status', kind: 'owner', desc: 'Archive or unarchive a tea.' },
      { id: 'mcp:update_account_settings', name: 'update_account_settings', kind: 'owner', desc: 'Change account-level settings.' },
      { id: 'mcp:update_exchange_rate', name: 'update_exchange_rate', kind: 'owner', desc: 'Update a currency rate — affects ALL accounts. Platform-owner only.' },
    ],
  },
  {
    id: 'mcp-public', title: 'MCP — public shop assistant',
    note: 'No login, read-only. Anyone\'s AI can help a shopper browse and build a WhatsApp order. Public-safe fields only. Scope a shop with ?account=<slug>.',
    endpoint: API + '/mcp/public',
    items: [
      { id: 'mcpp:search_tea', name: 'search_tea', kind: 'public', desc: 'Search the public catalog by name, origin, year, or type.' },
      { id: 'mcpp:get_tea', name: 'get_tea', kind: 'public', desc: 'Public profile for one tea: description, tasting notes, origin, price, shop link.' },
      { id: 'mcpp:browse_catalog', name: 'browse_catalog', kind: 'public', desc: 'Browse the public catalog, optionally filtered by type, in-stock first.' },
      { id: 'mcpp:prepare_order', name: 'prepare_order', kind: 'public', desc: 'Assemble a wa.me checkout link for a basket. Never places an order.' },
    ],
  },
  {
    id: 'data', title: 'Data & docs',
    note: 'Reference material and discoverability.',
    items: [
      { id: 'data:library', name: 'Development Library', to: '/account/docs', desc: 'Every design + build doc rendered in-app. Owner-only.' },
      { id: 'data:llms', name: 'llms.txt', href: '/llms.txt', desc: 'Machine-readable guide that makes the shop legible to external AI assistants.' },
    ],
  },
];

const ALL_ITEMS = SECTIONS.flatMap((s) => s.items);
const KIND_LABEL: Record<string, string> = { read: 'Read', write: 'Write · Operator', owner: 'Write · Owner', public: 'Public · read-only' };

// A small segmented control for a single dimension.
function Segmented({ value, options, onChange, accentFor }: {
  value: string;
  options: { v: string; label: string }[];
  onChange: (v: string) => void;
  accentFor?: (v: string) => string;
}) {
  return (
    <div className="inline-flex rounded-full bg-tea-elevated p-0.5 gap-0.5">
      {options.map((o) => {
        const active = value === o.v;
        const accent = active ? (accentFor?.(o.v) ?? 'bg-tea-gold/20 text-tea-text') : 'text-tea-text-dim hover:text-tea-text-sec';
        return (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={`font-sans text-ui-11 px-2.5 py-1 rounded-full transition-colors tap-target ${accent}`}
          >
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
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<'all' | 'untested' | 'broken' | 'needs_redesign'>('all');

  useEffect(() => {
    if (!isAdmin) return;
    api.featureStatus.list()
      .then((map) => setStatuses(map as Record<string, Status>))
      .catch(() => { /* empty/first run — defaults apply */ })
      .finally(() => setLoaded(true));
  }, [isAdmin]);

  const statusFor = useCallback((id: string): Status => statuses[id] ?? DEFAULT_STATUS, [statuses]);

  const patch = useCallback((id: string, p: Partial<Status>) => {
    setStatuses((prev) => ({ ...prev, [id]: { ...(prev[id] ?? DEFAULT_STATUS), ...p } }));
    api.featureStatus.save(id, p).catch(() => { /* optimistic — keep local on failure */ });
  }, []);

  const counts = useMemo(() => {
    let untested = 0, broken = 0, redesign = 0, solid = 0;
    for (const it of ALL_ITEMS) {
      const s = statusFor(it.id);
      if (!s.tested) untested++;
      if (s.works === 'broken') broken++;
      if (s.visual === 'needs_redesign') redesign++;
      if (s.stage === 'solid') solid++;
    }
    return { untested, broken, redesign, solid, total: ALL_ITEMS.length };
  }, [statusFor]);

  if (!isAdmin) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center pb-nav">
        <div className="font-display text-[22px] text-tea-text mb-2">Not available</div>
        <p className="font-serif text-ui-15 text-tea-text-sec max-w-[320px]">
          The feature guide is visible to the platform owner only.
        </p>
        <button onClick={() => navigate('/account')} className="mt-6 text-ui-13 text-tea-text-sec hover:text-tea-text underline underline-offset-2">
          Back to Your Table
        </button>
      </div>
    );
  }

  const itemVisible = (it: Item) => {
    if (filter === 'all') return true;
    const s = statusFor(it.id);
    if (filter === 'untested') return !s.tested;
    if (filter === 'broken') return s.works === 'broken';
    if (filter === 'needs_redesign') return s.visual === 'needs_redesign';
    return true;
  };

  return (
    <div className="min-h-dvh bg-tea-bg pb-nav-gap-lg">
      {/* Header + filters */}
      <div className="sticky top-0 z-10 bg-tea-bg/95 backdrop-blur-sm border-b border-tea-border">
        <div className="max-w-[1040px] mx-auto px-6 lg:px-8 py-3">
          <button onClick={() => navigate('/account')} className="flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text mb-2.5 tap-target">
            <ArrowLeft className="w-4 h-4" weight="bold" />
            <span className="text-ui-13">Your Table</span>
          </button>
          <div className="flex flex-wrap items-center gap-1.5">
            {([
              ['all', `All ${counts.total}`],
              ['untested', `Untested ${counts.untested}`],
              ['broken', `Broken ${counts.broken}`],
              ['needs_redesign', `Needs redesign ${counts.redesign}`],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`font-sans text-ui-12 tracking-[0.03em] px-2.5 py-1 rounded-full transition-colors ${
                  filter === k ? 'bg-tea-gold/12 text-tea-text' : 'text-tea-text-sec hover:bg-tea-gold/[0.06] hover:text-tea-text'
                }`}
              >
                {label}
              </button>
            ))}
            <span className="font-sans text-ui-12 text-tea-text-dim ml-auto">{counts.solid} solid</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1040px] mx-auto px-6 lg:px-8 pt-8">
        <div className="font-sans text-ui-12 uppercase tracking-[0.14em] text-tea-text-dim">Working Feature Guide</div>
        <h1 className="font-display text-ui-26 text-tea-text tracking-[0.01em] mt-2">Everything Teajia can do</h1>
        <p className="font-serif text-ui-15 text-tea-text-sec mt-3 mb-10 leading-[1.65] max-w-[640px]">
          Your internal workbench. Every feature, what it does, and one click to go test it. Mark each one as you
          work through it — stage, whether it works, whether you tested it, whether the visuals need a redesign.
          Your marks save automatically.
        </p>

        {SECTIONS.map((s) => {
          const visibleItems = s.items.filter(itemVisible);
          if (visibleItems.length === 0) return null;
          const isMcp = s.id === 'mcp-auth' || s.id === 'mcp-public';
          return (
            <section key={s.id} className="mb-14">
              <div className="flex items-baseline gap-3 mb-1">
                <h2 className="font-display text-ui-20 text-tea-text tracking-[0.01em]">{s.title}</h2>
                <span className="font-sans text-ui-12 text-tea-text-dim tracking-[0.04em]">{visibleItems.length}</span>
              </div>
              <p className="font-serif text-ui-15 text-tea-text-sec mb-3 max-w-[680px] leading-[1.6]">{s.note}</p>
              {s.endpoint && (
                <div className="mb-5 flex flex-wrap items-center gap-3">
                  <code className="font-mono text-ui-13 text-tea-gold-lt bg-tea-elevated rounded-xl px-3 py-1.5">{s.endpoint}</code>
                  {s.tokenTo && (
                    <button onClick={() => navigate(s.tokenTo!)} className="inline-flex items-center gap-1.5 font-sans text-ui-13 font-medium text-tea-gold-lt border border-tea-gold/35 rounded-full px-3 py-1.5 hover:bg-tea-gold/12 hover:border-tea-gold tap-target">
                      Mint a token <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                    </button>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-3">
                {visibleItems.map((it) => {
                  const st = statusFor(it.id);
                  return (
                    <div key={it.id} className="bg-tea-surface border border-tea-border rounded-xl p-4">
                      {/* Top row: name + desc + open */}
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-sans text-ui-14 font-semibold text-tea-text">
                              {isMcp ? <code className="font-mono text-ui-13 text-tea-gold-lt bg-tea-elevated rounded px-1.5 py-0.5">{it.name}</code> : it.name}
                            </span>
                            {it.kind && <span className="font-sans text-ui-10 uppercase tracking-[0.06em] text-tea-text-dim">{KIND_LABEL[it.kind]}</span>}
                          </div>
                          <p className="font-serif text-ui-14 text-tea-text-sec mt-1 leading-[1.5]">{it.desc}</p>
                          {it.how && <div className="font-sans text-ui-12 text-tea-text-dim mt-1.5"><span className="text-tea-text-sec font-semibold">How: </span>{it.how}</div>}
                        </div>
                        {it.to && (
                          <button onClick={() => navigate(it.to!)} className="shrink-0 inline-flex items-center gap-1.5 font-sans text-ui-13 font-medium text-tea-gold-lt border border-tea-gold/35 rounded-full px-3 py-1.5 hover:bg-tea-gold/12 hover:border-tea-gold tap-target">
                            Open <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                          </button>
                        )}
                        {it.href && (
                          <a href={it.href} target="_blank" rel="noreferrer" className="shrink-0 inline-flex items-center gap-1.5 font-sans text-ui-13 font-medium text-tea-gold-lt border border-tea-gold/35 rounded-full px-3 py-1.5 hover:bg-tea-gold/12 hover:border-tea-gold tap-target">
                            Open <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                          </a>
                        )}
                      </div>

                      {/* Status dimensions */}
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 mt-3.5 pt-3.5 border-t border-tea-border">
                        <label className="flex items-center gap-1.5">
                          <span className="font-sans text-ui-11 uppercase tracking-[0.06em] text-tea-text-dim">Stage</span>
                          <Segmented value={st.stage} options={STAGES} onChange={(v) => patch(it.id, { stage: v })}
                            accentFor={(v) => v === 'solid' ? 'bg-tea-gold/20 text-tea-gold-lt' : 'bg-tea-gold/15 text-tea-text'} />
                        </label>
                        <label className="flex items-center gap-1.5">
                          <span className="font-sans text-ui-11 uppercase tracking-[0.06em] text-tea-text-dim">Works</span>
                          <Segmented value={st.works} options={WORKS} onChange={(v) => patch(it.id, { works: v })}
                            accentFor={(v) => v === 'broken' ? 'bg-tea-gold/15 text-tea-gold' : v === 'works' ? 'bg-tea-gold/15 text-tea-text' : 'bg-tea-gold/10 text-tea-text-sec'} />
                        </label>
                        <label className="flex items-center gap-1.5">
                          <span className="font-sans text-ui-11 uppercase tracking-[0.06em] text-tea-text-dim">Visual</span>
                          <Segmented value={st.visual} options={VISUAL} onChange={(v) => patch(it.id, { visual: v })} />
                        </label>
                        <button
                          onClick={() => patch(it.id, { tested: !st.tested })}
                          className="flex items-center gap-1.5 tap-target"
                        >
                          {st.tested
                            ? <CheckCircle className="w-4 h-4 text-tea-gold-lt" weight="fill" />
                            : <Circle className="w-4 h-4 text-tea-text-dim" weight="regular" />}
                          <span className={`font-sans text-ui-12 ${st.tested ? 'text-tea-text' : 'text-tea-text-sec'}`}>Tested</span>
                        </button>
                      </div>

                      {/* Notes */}
                      <NotesField value={st.notes} onCommit={(v) => patch(it.id, { notes: v })} />
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {!loaded && <p className="font-serif text-ui-14 text-tea-text-dim">Loading your marks…</p>}
      </div>
    </div>
  );
}

// Notes commit on blur (not every keystroke) to avoid a save per character.
function NotesField({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft !== value) onCommit(draft); }}
      placeholder="Notes — what's left, bugs, ideas…"
      className="w-full mt-3 bg-tea-elevated rounded-xl px-3 py-2 font-serif text-ui-14 text-tea-text placeholder:text-tea-text-dim border border-transparent focus:border-tea-gold/30 focus:outline-none"
    />
  );
}
