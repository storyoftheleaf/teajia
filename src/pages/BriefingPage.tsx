import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import { useAuth } from '../hooks/useAuth';

/**
 * BriefingPage — an owner-facing, in-app capability briefing. A single page
 * that indexes every surface, tool, and integration built into Teajia, so the
 * owner can see what the whole site does and click straight through to the
 * live place where each one is used.
 *
 * This is the in-app counterpart to public/briefing.html. The difference that
 * matters: every internal link here is a real React-Router navigation, so
 * "Open" lands you inside the running app (admin views keep the session,
 * public pages render in place) instead of a hard reload of a static file.
 * External links (MCP endpoints, llms.txt) open in a new tab.
 *
 * Owner-only, both at the route and at the Your Table tile.
 */

const API = 'https://teajia-api.lightcodes.workers.dev';

type Item = {
  name: string;
  /** internal app route — navigated via React Router */
  to?: string;
  /** external URL — opens in a new tab */
  href?: string;
  desc: string;
  how?: string;
  kind?: 'read' | 'write' | 'owner' | 'public';
};

type Section = {
  id: string;
  title: string;
  note: string;
  endpoint?: string;
  tokenTo?: string;
  items: Item[];
};

const SECTIONS: Section[] = [
  {
    id: 'public',
    title: 'Public surfaces',
    note: 'What a visitor or customer sees. Click any to open the real page.',
    items: [
      { name: 'Home', to: '/', desc: 'The storefront entry — hero, grounding lines, the four sections.' },
      { name: 'Shop', to: '/shop', desc: 'The full catalog. Filter by type, mood, and flavor; open any tea.' },
      { name: 'Magazine / Journal', to: '/magazine', desc: 'Editorial articles in the 4:5 immersive reader, shareable to Instagram.' },
      { name: 'Learn / Craft', to: '/craft', desc: 'The learning hub — modules across tea tracks.' },
      { name: 'Consult / Advise', to: '/consult', desc: 'Question-driven guidance flow with path cards.' },
      { name: 'Events', to: '/events', desc: 'Tea gatherings — public event pages, RSVP, capacity, recaps.' },
      { name: 'Start Here', to: '/start', desc: 'Six entry paths for a first-time visitor.' },
      { name: 'Spaces', to: '/spaces', desc: 'The three Bali locations with WhatsApp inquiry.' },
      { name: 'For Your Space', to: '/for-your-space', desc: 'B2B inquiry for hotels, studios, retreat centers.' },
      { name: 'Your Table', to: '/account', desc: 'The personal hub — role-adaptive (Reader / Member / Operator / Staff).' },
      { name: 'Tasting Journal', to: '/account/journal', desc: 'Your tasting history with sync; off-phone-during-tea by design.' },
      { name: 'Collections', to: '/account/collections', desc: 'Curated tea sets shared with you; request a basket.' },
    ],
  },
  {
    id: 'admin',
    title: 'Admin tools',
    note: 'The operating system of the shop. Each opens its admin view directly.',
    items: [
      { name: 'Dashboard', to: '/admin/dashboard', desc: 'Real-time financial intelligence: cost, retail, margin, currency exposure, regional spread.' },
      { name: 'Stock (Inventory)', to: '/admin/stock', desc: 'The inventory system: inline editing, bulk ops, fuzzy search, QR codes, year-strip, batches.' },
      { name: 'Catalog', to: '/admin/catalog', desc: 'Product management — conditional fields, vendor picker, cost engine, pricing automation.' },
      { name: 'Teaware', to: '/admin/teaware', desc: 'The teaware side of the catalog.' },
      { name: 'Orders', to: '/admin/orders', desc: 'Order pipeline: Pending to Filled to Void, fulfillment preview, activity timeline.' },
      { name: 'Purchase Orders', to: '/admin/purchase-orders', desc: 'Inbound purchase orders with PDF output.' },
      { name: 'People / CRM', to: '/admin/people', desc: 'Customers: tags, purchase history, lifetime spend, vendor cost analysis.' },
      { name: 'Sources / Vendors', to: '/admin/sources', desc: 'Where teas come from — vendor lineage, cost analysis.' },
      { name: 'Contact Tags', to: '/admin/contact-tags', desc: 'Freeform admin-only contact tags + tag-aware share picker.' },
      { name: 'Quick Capture', to: '/admin/capture', desc: 'Camera/file upload with AI data extraction — two-stage pipeline, bulk approve.' },
      { name: 'Events Manager', to: '/admin/events', desc: 'Full CRUD: capacity, waitlist, attendees, tea-menu editor, post-session recap.' },
      { name: 'Tasting Events', to: '/admin/tasting-events', desc: 'Live guided tasting sessions with structured taxonomy.' },
      { name: 'Magazine Editor', to: '/admin/magazine', desc: 'D1 block editor with Smart Paste for building articles.' },
      { name: 'Collections', to: '/admin/collections', desc: 'Build curated, publishable collections — editorial bands on the storefront.' },
      { name: 'Network', to: '/admin/network', desc: 'Multi-store: listings, wholesale orders, adoptions, cross-pollination.' },
      { name: 'Members & Access', to: '/admin/access', desc: 'Tiers (Guest to Owner) and capability bundles (Catalog, Stock, Publish, Gather, Sell, Members).' },
      { name: 'Currency', to: '/admin/currency', desc: 'Exchange-rate admin used across all accounts.' },
      { name: 'Records & Activity', to: '/admin/records', desc: 'Archive, activity logs, stock ledger, CSV export.' },
      { name: 'MCP Tokens', to: '/admin/mcp-tokens', desc: 'Mint and revoke tokens for the voice/agent assistant. Shown once on creation.' },
      { name: 'Platform Audit Log', to: '/admin/platform/audit-log', desc: 'Every cross-account state change, owner-only.' },
      { name: 'Development Library', to: '/account/docs', desc: 'Every design and build doc, rendered in-app. Owner-only.' },
    ],
  },
  {
    id: 'imports',
    title: 'Imports & exports',
    note: 'Getting data in and out in bulk.',
    items: [
      { name: 'CSV stock import', to: '/admin/stock', desc: 'Import a whole spreadsheet of teas at once — name, grams, cost, currency, stock, batch. Staged with review before commit.', how: 'Admin → Stock → import.' },
      { name: 'CSV export', to: '/admin/records', desc: 'Export records, activity, and stock ledger as CSV.' },
      { name: 'Invoice PDF', to: '/admin/orders', desc: 'Generate an invoice as a downloadable/shareable PDF.', how: 'Open an order, download PDF.' },
      { name: 'Purchase Order PDF', to: '/admin/purchase-orders', desc: 'Generate a purchase order as a PDF.' },
      { name: 'Tasting Ledger PDF', to: '/account/journal', desc: 'Export the Compass tasting ledger as a PDF.' },
      { name: 'QR codes', to: '/admin/stock', desc: 'Per-product QR codes and brewing-guide QR cards with WhatsApp share.' },
    ],
  },
  {
    id: 'mcp-auth',
    title: 'MCP — your assistant',
    note: 'Connect a voice/agent assistant to the authenticated server and it can run these. Mutating tools use a two-step preview then confirm. Mint a token first, then point your assistant at the endpoint.',
    endpoint: API + '/mcp',
    tokenTo: '/admin/mcp-tokens',
    items: [
      { name: 'search_tea', kind: 'read', desc: 'Fuzzy-search inventory by name, Chinese name, region, or vendor. Returns stock + match score.' },
      { name: 'get_tea', kind: 'read', desc: 'Full record for one tea, including the last 10 stock-ledger entries.' },
      { name: 'list_low_stock', kind: 'read', desc: 'Teas below their per-product low-stock threshold — the reorder queue.' },
      { name: 'find_customer', kind: 'read', desc: 'Fuzzy-search customers by name, company, email, phone, or WhatsApp.' },
      { name: 'get_customer', kind: 'read', desc: 'Full customer dossier: contact, tags, lifetime spend, last 10 invoices.' },
      { name: 'get_account_context', kind: 'read', desc: 'Orientation: currency, invoice prefix/next number, WhatsApp number, rates, live counts.' },
      { name: 'list_invoices', kind: 'read', desc: 'Invoices newest-first; filter by status, payment, customer, or free text.' },
      { name: 'get_invoice', kind: 'read', desc: 'Full invoice by id or number, with line items and totals.' },
      { name: 'sales_summary', kind: 'read', desc: 'Revenue and volume over N days: paid vs unpaid, grams sold, top 5 teas.' },
      { name: 'create_tea', kind: 'write', desc: 'Create a new product. Use add_stock for restocks of an existing tea.' },
      { name: 'add_stock', kind: 'write', desc: 'Receive stock for an existing tea — writes a purchase-receipt ledger row.' },
      { name: 'remove_stock', kind: 'write', desc: 'Adjust stock down with a reason.' },
      { name: 'record_sale', kind: 'write', desc: 'Log a sale — creates + fills an invoice through the real fulfillment path.' },
      { name: 'set_low_stock_threshold', kind: 'write', desc: 'Set the reorder trigger for a tea.' },
      { name: 'update_invoice', kind: 'write', desc: 'Edit an existing invoice.' },
      { name: 'void_invoice', kind: 'write', desc: 'Void an invoice.' },
      { name: 'fulfill_invoice', kind: 'write', desc: 'Fulfill an invoice — fires stock ledger, listing mirror, low-stock alerts.' },
      { name: 'mark_invoice_paid', kind: 'write', desc: 'Mark an invoice paid.' },
      { name: 'create_customer', kind: 'owner', desc: 'Add a new customer record.' },
      { name: 'update_customer', kind: 'owner', desc: 'Edit customer details.' },
      { name: 'tag_customer', kind: 'owner', desc: 'Apply a contact tag.' },
      { name: 'untag_customer', kind: 'owner', desc: 'Remove a contact tag.' },
      { name: 'link_vendor', kind: 'owner', desc: 'Link a tea to a vendor/source.' },
      { name: 'unlink_vendor', kind: 'owner', desc: 'Unlink a vendor.' },
      { name: 'update_tea_pricing', kind: 'owner', desc: 'Change a tea\'s pricing.' },
      { name: 'set_archive_status', kind: 'owner', desc: 'Archive or unarchive a tea.' },
      { name: 'update_account_settings', kind: 'owner', desc: 'Change account-level settings.' },
      { name: 'update_exchange_rate', kind: 'owner', desc: 'Update a currency rate — affects ALL accounts. Platform-owner only.' },
    ],
  },
  {
    id: 'mcp-public',
    title: 'MCP — public shop assistant',
    note: 'No login, read-only. Anyone\'s AI can connect to help a shopper browse and build a WhatsApp order. Public-safe fields only — no cost, margin, vendor, or exact stock. Scope a shop with ?account=<slug>.',
    endpoint: API + '/mcp/public',
    items: [
      { name: 'search_tea', kind: 'public', desc: 'Search the public catalog by name, origin, year, or type. Returns retail price + in-stock.' },
      { name: 'get_tea', kind: 'public', desc: 'Public profile for one tea: description, tasting notes, origin, price, shop link.' },
      { name: 'browse_catalog', kind: 'public', desc: 'Browse the public catalog, optionally filtered by type, in-stock first.' },
      { name: 'prepare_order', kind: 'public', desc: 'Assemble a wa.me checkout link for a basket. Never places an order — the human closes it in WhatsApp.' },
    ],
  },
  {
    id: 'data',
    title: 'Data & docs',
    note: 'Reference material and discoverability.',
    items: [
      { name: 'Development Library', to: '/account/docs', desc: 'Every design + build doc rendered in-app. Owner-only.' },
      { name: 'llms.txt', href: '/llms.txt', desc: 'Machine-readable guide that makes the shop legible to external AI assistants.' },
    ],
  },
];

