import React, { useState } from 'react';
import {
  Plus, Search, RefreshCw, Settings, MoreHorizontal, X, ArrowLeft,
  Check, AlertCircle, Loader2, Trash2, Edit3, Download, ChevronRight,
  Inbox, BookOpen, Users, Package, Activity, Sparkles,
} from 'lucide-react';
import { TYPOGRAPHY_CLASSES } from '../designTokens';

const Section: React.FC<{ id: string; title: string; subtitle?: string; children: React.ReactNode }> = ({
  id, title, subtitle, children,
}) => (
  <section id={id} className="scroll-mt-20">
    <header className="mb-6">
      <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim mb-1">§ {id}</div>
      <h2 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>{title}</h2>
      {subtitle && (
        <p className="text-ui-13 text-tea-text-sec mt-1 italic">{subtitle}</p>
      )}
    </header>
    {children}
  </section>
);

const Swatch: React.FC<{ name: string; varName: string; hex: string; note?: string }> = ({
  name, varName, hex, note,
}) => (
  <div className="flex items-center gap-3">
    <div
      className="w-12 h-12 rounded-md border border-tea-border flex-shrink-0"
      style={{ backgroundColor: `var(${varName})` }}
      aria-hidden
    />
    <div className="min-w-0">
      <div className="text-ui-13 text-tea-text">{name}</div>
      <div className="text-ui-11 text-tea-text-dim font-mono">{varName}</div>
      <div className="text-ui-11 text-tea-text-dim font-mono">{hex}</div>
      {note && <div className="text-ui-11 text-tea-text-sec mt-0.5">{note}</div>}
    </div>
  </div>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="grid grid-cols-[140px_1fr] gap-4 items-center py-3 border-b border-tea-border">
    <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim">{label}</div>
    <div className="flex flex-wrap items-center gap-3">{children}</div>
  </div>
);

const PrimaryButton: React.FC<{ icon?: React.ReactNode; children: React.ReactNode; disabled?: boolean; loading?: boolean }> = ({
  icon, children, disabled, loading,
}) => (
  <button
    disabled={disabled || loading}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 active:bg-tea-gold/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
  >
    {loading ? <Loader2 size={13} className="animate-spin" /> : icon}
    {children}
  </button>
);

const SecondaryButton: React.FC<{ icon?: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors text-xs">
    {icon}
    {children}
  </button>
);

const GhostButton: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <button className="px-2 py-1 text-xs text-tea-text-sec hover:text-tea-text transition-colors">
    {children}
  </button>
);

const IconButton: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
  <button
    title={title}
    aria-label={title}
    className="tap-target p-1.5 rounded-md text-tea-text-dim hover:text-tea-text-sec transition-colors"
  >
    {icon}
  </button>
);

const DestructiveButton: React.FC<{ icon?: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-error text-tea-bg text-xs font-semibold hover:bg-tea-error/90 transition-colors">
    {icon}
    {children}
  </button>
);

const StatusPill: React.FC<{ variant: 'draft' | 'active' | 'archived' | 'error' | 'success'; children: React.ReactNode }> = ({
  variant, children,
}) => {
  const styles: Record<typeof variant, string> = {
    draft:    'bg-tea-elevated text-tea-text-sec',
    active:   'bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40',
    archived: 'bg-tea-elevated text-tea-text-dim',
    error:    'bg-tea-error/10 text-tea-error ring-1 ring-inset ring-tea-error/40',
    success:  'bg-tea-green/10 text-tea-green ring-1 ring-inset ring-tea-green/40',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-ui-9 uppercase tracking-[1.2px] ${styles[variant]}`}>
      {children}
    </span>
  );
};

const SAMPLE_ROWS = [
  { title: 'Spring 2026 Roast', meta: '12 teas · updated 2 days ago', status: 'active' as const },
  { title: 'Wholesale Catalog', meta: '24 teas · updated 1 week ago', status: 'draft' as const },
  { title: 'Holiday Limited',   meta: '8 teas · updated 3 weeks ago', status: 'archived' as const },
  { title: 'Daily Drinkers',    meta: '18 teas · updated yesterday',  status: 'active' as const },
];

const SAMPLE_TABLE = [
  { name: 'Acme Cafe',          date: 'Mar 12', amount: '$124.00', status: 'paid' },
  { name: 'Coastal Tea House',  date: 'Mar 11', amount: '$348.50', status: 'paid' },
  { name: 'Wei Bo Studio',      date: 'Mar 10', amount: '$62.00',  status: 'pending' },
  { name: 'The Green Door',     date: 'Mar 9',  amount: '$210.00', status: 'paid' },
];

const SECTIONS = [
  { id: 'tokens', label: 'Tokens' },
  { id: 'type',   label: 'Type' },
  { id: 'chrome', label: 'Chrome' },
  { id: 'tabs',   label: 'Tabs' },
  { id: 'buttons',label: 'Buttons' },
  { id: 'inputs', label: 'Inputs' },
  { id: 'cards',  label: 'Surfaces' },
  { id: 'tables', label: 'Tables' },
  { id: 'states', label: 'States' },
  { id: 'modal',  label: 'Modal' },
  { id: 'icons',  label: 'Icons' },
  { id: 'spacing',label: 'Spacing' },
  { id: 'avoid',  label: 'Avoid' },
];

export default function DesignSystemShowcase() {
  const [activeTab, setActiveTab] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  return (
    <div className="min-h-dvh bg-tea-bg pb-nav-gap-lg">
      {/* Sticky page chrome — exemplar */}
      <header className="sticky top-0 z-sticky h-16 px-4 md:px-6 lg:px-10 bg-tea-bg/90 backdrop-blur-md border-b border-tea-border flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text truncate`}>Design System</h1>
          <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim">Live exemplar · every pattern</div>
        </div>
        <div className="flex items-center gap-2">
          <IconButton icon={<RefreshCw size={14} />} title="Refresh" />
          <IconButton icon={<Settings size={14} />} title="Settings" />
          <PrimaryButton icon={<Plus size={13} />}>New Page</PrimaryButton>
        </div>
      </header>

      {/* Section jump nav — bottom-border underline (canonical) */}
      <nav className="sticky top-16 z-dropdown bg-tea-bg/95 backdrop-blur-md border-b border-tea-border">
        <div className="flex items-center gap-6 px-4 md:px-6 lg:px-10 overflow-x-auto scrollbar-hide">
          {SECTIONS.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="py-2.5 text-ui-12 uppercase tracking-[0.15em] text-tea-text-sec hover:text-tea-text border-b border-transparent hover:border-tea-border whitespace-nowrap transition-colors"
            >
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      <main className="px-4 md:px-6 lg:px-10 max-w-7xl mx-auto py-10 space-y-16">

        {/* ───────────── TOKENS ───────────── */}
        <Section id="tokens" title="Color tokens" subtitle="Semantic, not decorative. Reference by name; never hex.">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Swatch name="Background"        varName="--tea-bg"       hex="#18130e" note="Page" />
            <Swatch name="Surface"           varName="--tea-surface"  hex="#28211a" note="Cards, panels" />
            <Swatch name="Elevated"          varName="--tea-elevated" hex="#3a3126" note="Popovers, hover lift" />
            <Swatch name="Text"              varName="--tea-text"     hex="#ede4d4" note="Primary" />
            <Swatch name="Text secondary"    varName="--tea-text-sec" hex="#b5a892" note="Labels, captions" />
            <Swatch name="Text dim"          varName="--tea-text-dim" hex="#80735f" note="Eyebrow, meta" />
            <Swatch name="Gold"              varName="--tea-gold"     hex="#a8874d" note="Accent, active, primary" />
            <Swatch name="Gold light"        varName="--tea-gold-lt"  hex="#bfa06a" note="Hover only" />
            <Swatch name="Border"            varName="--tea-border"   hex="rgba(184,146,78,0.08)" note="All dividers" />
            <Swatch name="Leaf"              varName="--tea-green"     hex="#5A6E5A" note="Success only" />
            <Swatch name="Error"             varName="--tea-error"    hex="#8a3a32" note="Muted oxblood, never bright" />
          </div>
        </Section>

        {/* ───────────── TYPE ───────────── */}
        <Section id="type" title="Typography" subtitle="Display serif for headings, Lora for prose, Plus Jakarta for UI, IBM Plex Mono for numerics.">
          <div className="space-y-6">
            <div>
              <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim mb-2">h1 · hero</div>
              <div className={`${TYPOGRAPHY_CLASSES.h1} text-tea-text`}>Editorial calm</div>
            </div>
            <div>
              <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim mb-2">h2 · page title</div>
              <div className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>The Quiet Roast</div>
            </div>
            <div>
              <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim mb-2">h3 · section / card</div>
              <div className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Hojicha Aki 2026</div>
            </div>
            <div>
              <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim mb-2">subtitle · italic</div>
              <div className={`${TYPOGRAPHY_CLASSES.subtitle} text-tea-text-sec`}>A roasted green tea from Kyoto prefecture</div>
            </div>
            <div>
              <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim mb-2">body · Lora 17px / 1.7</div>
              <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text max-w-prose`}>
                The leaves are roasted at high heat until they take on the color of dark chestnut. What begins as a vegetal green tea ends as something closer to coffee — smoky, nutty, with the faintest sweetness underneath.
              </p>
            </div>
            <div>
              <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim mb-2">label · uppercase eyebrow</div>
              <div className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>JOURNAL · MARCH 2026</div>
            </div>
            <div>
              <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim mb-2">mono · numerics</div>
              <div className={`${TYPOGRAPHY_CLASSES.mono} text-tea-text tabular-nums`}>142.50 · 7.2 · #a8874d</div>
            </div>
            <div>
              <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim mb-2">UI scale (text-ui-N)</div>
              <div className="flex flex-wrap items-end gap-4 text-tea-text">
                <span className="text-ui-9">9</span>
                <span className="text-ui-10">10</span>
                <span className="text-ui-11">11</span>
                <span className="text-ui-12">12</span>
                <span className="text-ui-13">13</span>
                <span className="text-ui-14">14</span>
                <span className="text-ui-15">15</span>
                <span className="text-ui-16">16</span>
                <span className="text-ui-17">17</span>
                <span className="text-ui-20">20</span>
                <span className="text-ui-26">26</span>
                <span className="text-ui-28">28</span>
              </div>
            </div>
          </div>
        </Section>

        {/* ───────────── CHROME ───────────── */}
        <Section id="chrome" title="Page chrome variants" subtitle="Different jobs need different chrome. Same rules — different composition.">
          <div className="space-y-8">
            <div>
              <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim mb-2">Wide working surface (sticky, backdrop-blur, h-16)</div>
              <div className="border border-tea-border rounded-xl overflow-hidden">
                <div className="h-16 px-4 md:px-6 bg-tea-bg/90 backdrop-blur-md border-b border-tea-border flex items-center gap-3">
                  <div className="flex-1">
                    <h3 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>Inventory</h3>
                  </div>
                  <IconButton icon={<RefreshCw size={14} />} title="Refresh" />
                  <PrimaryButton icon={<Plus size={13} />}>New Product</PrimaryButton>
                </div>
                <div className="h-24 bg-tea-surface/30 flex items-center justify-center text-ui-11 text-tea-text-dim italic">
                  page content
                </div>
              </div>
            </div>

            <div>
              <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim mb-2">Narrow form (non-sticky, no border on title row)</div>
              <div className="border border-tea-border rounded-xl overflow-hidden">
                <div className="px-4 md:px-6 pt-6 pb-3 max-w-3xl mx-auto">
                  <h3 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>Settings</h3>
                  <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim mt-1">ACCOUNT · WORKSPACE</div>
                </div>
                <div className="h-24 bg-tea-surface/30 flex items-center justify-center text-ui-11 text-tea-text-dim italic">
                  form fields
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ───────────── TABS ───────────── */}
        <Section id="tabs" title="Tab strip" subtitle="Bottom-border underline. The segmented pill is banned.">
          <div className="border border-tea-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-6 px-4 md:px-6 border-b border-tea-border">
              {[
                { id: 'all',       label: 'All' },
                { id: 'draft',     label: 'Drafts', count: 3 },
                { id: 'published', label: 'Published' },
                { id: 'archived',  label: 'Archived' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`py-2.5 text-ui-12 uppercase tracking-[0.15em] border-b transition-colors whitespace-nowrap ${
                    activeTab === t.id
                      ? 'text-tea-text border-tea-gold'
                      : 'text-tea-text-sec hover:text-tea-text border-transparent'
                  }`}
                >
                  {t.label}
                  {t.count !== undefined && (
                    <span className="ml-1.5 text-tea-text-dim">({t.count})</span>
                  )}
                </button>
              ))}
            </div>
            <div className="h-24 bg-tea-surface/30 flex items-center justify-center text-ui-11 text-tea-text-dim italic">
              {activeTab} content
            </div>
          </div>
        </Section>

        {/* ───────────── BUTTONS ───────────── */}
        <Section id="buttons" title="Buttons" subtitle="Title case. font-semibold. No uppercase tracking on actions.">
          <Row label="Primary">
            <PrimaryButton icon={<Plus size={13} />}>New Article</PrimaryButton>
            <PrimaryButton>Save</PrimaryButton>
            <PrimaryButton loading>Saving</PrimaryButton>
            <PrimaryButton disabled>Disabled</PrimaryButton>
          </Row>
          <Row label="Secondary">
            <SecondaryButton icon={<Download size={13} />}>Export</SecondaryButton>
            <SecondaryButton>Cancel</SecondaryButton>
          </Row>
          <Row label="Ghost / text">
            <GhostButton>Cancel</GhostButton>
            <GhostButton>See more</GhostButton>
          </Row>
          <Row label="Icon">
            <IconButton icon={<RefreshCw size={14} />} title="Refresh" />
            <IconButton icon={<Settings size={14} />} title="Settings" />
            <IconButton icon={<MoreHorizontal size={14} />} title="More" />
            <IconButton icon={<Edit3 size={14} />} title="Edit" />
          </Row>
          <Row label="Destructive">
            <DestructiveButton icon={<Trash2 size={13} />}>Delete</DestructiveButton>
          </Row>
          <Row label="Status pills">
            <StatusPill variant="draft">Draft</StatusPill>
            <StatusPill variant="active">Active</StatusPill>
            <StatusPill variant="archived">Archived</StatusPill>
            <StatusPill variant="success">Paid</StatusPill>
            <StatusPill variant="error">Failed</StatusPill>
          </Row>
        </Section>

        {/* ───────────── INPUTS ───────────── */}
        <Section id="inputs" title="Inputs" subtitle="Boxed for forms. Underline for toolbars. Pick one per surface.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim">Boxed (forms)</div>
              <div>
                <label className="text-ui-11 uppercase tracking-[1.2px] text-tea-text-sec mb-1.5 block">Workspace Name</label>
                <input
                  type="text"
                  placeholder="Teajia HQ"
                  className="w-full bg-tea-surface border border-tea-border rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none"
                />
                <div className="text-ui-12 text-tea-text-dim mt-1">Shown on receipts and emails.</div>
              </div>
              <div>
                <label className="text-ui-11 uppercase tracking-[1.2px] text-tea-text-sec mb-1.5 block">Email <span className="text-tea-error normal-case tracking-normal">(error)</span></label>
                <input
                  type="email"
                  defaultValue="not-an-email"
                  className="w-full bg-tea-surface border border-tea-error rounded-md px-3 py-2 text-ui-14 text-tea-text focus:ring-2 focus:ring-tea-error/30 focus:outline-none"
                />
                <div className="text-ui-12 text-tea-error mt-1">Please enter a valid email address.</div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim">Underline (toolbars)</div>
              <div className="flex items-center gap-2">
                <Search size={14} className="text-tea-text-dim" />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Search teas…"
                  className="flex-1 bg-transparent border-0 border-b border-tea-border rounded-none px-0 py-2 text-ui-14 font-serif text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:outline-none"
                />
              </div>
              <div className="text-ui-11 text-tea-text-dim italic mt-2">
                Use inside table headers, filter bars, anywhere a boxed input would feel heavy.
              </div>
            </div>
          </div>
        </Section>

        {/* ───────────── SURFACES ───────────── */}
        <Section id="cards" title="Surfaces" subtitle="Card and list row. Border carries the shape — no shadows on resting surfaces.">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim mb-2">Card</div>
              <div className="bg-tea-surface border border-tea-border rounded-xl p-4">
                <h3 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Hojicha Aki</h3>
                <div className={`${TYPOGRAPHY_CLASSES.subtitle} text-tea-text-sec`}>Kyoto · 2026 vintage</div>
                <div className="mt-3 space-y-2 text-ui-13 text-tea-text-sec">
                  <div className="flex justify-between"><span>Type</span><span className="text-tea-text">Roasted green</span></div>
                  <div className="flex justify-between"><span>Stock</span><span className="text-tea-text font-mono tabular-nums">142 g</span></div>
                  <div className="flex justify-between"><span>Cost</span><span className="text-tea-text font-mono tabular-nums">$24.00</span></div>
                </div>
                <div className="mt-4 flex justify-between gap-2">
                  <SecondaryButton>Cancel</SecondaryButton>
                  <PrimaryButton>Edit</PrimaryButton>
                </div>
              </div>
            </div>

            <div>
              <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim mb-2">List rows (divide-y)</div>
              <ul className="bg-tea-surface border border-tea-border rounded-xl divide-y divide-tea-border overflow-hidden">
                {SAMPLE_ROWS.map((row, i) => (
                  <li key={i}>
                    <button className="w-full text-left px-4 py-4 hover:bg-tea-accent-sub transition-colors flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-ui-15 text-tea-text">{row.title}</div>
                        <div className="text-ui-12 text-tea-text-dim mt-0.5">{row.meta}</div>
                      </div>
                      <StatusPill variant={row.status}>{row.status}</StatusPill>
                      <ChevronRight size={14} className="text-tea-text-dim flex-shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* ───────────── TABLES ───────────── */}
        <Section id="tables" title="Data table" subtitle="Real <table>, sticky <thead>, font-serif uppercase column headers, no zebra.">
          <div className="bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-tea-bg">
                <tr>
                  <th className="text-ui-10 uppercase tracking-wider font-serif text-tea-text-sec text-left px-4 py-3 border-b border-tea-border">Customer</th>
                  <th className="text-ui-10 uppercase tracking-wider font-serif text-tea-text-sec text-left px-4 py-3 border-b border-tea-border">Date</th>
                  <th className="text-ui-10 uppercase tracking-wider font-serif text-tea-text-sec text-right px-4 py-3 border-b border-tea-border">Amount</th>
                  <th className="text-ui-10 uppercase tracking-wider font-serif text-tea-text-sec text-left px-4 py-3 border-b border-tea-border">Status</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_TABLE.map((r, i) => (
                  <tr key={i} className="border-b border-tea-border last:border-b-0 hover:bg-tea-accent-sub transition-colors">
                    <td className="px-4 py-3 text-ui-14 text-tea-text">{r.name}</td>
                    <td className="px-4 py-3 text-ui-13 text-tea-text-sec">{r.date}</td>
                    <td className="px-4 py-3 text-ui-14 text-tea-text text-right font-mono tabular-nums">{r.amount}</td>
                    <td className="px-4 py-3">
                      <StatusPill variant={r.status === 'paid' ? 'success' : 'draft'}>{r.status}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ───────────── STATES ───────────── */}
        <Section id="states" title="Empty · loading · error" subtitle="Same layout shape. Tone changes by icon and copy.">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-tea-surface border border-tea-border rounded-xl p-6 flex flex-col items-center text-center">
              <Inbox size={28} strokeWidth={1.25} className="text-tea-text-dim" />
              <div className="text-sm text-tea-text mt-3">No collections yet</div>
              <div className="text-ui-12 text-tea-text-dim leading-relaxed mt-2 max-w-[24ch]">
                Start a collection to share teas with your network.
              </div>
              <div className="mt-4">
                <PrimaryButton icon={<Plus size={13} />}>New Collection</PrimaryButton>
              </div>
            </div>

            <div className="bg-tea-surface border border-tea-border rounded-xl p-6 flex flex-col items-center text-center">
              <Loader2 size={24} className="text-tea-gold animate-spin" />
              <div className="text-sm text-tea-text mt-3">Loading</div>
              <div className="text-ui-12 text-tea-text-dim leading-relaxed mt-2 max-w-[24ch]">
                Fetching the latest from the workshop.
              </div>
            </div>

            <div className="bg-tea-surface border border-tea-border rounded-xl p-6 flex flex-col items-center text-center">
              <AlertCircle size={28} strokeWidth={1.25} className="text-tea-error" />
              <div className="text-sm text-tea-text mt-3">Something went wrong</div>
              <div className="text-ui-12 text-tea-text-dim leading-relaxed mt-2 max-w-[24ch]">
                We couldn't reach the server. Check your connection and try again.
              </div>
              <div className="mt-4">
                <SecondaryButton>Try again</SecondaryButton>
              </div>
            </div>
          </div>
        </Section>

        {/* ───────────── MODAL ───────────── */}
        <Section id="modal" title="Modal" subtitle="Centered, rounded-xl, shadow-2xl. Cancel left, primary right.">
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 active:bg-tea-gold/80 transition-colors"
          >
            Open example modal
          </button>
          {modalOpen && (
            <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
              <button
                onClick={() => setModalOpen(false)}
                className="absolute inset-0 bg-tea-bg/70 backdrop-blur-sm"
                aria-label="Close modal"
              />
              <div className="relative bg-tea-surface border border-tea-border rounded-xl shadow-2xl w-full max-w-md">
                <button
                  onClick={() => setModalOpen(false)}
                  className="absolute top-4 right-4 p-1 text-tea-text-sec hover:text-tea-text transition-colors tap-target"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
                <div className="p-6">
                  <h3 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text mb-2`}>Discard changes?</h3>
                  <p className="text-ui-14 text-tea-text-sec">
                    You'll lose anything edited since the last save. This cannot be undone.
                  </p>
                </div>
                <div className="flex justify-between gap-2 px-6 py-4 border-t border-tea-border bg-tea-bg/40 rounded-b-xl">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="px-3 py-2 text-xs text-tea-text-sec hover:text-tea-text transition-colors"
                  >
                    Cancel
                  </button>
                  <DestructiveButton icon={<Trash2 size={13} />}>Discard</DestructiveButton>
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* ───────────── ICONS ───────────── */}
        <Section id="icons" title="Icons" subtitle="Lucide React, stroke 1.5. Sizes 14 inline · 16 small · 18 nav · 22 large.">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: BookOpen,  label: 'BookOpen' },
              { icon: Users,     label: 'Users' },
              { icon: Package,   label: 'Package' },
              { icon: Activity,  label: 'Activity' },
              { icon: Sparkles,  label: 'Sparkles' },
              { icon: Inbox,     label: 'Inbox' },
              { icon: Check,     label: 'Check' },
              { icon: AlertCircle, label: 'AlertCircle' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <Icon size={18} className="text-tea-text-sec" />
                <span className="text-ui-12 text-tea-text-dim font-mono">{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-end gap-6">
            <div className="flex flex-col items-center gap-1">
              <BookOpen size={14} className="text-tea-text" />
              <span className="text-ui-10 text-tea-text-dim">14</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <BookOpen size={16} className="text-tea-text" />
              <span className="text-ui-10 text-tea-text-dim">16</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <BookOpen size={18} className="text-tea-text" />
              <span className="text-ui-10 text-tea-text-dim">18</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <BookOpen size={22} className="text-tea-text" />
              <span className="text-ui-10 text-tea-text-dim">22</span>
            </div>
          </div>
        </Section>

        {/* ───────────── SPACING ───────────── */}
        <Section id="spacing" title="Spacing scale" subtitle="Tailwind scale only. No inline pixel margins.">
          <div className="space-y-3">
            {[
              { name: 'gap-1',  px: 4,  use: 'inside tight pill groups' },
              { name: 'gap-2',  px: 8,  use: 'icon + label inside buttons' },
              { name: 'gap-3',  px: 12, use: 'form rows; card internal sections' },
              { name: 'gap-4',  px: 16, use: 'card → card in a stack' },
              { name: 'gap-6',  px: 24, use: 'section → section' },
              { name: 'gap-8',  px: 32, use: 'major section → major section' },
            ].map(s => (
              <div key={s.name} className="flex items-center gap-4">
                <div className="w-24 text-ui-11 font-mono text-tea-text-sec">{s.name}</div>
                <div className="bg-tea-gold/40 rounded-sm" style={{ width: s.px, height: 16 }} />
                <div className="text-ui-11 text-tea-text-dim flex-1">{s.use}</div>
                <div className="text-ui-11 font-mono text-tea-text-dim">{s.px}px</div>
              </div>
            ))}
          </div>
        </Section>

        {/* ───────────── AVOID ───────────── */}
        <Section id="avoid" title="Anti-patterns — do not do this" subtitle="Common drift, side-by-side with the canonical version.">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-tea-surface border border-tea-green/30 rounded-xl p-4">
                <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-green mb-3">✓ Canonical primary button</div>
                <PrimaryButton icon={<Plus size={13} />}>New Article</PrimaryButton>
              </div>
              <div className="bg-tea-surface border border-tea-error/30 rounded-xl p-4 relative">
                <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-error mb-3">✗ Uppercase tracking on action</div>
                <button className="inline-flex items-center gap-2 bg-tea-gold text-tea-bg px-5 py-2.5 text-xs font-bold uppercase tracking-[0.2em] rounded-lg">
                  <Plus size={13} /> New Article
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-tea-surface border border-tea-green/30 rounded-xl p-4">
                <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-green mb-3">✓ Bottom-border underline tab</div>
                <div className="flex items-center gap-6 border-b border-tea-border">
                  <span className="py-2.5 text-ui-12 uppercase tracking-[0.15em] text-tea-text border-b border-tea-gold">All</span>
                  <span className="py-2.5 text-ui-12 uppercase tracking-[0.15em] text-tea-text-sec border-b border-transparent">Drafts</span>
                </div>
              </div>
              <div className="bg-tea-surface border border-tea-error/30 rounded-xl p-4">
                <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-error mb-3">✗ Segmented pill (macOS idiom)</div>
                <div className="inline-flex items-center gap-0.5 bg-tea-surface rounded-lg border border-tea-border p-0.5">
                  <span className="px-3 py-1 text-ui-11 rounded-md bg-tea-bg text-tea-text shadow-sm">All</span>
                  <span className="px-3 py-1 text-ui-11 rounded-md text-tea-text-sec">Drafts</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-tea-surface border border-tea-green/30 rounded-xl p-4">
                <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-green mb-3">✓ Page title with subtitle</div>
                <h3 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>Collections</h3>
                <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-dim mt-1">ALL · 12 COLLECTIONS</div>
              </div>
              <div className="bg-tea-surface border border-tea-error/30 rounded-xl p-4">
                <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-error mb-3">✗ Toolbar-style title (too small for a page)</div>
                <h3 className="text-sm font-semibold text-tea-text tracking-wide">Collections</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-tea-surface border border-tea-green/30 rounded-xl p-4">
                <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-green mb-3">✓ Cancel left, primary right</div>
                <div className="flex justify-between gap-2">
                  <button className="px-3 py-2 text-xs text-tea-text-sec hover:text-tea-text">Cancel</button>
                  <PrimaryButton>Save</PrimaryButton>
                </div>
              </div>
              <div className="bg-tea-surface border border-tea-error/30 rounded-xl p-4">
                <div className="text-ui-11 uppercase tracking-[0.15em] text-tea-error mb-3">✗ Cancel buried to the right</div>
                <div className="flex justify-end gap-2">
                  <PrimaryButton>Save</PrimaryButton>
                  <button className="px-3 py-2 text-xs text-tea-text-sec hover:text-tea-text">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <footer className="pt-8 border-t border-tea-border text-ui-11 text-tea-text-dim italic">
          See <a href="/docs/DESIGN_SYSTEM.md" className="text-tea-gold hover:underline">docs/DESIGN_SYSTEM.md</a> for the full spec. Every component on this page is the canonical implementation — copy from here, do not reinvent.
        </footer>
      </main>
    </div>
  );
}