const KIND_LABEL: Record<NonNullable<Item['kind']>, string> = {
  read: 'Read',
  write: 'Write · Operator',
  owner: 'Write · Owner',
  public: 'Public · read-only',
};
const KIND_CLASS: Record<NonNullable<Item['kind']>, string> = {
  read: 'text-tea-text-sec bg-tea-elevated',
  write: 'text-tea-gold-lt bg-tea-gold/12',
  owner: 'text-tea-gold bg-tea-gold/12',
  public: 'text-tea-text-sec bg-tea-elevated',
};

export default function BriefingPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id);

  if (!isAdmin) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center pb-nav">
        <div className="font-display text-[22px] text-tea-text mb-2">Not available</div>
        <p className="font-serif text-ui-15 text-tea-text-sec max-w-[320px]">
          The capability briefing is visible to the platform owner only.
        </p>
        <button
          onClick={() => navigate('/account')}
          className="mt-6 text-ui-13 text-tea-text-sec hover:text-tea-text underline underline-offset-2"
        >
          Back to Your Table
        </button>
      </div>
    );
  }

  const isMcp = (id: string) => id === 'mcp-auth' || id === 'mcp-public';

  return (
    <div className="min-h-dvh bg-tea-bg pb-nav-gap-lg">
      {/* Sticky section nav */}
      <div className="sticky top-0 z-10 bg-tea-bg/95 backdrop-blur-sm border-b border-tea-border">
        <div className="max-w-[1040px] mx-auto px-6 lg:px-8 py-3">
          <button
            onClick={() => navigate('/account')}
            className="flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text mb-2.5 tap-target"
          >
            <ArrowLeft className="w-4 h-4" weight="bold" />
            <span className="text-ui-13">Your Table</span>
          </button>
          <div className="flex flex-wrap gap-1">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={() => setActiveSection(s.id)}
                className={`font-sans text-ui-12 tracking-[0.04em] px-2.5 py-1 rounded-full transition-colors ${
                  activeSection === s.id
                    ? 'bg-tea-gold/12 text-tea-text'
                    : 'text-tea-text-sec hover:bg-tea-gold/[0.06] hover:text-tea-text'
                }`}
              >
                {s.title}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1040px] mx-auto px-6 lg:px-8 pt-8">
        <div className="font-sans text-ui-12 uppercase tracking-[0.14em] text-tea-text-dim">Capability Briefing</div>
        <h1 className="font-display text-ui-26 text-tea-text tracking-[0.01em] mt-2">Everything Teajia can do</h1>
        <p className="font-serif text-ui-15 text-tea-text-sec mt-3 mb-10 leading-[1.65] max-w-[640px]">
          A live index of every surface, tool, and integration built into the platform. Each entry says what it
          is, how to reach it, and a link to open it where you actually use it. Owner reference.
        </p>

        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="mb-14 scroll-mt-28">
            <div className="flex items-baseline gap-3 mb-1">
              <h2 className="font-display text-ui-20 text-tea-text tracking-[0.01em]">{s.title}</h2>
              <span className="font-sans text-ui-12 text-tea-text-dim tracking-[0.04em]">
                {s.items.length} {s.items.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <p className="font-serif text-ui-15 text-tea-text-sec mb-3 max-w-[680px] leading-[1.6]">{s.note}</p>

            {s.endpoint && (
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <code className="font-mono text-ui-13 text-tea-gold-lt bg-tea-elevated rounded-xl px-3 py-1.5">
                  {s.endpoint}
                </code>
                {s.tokenTo && (
                  <button
                    onClick={() => navigate(s.tokenTo!)}
                    className="inline-flex items-center gap-1.5 font-sans text-ui-13 font-medium text-tea-gold-lt border border-tea-gold/35 rounded-full px-3 py-1.5 hover:bg-tea-gold/12 hover:border-tea-gold tap-target"
                  >
                    Mint a token
                    <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {s.items.map((it) => (
                <div
                  key={`${s.id}-${it.name}`}
                  className="bg-tea-surface border border-tea-border rounded-xl p-4 hover:border-tea-gold/40 transition-colors flex flex-col"
                >
                  <div className="font-sans text-ui-14 font-semibold text-tea-text">
                    {isMcp(s.id) ? (
                      <code className="font-mono text-ui-13 text-tea-gold-lt bg-tea-elevated rounded px-1.5 py-0.5">{it.name}</code>
                    ) : (
                      it.name
                    )}
                  </div>
                  <p className="font-serif text-ui-14 text-tea-text-sec mt-1.5 mb-3 leading-[1.5] flex-1">{it.desc}</p>
                  {it.how && (
                    <div className="font-sans text-ui-12 text-tea-text-dim mb-3">
                      <span className="text-tea-text-sec font-semibold">How: </span>
                      {it.how}
                    </div>
                  )}
                  {it.kind && (
                    <div className="mb-3">
                      <span className={`inline-block font-sans text-ui-10 uppercase tracking-[0.06em] px-2 py-0.5 rounded-full ${KIND_CLASS[it.kind]}`}>
                        {KIND_LABEL[it.kind]}
                      </span>
                    </div>
                  )}
                  {it.to && (
                    <button
                      onClick={() => navigate(it.to!)}
                      className="self-start inline-flex items-center gap-1.5 font-sans text-ui-13 font-medium text-tea-gold-lt border border-tea-gold/35 rounded-full px-3 py-1.5 hover:bg-tea-gold/12 hover:border-tea-gold tap-target"
                    >
                      Open
                      <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                    </button>
                  )}
                  {it.href && (
                    <a
                      href={it.href}
                      target="_blank"
                      rel="noreferrer"
                      className="self-start inline-flex items-center gap-1.5 font-sans text-ui-13 font-medium text-tea-gold-lt border border-tea-gold/35 rounded-full px-3 py-1.5 hover:bg-tea-gold/12 hover:border-tea-gold tap-target"
                    >
                      Open
                      <ArrowRight className="w-3.5 h-3.5" weight="bold" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
