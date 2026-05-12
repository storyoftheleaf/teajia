import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  ArrowLeft, ArrowRight,
  X, Check, Plus, Search, Filter, Settings as SettingsIcon, RefreshCw,
  Loader2, AlertCircle, Info, Upload, Edit3,
  Bold, Italic, Underline, Link as LinkIcon, Quote, List as ListIcon,
  Heading1, Heading2, Image as ImageIcon, Calendar, Trash2, MoreHorizontal,
  Package, BookOpen, Users, User as UserIcon, Coffee, FileText, Mail, Tag,
  Eye, EyeOff, Bell, Star, Home, Compass, ShoppingBag, GraduationCap, Mic,
  Send, QrCode, Sparkles, Globe, Phone, ListChecks, Leaf, Sun, Moon,
  TrendingUp, Circle, Square as SquareIcon, CheckCircle2,
  ScrollText, History, Archive, PanelRight, ExternalLink, Menu, Copy,
  Share2, Download, Heart,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────
// Constants — color tokens, type samples, scales, navigation, accents
// ─────────────────────────────────────────────────────────────────────────

const DARK_TOKENS: [string, string, string][] = [
  ['--tea-bg', '#18130e', 'Page background — rich espresso'],
  ['--tea-surface', '#28211a', 'Cards, panels, table surfaces'],
  ['--tea-elevated', '#3a3126', 'Popovers, modal interior, hover lifts'],
  ['--tea-text', '#ede4d4', 'Primary text — cream white'],
  ['--tea-text-sec', '#cdc0a8', 'Secondary text — raised floor for legibility'],
  ['--tea-text-dim', '#80735f', 'Eyebrow labels, helper, meta'],
  ['--tea-gold', '#a8874d', 'Structural accent — buttons, active, focus rings'],
  ['--tea-gold-lt', '#bfa06a', 'Hover only'],
  ['--tea-readgold', '#a8874d', 'Reading gold — pinned for text'],
  ['--tea-border', 'rgba(168,135,77,0.08)', 'Divider lines'],
  ['--tea-accent-sub', 'rgba(168,135,77,0.10)', 'Pill bg, focus glow'],
  ['--tea-green', '#5a6e5a', 'Success only — never decorative'],
  ['--tea-error', '#c46a5a', 'Warm terracotta — reads on espresso'],
];

const LIGHT_TOKENS: [string, string, string][] = [
  ['--tea-bg', '#f4ece0', 'Page background — warm parchment'],
  ['--tea-surface', '#e4ddd3', 'Cards, panels, table surfaces'],
  ['--tea-elevated', '#d5c8b4', 'Popovers, modal interior'],
  ['--tea-text', '#18130e', 'Primary text'],
  ['--tea-text-sec', '#443a2c', 'Secondary text — raised floor'],
  ['--tea-text-dim', '#9a8c78', 'Eyebrow labels, helper, meta'],
  ['--tea-gold', '#6b4f28', 'Structural accent'],
  ['--tea-gold-lt', '#7a5c2e', 'Hover only'],
  ['--tea-readgold', '#8e6d2e', 'Reading gold'],
  ['--tea-border', 'rgba(107,82,44,0.20)', 'Divider lines'],
  ['--tea-green', '#4a5e4a', 'Success only'],
  ['--tea-error', '#732a23', 'Muted oxblood (works on parchment)'],
];

type TypeSample = { name: string; spec: string; use: string; sample: React.ReactNode };

const TYPE_SAMPLES: TypeSample[] = [
  { name: 'h1', spec: 'Cormorant Garamond 300 · clamp(32→48) · lh 1.12 · tracking 0.01em', use: 'Hero / landing only — one per page max', sample: <span className="h1">The Quiet Roast</span> },
  { name: 'h2', spec: 'Cormorant Garamond 500 · clamp(24→32) · lh 1.2 · tracking 0.01em', use: 'Page titles — canonical', sample: <span className="h2">Inventory</span> },
  { name: 'h3', spec: 'Cormorant Garamond 400 · 19px · lh 1.3', use: 'Section / card titles', sample: <span className="h3">Spring 2026 Roast</span> },
  { name: 'subtitle', spec: 'Lora 400 italic · 17px · lh 1.4', use: 'Page subtitles when descriptive', sample: <span className="subtitle">Aki hojicha · 2026 vintage</span> },
  { name: 'body', spec: 'Lora 400 · 17px · lh 1.7', use: 'Article prose', sample: <span className="body-prose">The leaves are roasted slowly in iron pans set over banked oak coals, and the room takes on the smell of autumn weeks before harvest.</span> },
  { name: 'bodyLight', spec: 'Lora 300 · 15px · lh 1.65', use: 'Captions, secondary descriptions', sample: <span className="body-light">A small-batch roast hand-finished at the kiln in Kyoto.</span> },
  { name: 'label', spec: 'Plus Jakarta Sans 400 · 11px · uppercase · tracking 1.2px', use: 'Eyebrow labels, status pills, metadata', sample: <span className="label-caps">ALL CONTACTS · 142 PEOPLE</span> },
  { name: 'nav', spec: 'Plus Jakarta Sans 400 · 12px · uppercase · tracking 1px', use: 'Section markers', sample: <span className="nav-caps">PUBLISHED</span> },
  { name: 'link', spec: 'Plus Jakarta Sans 400 · 14px · tracking 0.2px', use: 'Inline link / button text', sample: <a href="#tokens" className="link-text hover:opacity-80">Read more</a> },
  { name: 'mono', spec: 'Plus Jakarta Sans 500 · 11px · tabular-nums', use: 'Prices, weights, ledger numbers', sample: <span className="font-mono text-ui-13 tabular-nums" style={{ color: 'rgb(var(--tea-text-rgb) / 0.85)' }}>$24.00 · 50g · INV-0042</span> },
  { name: 'navSidebar', spec: 'Cormorant Garamond 500 · 17px · tracking 0.04em', use: 'Sidebar primary nav', sample: <span className="nav-sidebar" style={{ color: 'rgb(var(--tea-text-rgb))' }}>Inventory</span> },
  { name: 'navSidebarChild', spec: 'Cormorant Garamond 400 · 15px · tracking 0.04em', use: 'Sidebar secondary nav', sample: <span className="nav-sidebar-child">Collections</span> },
];

const UI_SCALE: [string, string, string][] = [
  ['text-ui-8', '8px', 'Inline timestamp glyphs'],
  ['text-ui-9', '9px', 'Status pill caps'],
  ['text-ui-10', '10px', 'Column headers, eyebrow tags'],
  ['text-ui-11', '11px', 'Eyebrow labels, meta'],
  ['text-ui-12', '12px', 'Tabs, helper text, table caps'],
  ['text-ui-13', '13px', 'Compact body, list meta'],
  ['text-ui-14', '14px', 'Default UI body, inputs'],
  ['text-ui-15', '15px', 'Sidebar primary nav'],
  ['text-ui-16', '16px', 'Reader-density UI body'],
  ['text-ui-17', '17px', 'Lora body baseline'],
  ['text-ui-20', '20px', 'Heading-density UI'],
  ['text-ui-26', '26px', 'Numeric callouts'],
  ['text-ui-28', '28px', 'Hub identity numerics'],
];

const TRACKING_SCALE: [string, string, string][] = [
  ['tight', '-0.01em', 'Optical tightening on large display'],
  ['normal', '0', 'Body default'],
  ['wide', '0.01em', 'Headings'],
  ['wider', '0.04em', 'Sidebar nav'],
  ['widest', '0.10em', 'Loose uppercase labels'],
  ['caps', '0.15em', 'Eyebrow labels — canonical'],
  ['display', '0.20em', 'Spaced caps for editorial display'],
];

const GAP_SCALE: [string, number, string][] = [
  ['gap-1', 4, 'Inside tight pill groups'],
  ['gap-2', 8, 'Icon + label inside buttons; chip rows'],
  ['gap-3', 12, 'Form rows; card internal sections'],
  ['gap-4', 16, 'Card → card in a stack'],
  ['gap-5', 20, '(uncommon — favor 4 or 6)'],
  ['gap-6', 24, 'Section → section'],
  ['gap-8', 32, 'Major section → major section'],
];

const Z_TOKENS: [string, number, string][] = [
  ['z-base', 0, 'Normal flow'],
  ['z-dropdown', 10, 'Section sticky, in-content dropdowns'],
  ['z-sticky', 20, 'Sticky headers, sticky thead, mobile tab bar'],
  ['z-overlay', 30, 'Backdrop dim'],
  ['z-drawer', 35, 'Side drawers'],
  ['z-modal', 40, 'Modals'],
  ['z-popover', 45, 'Popovers / dropdowns inside chrome'],
  ['z-toast', 50, 'Toasts'],
  ['z-priority', 60, 'Skip links, accessibility'],
  ['z-panel-backdrop', 65, 'Account-style panel backdrop'],
  ['z-panel-modal', 70, 'Account-style panel content'],
  ['z-nav', 75, 'Reserved — skip nav'],
];

const SECTIONS = [
  { id: 'sec-overview', num: '01', label: 'Overview' },
  { id: 'sec-colors', num: '02', label: 'Color' },
  { id: 'sec-typography', num: '03', label: 'Type' },
  { id: 'sec-spacing', num: '04', label: 'Spacing' },
  { id: 'sec-chrome', num: '05', label: 'Chrome' },
  { id: 'sec-tabs', num: '06', label: 'Tabs' },
  { id: 'sec-buttons', num: '07', label: 'Buttons' },
  { id: 'sec-pills', num: '08', label: 'Pills' },
  { id: 'sec-surfaces', num: '08', label: 'Surfaces' },
  { id: 'sec-zindex', num: '09', label: 'Z-index' },
  { id: 'sec-states', num: '10', label: 'States' },
  { id: 'sec-elevation', num: '11', label: 'Elevation' },
  { id: 'sec-forms', num: '12', label: 'Forms' },
  { id: 'sec-modal', num: '13', label: 'Modal' },
  { id: 'sec-nav', num: '14', label: 'Nav' },
  { id: 'sec-icons', num: '15', label: 'Icons' },
  { id: 'sec-animation', num: '16', label: 'Motion' },
  { id: 'sec-empty', num: '17', label: 'Empty' },
  { id: 'sec-identity', num: '19', label: 'Identity' },
  { id: 'sec-teacard', num: '20', label: 'Tea card' },
  { id: 'sec-inventory', num: '20', label: 'Inventory' },
  { id: 'sec-order', num: '21', label: 'Order' },
  { id: 'sec-anti', num: '22', label: 'Anti-patterns' },
];

const ACCENT_OPTIONS = [
  { label: 'Aged brass', rgb: '142 104 60', lt: '170 132 84' },
  { label: 'Gold (original)', rgb: '168 135 77', lt: '191 160 106' },
  { label: 'Deep moss', rgb: '108 124 92', lt: '136 152 116' },
  { label: 'Burnt copper', rgb: '168 96 64', lt: '196 122 86' },
  { label: 'Dusty indigo', rgb: '96 110 138', lt: '128 142 170' },
  { label: 'Aubergine', rgb: '128 86 102', lt: '160 116 132' },
];

// ─────────────────────────────────────────────────────────────────────────
// Shared section + helper components
// ─────────────────────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ num: string; eyebrow: string; title: string; lede?: string }> = ({ num, eyebrow, title, lede }) => (
  <header className="mb-8 max-w-3xl">
    <div className="flex items-baseline gap-3">
      <span className="font-mono text-ui-11 text-tea-text-dim tabular-nums">§{num}</span>
      <div className="label-caps">{eyebrow}</div>
    </div>
    <h2 className="h2 mt-2">{title}</h2>
    {lede && <p className="subtitle mt-2">{lede}</p>}
  </header>
);

const SubHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="h3 mt-10 mb-4 first:mt-0">{children}</h3>
);

const Demo: React.FC<{
  caption?: React.ReactNode;
  children: React.ReactNode;
  label?: React.ReactNode;
  banned?: boolean;
}> = ({ caption, children, label, banned }) => (
  <figure className={`relative bg-tea-surface border ${banned ? 'border-tea-error/50' : 'border-tea-border'} rounded-xl overflow-hidden`}>
    {label && (
      <figcaption className={`flex items-center justify-between gap-3 px-4 py-2 border-b border-tea-border ${banned ? 'bg-tea-error/5' : ''}`}>
        <span className={`label-caps ${banned ? 'text-tea-error' : ''}`}>
          {banned ? '✗ Avoid · ' : ''}{label}
        </span>
        {caption && <span className="text-ui-11 text-tea-text-dim">{caption}</span>}
      </figcaption>
    )}
    <div className="p-5">{children}</div>
  </figure>
);

// ─────────────────────────────────────────────────────────────────────────
// Button primitives
// ─────────────────────────────────────────────────────────────────────────

const PrimaryButton: React.FC<{ children: React.ReactNode; loading?: boolean; disabled?: boolean; onClick?: () => void; icon?: React.ComponentType<{ size?: number }> | null }> = ({ children, loading, disabled, onClick, icon: IconCmp = Plus }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 active:bg-tea-gold/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-tea-bg"
  >
    {loading ? <Loader2 size={13} className="animate-spin" /> : (IconCmp ? <IconCmp size={13} /> : null)}
    <span>{children}</span>
  </button>
);

const SecondaryButton: React.FC<{ children: React.ReactNode; icon?: React.ComponentType<{ size?: number }>; onClick?: () => void; disabled?: boolean }> = ({ children, icon: IconCmp, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
  >
    {IconCmp && <IconCmp size={13} />}
    <span className="text-xs">{children}</span>
  </button>
);

const GhostButton: React.FC<{ children: React.ReactNode; onClick?: () => void }> = ({ children, onClick }) => (
  <button
    onClick={onClick}
    className="px-2 py-1 text-xs text-tea-text-sec hover:text-tea-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 rounded-md"
  >
    {children}
  </button>
);

const IconButton: React.FC<{ icon: React.ComponentType<{ size?: number }>; label: string; dim?: boolean; onClick?: () => void; size?: number }> = ({ icon: IconCmp, label, dim = true, onClick, size = 16 }) => (
  <button
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`tap-target p-1.5 rounded-md ${dim ? 'text-tea-text-dim hover:text-tea-text-sec' : 'text-tea-text-sec hover:text-tea-text'} transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50`}
  >
    <IconCmp size={size} />
  </button>
);

const DestructiveButton: React.FC<{ children: React.ReactNode; onClick?: () => void }> = ({ children, onClick }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-error text-tea-bg text-xs font-semibold hover:bg-tea-error/90 active:bg-tea-error/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-error/50"
  >
    <Trash2 size={13} />
    <span>{children}</span>
  </button>
);

type StatusVariant = 'draft' | 'active' | 'archived' | 'success' | 'error';
const STATUS_PILL_VARIANTS: Record<StatusVariant, string> = {
  draft: 'bg-tea-elevated text-tea-text-sec',
  active: 'bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40',
  archived: 'bg-tea-elevated text-tea-text-dim',
  success: 'bg-tea-green/10 text-tea-green ring-1 ring-inset ring-tea-green/40',
  error: 'bg-tea-error/10 text-tea-error ring-1 ring-inset ring-tea-error/40',
};

const StatusPill: React.FC<{ variant?: StatusVariant; children: React.ReactNode }> = ({ variant = 'draft', children }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-ui-9 uppercase font-sans tracking-caps ${STATUS_PILL_VARIANTS[variant]}`}>
    {children}
  </span>
);

// ─────────────────────────────────────────────────────────────────────────
// §1 Overview
// ─────────────────────────────────────────────────────────────────────────

function Overview() {
  return (
    <section id="sec-overview" className="mb-24 scroll-mt-24">
      <div className="mb-10">
        <div className="label-caps mb-3">Teajia · Editorial commerce</div>
        <h1 className="h1" style={{ textWrap: 'pretty' } as React.CSSProperties}>The design language</h1>
        <p className="subtitle mt-3 max-w-2xl">
          A small-batch tea editorial &amp; commerce surface. Warm tones, serif headings, mono numerics, line icons. No scale lifts; no glass; no emoji.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { eb: 'Mood', t: 'Editorial · warm · still', body: 'A printed page, not a button-heavy app. Borders carry shape; surfaces do not lift.' },
          { eb: 'Type', t: 'Serif heads · Lora body · Mono numerics', body: 'Cormorant Garamond, Lora, Plus Jakarta Sans (rebound as mono with tabular-nums). No exceptions per component.' },
          { eb: 'Color', t: 'Espresso · cream · bronze', body: 'Two modes share semantic names. Bright reds, hot blues, neon accents are banned.' },
        ].map((b) => (
          <div key={b.t} className="bg-tea-surface border border-tea-border rounded-xl p-5">
            <div className="label-caps text-tea-text-dim">{b.eb}</div>
            <h3 className="h3 mt-1.5">{b.t}</h3>
            <p className="text-ui-13 text-tea-text-sec mt-2 leading-relaxed">{b.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['12+', 'Token sections'],
          ['22', 'Components catalogued'],
          ['2', 'Modes — dark & light'],
          ['1', 'Visual language'],
        ].map(([n, l]) => (
          <div key={l} className="bg-tea-surface border border-tea-border rounded-xl px-4 py-4">
            <div className="font-mono text-ui-28 text-tea-text tabular-nums">{n}</div>
            <div className="label-caps text-tea-text-dim mt-1.5">{l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §2 Colors
// ─────────────────────────────────────────────────────────────────────────

const Swatch: React.FC<{ token: string; hex: string; role: string; isDark: boolean }> = ({ token, hex, role, isDark }) => {
  const isAlpha = hex.startsWith('rgba');
  const checker = isDark ? '#28211a' : '#e6dbcc';
  return (
    <li className="flex items-stretch gap-4 py-3 first:pt-0 last:pb-0 border-b border-tea-border last:border-b-0">
      <div
        className="h-14 w-14 rounded-md flex-shrink-0 border border-tea-border"
        style={{
          background: hex,
          backgroundImage: isAlpha
            ? `linear-gradient(45deg, ${checker} 25%, transparent 25%, transparent 75%, ${checker} 75%), linear-gradient(45deg, ${checker} 25%, transparent 25%, transparent 75%, ${checker} 75%), ${hex}`
            : undefined,
          backgroundSize: isAlpha ? '8px 8px, 8px 8px, auto' : undefined,
          backgroundPosition: isAlpha ? '0 0, 4px 4px, 0 0' : undefined,
        }}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-x-3 gap-y-0.5 flex-wrap">
          <code className="font-mono text-ui-13 text-tea-readgold whitespace-nowrap">{token}</code>
          <span className="font-mono text-ui-11 text-tea-text-dim tabular-nums whitespace-nowrap">{hex}</span>
        </div>
        <p className="text-ui-12 text-tea-text-sec mt-1 break-words">{role}</p>
      </div>
    </li>
  );
};

function ColorsSection() {
  return (
    <section id="sec-colors" className="mb-20 scroll-mt-24">
      <SectionHeader num="2" eyebrow="Color · Tokens" title="Color tokens" lede="Components reference the semantic name, not the hex. Modes share the same names — values switch." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-caps text-tea-text-dim">Mode · Default</div>
              <div className="h3 mt-1">Dark — espresso</div>
            </div>
            <div className="flex items-center gap-1.5 text-tea-text-sec">
              <Moon size={14} />
              <span className="text-ui-12">dark</span>
            </div>
          </div>
          <ul>
            {DARK_TOKENS.map((t) => <Swatch key={t[0]} token={t[0]} hex={t[1]} role={t[2]} isDark />)}
          </ul>
        </div>

        <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-caps text-tea-text-dim">Mode · Companion</div>
              <div className="h3 mt-1">Light — parchment</div>
            </div>
            <div className="flex items-center gap-1.5 text-tea-text-sec">
              <Sun size={14} />
              <span className="text-ui-12">light</span>
            </div>
          </div>
          <ul>
            {LIGHT_TOKENS.map((t) => <Swatch key={t[0]} token={t[0]} hex={t[1]} role={t[2]} isDark={false} />)}
          </ul>
        </div>
      </div>

      <div className="mt-8 bg-tea-surface border border-tea-border rounded-xl p-5">
        <SubHeader>Allowed opacity modifiers</SubHeader>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-ui-13">
          {[
            { ok: true, code: 'bg-tea-gold/5 · /6 · /8 · /10 · /15', note: 'Hover, active rows' },
            { ok: true, code: 'border-tea-gold/40 · /60', note: 'Focus rings, active pills' },
            { ok: false, code: 'text-tea-text-sec/40', note: 'Banned — use the token' },
            { ok: false, code: 'border-tea-border/50', note: 'Banned — already low-alpha' },
          ].map((r) => (
            <li key={r.code} className="flex items-center justify-between gap-3 py-2 px-3 bg-tea-bg rounded-md">
              <code className={`font-mono text-ui-12 ${r.ok ? 'text-tea-text' : 'text-tea-error line-through opacity-70'}`}>{r.code}</code>
              <span className={`text-ui-12 ${r.ok ? 'text-tea-text-dim' : 'text-tea-error'}`}>{r.note}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 bg-tea-surface border border-tea-border rounded-xl p-5">
        <SubHeader>tea-gold vs tea-readgold</SubHeader>
        <p className="text-ui-13 text-tea-text-sec mb-4 max-w-2xl">
          The split exists so structural accent (<code className="font-mono text-tea-readgold">tea-gold</code>) can shift toward aged brass without dragging readable text into illegibility.
          Reference the <em>role</em>, not the hex.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="label-caps text-tea-text-dim mb-2">Use tea-gold for (structural)</div>
            <ul className="space-y-1.5 text-ui-13 text-tea-text-sec">
              {['Primary button fills', 'Active borders / focus rings', 'Status pill rings', 'Sidebar gold left-bar', 'Dot accents on active rows'].map((x) => (
                <li key={x} className="flex gap-2"><span className="text-tea-gold">·</span> {x}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="label-caps text-tea-text-dim mb-2">Use tea-readgold for (text)</div>
            <ul className="space-y-1.5 text-ui-13 text-tea-text-sec">
              {['Type token names in code blocks', 'Inline <code> accent', 'Hover state on inline links', 'Eyebrow § markers', 'Anywhere gold is read as text'].map((x) => (
                <li key={x} className="flex gap-2"><span className="text-tea-readgold">·</span> {x}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §3 Typography
// ─────────────────────────────────────────────────────────────────────────

const TypeRow: React.FC<TypeSample> = ({ name, spec, use, sample }) => (
  <li className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3 md:gap-6 py-5 border-b border-tea-border last:border-b-0">
    <div className="min-w-0">
      <code className="font-mono text-ui-14 text-tea-readgold">{name}</code>
      <p className="font-sans text-ui-13 text-tea-text-sec mt-1.5 leading-snug">{spec}</p>
      <p className="font-sans text-ui-13 text-tea-text mt-1 leading-snug">{use}</p>
    </div>
    <div className="flex items-center min-h-[40px]">{sample}</div>
  </li>
);

function TypographySection() {
  return (
    <section id="sec-typography" className="mb-20 scroll-mt-24">
      <SectionHeader num="3" eyebrow="Type · Scale" title="Typography" lede="One typography system. Display Cormorant for headings, Lora for prose, Plus Jakarta for UI and numerics. No exceptions per component." />

      <div className="bg-tea-surface border border-tea-border rounded-xl p-6">
        <SubHeader>Named patterns</SubHeader>
        <ul>{TYPE_SAMPLES.map((t) => <TypeRow key={t.name} {...t} />)}</ul>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-tea-surface border border-tea-border rounded-xl p-6">
          <SubHeader>UI pixel scale</SubHeader>
          <p className="text-ui-12 text-tea-text-dim mb-4">
            Use these for UI text outside the named patterns. Never write{' '}
            <code className="font-mono text-tea-error">text-[12px]</code>.
          </p>
          <ul className="space-y-2">
            {UI_SCALE.map(([cls, px, use]) => (
              <li key={cls} className="flex items-baseline gap-4 py-2 border-b border-tea-border last:border-b-0">
                <code className="font-mono text-ui-12 text-tea-readgold w-28 flex-shrink-0">{cls}</code>
                <span className={`text-tea-text ${cls} flex-shrink-0 w-12 tabular-nums`}>Aa</span>
                <span className="font-mono text-ui-11 text-tea-text-dim w-12 tabular-nums">{px}</span>
                <span className="text-ui-11 text-tea-text-sec flex-1 truncate">{use}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-tea-surface border border-tea-border rounded-xl p-6">
          <SubHeader>Letter-spacing</SubHeader>
          <p className="text-ui-12 text-tea-text-dim mb-4">Seven steps. The same word at each stop, in eyebrow caps so the rhythm is legible.</p>
          <ul className="space-y-3">
            {TRACKING_SCALE.map(([name, val, use]) => (
              <li key={name} className="py-3 border-b border-tea-border last:border-b-0">
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <code className="font-mono text-ui-12 text-tea-readgold">{name}</code>
                  <span className="font-mono text-ui-11 text-tea-text-dim tabular-nums">{val}</span>
                </div>
                <div className="font-sans text-ui-12 uppercase text-tea-text-sec" style={{ letterSpacing: val }}>
                  TEAJIA EDITORIAL
                </div>
                <p className="text-ui-11 text-tea-text-dim mt-1">{use}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-tea-surface border border-tea-border rounded-xl p-6 mt-6">
        <SubHeader>Chinese counterpart</SubHeader>
        <div className="flex items-baseline flex-wrap gap-x-8 gap-y-3">
          {[200, 400, 700].map((w) => (
            <div key={w}>
              <div className="label-caps text-tea-text-dim mb-1">Noto Serif SC {w}</div>
              <div className="text-ui-28 text-tea-text" style={{ fontFamily: '"Noto Serif SC", serif', fontWeight: w }}>焙茶 · 秋</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §4 Spacing
// ─────────────────────────────────────────────────────────────────────────

const GapBar: React.FC<{ name: string; px: number; use: string }> = ({ name, px, use }) => (
  <li className="grid grid-cols-[80px_1fr_140px] items-center gap-4 py-3 border-b border-tea-border last:border-b-0">
    <code className="font-mono text-ui-12 text-tea-readgold">{name}</code>
    <div className="flex items-center gap-2">
      <div className="h-2 rounded-full bg-tea-gold" style={{ width: `${px * 3}px` }} aria-hidden="true" />
      <span className="font-mono text-ui-11 text-tea-text-dim tabular-nums">{px}px</span>
    </div>
    <span className="text-ui-12 text-tea-text-sec">{use}</span>
  </li>
);

function SpacingSection() {
  return (
    <section id="sec-spacing" className="mb-20 scroll-mt-24">
      <SectionHeader num="4" eyebrow="Rhythm · Spacing" title="Spacing scale" lede="The Tailwind scale, used purposefully. No inline pixel margins." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-tea-surface border border-tea-border rounded-xl p-6">
          <SubHeader>Gap scale</SubHeader>
          <ul>{GAP_SCALE.map(([n, p, u]) => <GapBar key={n} name={n} px={p} use={u} />)}</ul>
        </div>

        <div className="bg-tea-surface border border-tea-border rounded-xl p-6">
          <SubHeader>Vertical stack</SubHeader>
          <ul className="space-y-3">
            {[
              ['space-y-3', 'Form fields'],
              ['space-y-4', 'List of cards'],
              ['space-y-6', 'Page sections (narrow)'],
              ['space-y-6 md:space-y-8', 'Page sections (wide)'],
            ].map(([cls, use]) => (
              <li key={cls} className="flex items-center justify-between gap-3 py-2 border-b border-tea-border last:border-b-0">
                <code className="font-mono text-ui-12 text-tea-readgold">{cls}</code>
                <span className="text-ui-12 text-tea-text-sec">{use}</span>
              </li>
            ))}
          </ul>

          <SubHeader>Container padding</SubHeader>
          <ul className="space-y-3">
            {[
              ['Card', 'p-4 (default), p-5 (feature), p-6 (modal)'],
              ['List row', 'py-4 px-4 md:px-6'],
              ['Table cell', 'py-3 px-4'],
            ].map(([surface, pad]) => (
              <li key={surface} className="flex items-center justify-between gap-3 py-2 border-b border-tea-border last:border-b-0">
                <span className="text-ui-13 text-tea-text">{surface}</span>
                <code className="font-mono text-ui-11 text-tea-text-sec">{pad}</code>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §5 Page chrome
// ─────────────────────────────────────────────────────────────────────────

function PageChromeSection() {
  return (
    <section id="sec-chrome" className="mb-20 scroll-mt-24">
      <SectionHeader num="5" eyebrow="Layout · Chrome" title="Page chrome" lede="Two canonical shapes. Pick by page type. The chrome holds still; the body varies." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Demo label="Wide working surface · sticky" caption="px-4 md:px-6 lg:px-10 · h-16 · max-w-7xl">
          <div className="rounded-lg border border-tea-border overflow-hidden bg-tea-bg">
            <div className="h-16 px-5 bg-tea-bg/90 backdrop-blur-md border-b border-tea-border flex items-center justify-between">
              <div>
                <div className="h3">Inventory</div>
                <div className="label-caps text-tea-text-dim mt-0.5">ALL PRODUCTS · 142</div>
              </div>
              <div className="flex items-center gap-1">
                <IconButton icon={Search} label="Search" />
                <IconButton icon={Filter} label="Filter" />
                <PrimaryButton>New product</PrimaryButton>
              </div>
            </div>
            <div className="px-5 py-6 text-ui-12 text-tea-text-dim">· table or grid lives here ·</div>
          </div>
        </Demo>

        <Demo label="Narrow form · non-sticky" caption="px-4 md:px-6 · max-w-3xl">
          <div className="rounded-lg border border-tea-border overflow-hidden bg-tea-bg">
            <div className="px-5 pt-5 pb-3">
              <div className="h3">Settings</div>
              <div className="label-caps text-tea-text-dim mt-0.5">ACCOUNT · WORKSPACE</div>
            </div>
            <div className="border-b border-tea-border" />
            <div className="px-5 py-6 text-ui-12 text-tea-text-dim">· narrow single-column form lives here ·</div>
          </div>
        </Demo>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §6 Tab strip
// ─────────────────────────────────────────────────────────────────────────

const TabStrip: React.FC<{ tabs: string[]; active: string; onChange: (t: string) => void; dense?: boolean }> = ({ tabs, active, onChange, dense = false }) => (
  <div className={`flex items-center gap-6 border-b border-tea-border ${dense ? 'px-3' : 'px-5'} overflow-x-auto scrollbar-hide`}>
    {tabs.map((t) => {
      const isActive = t === active;
      return (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`whitespace-nowrap py-2.5 text-ui-12 uppercase tracking-caps font-sans border-b transition-colors ${
            isActive ? 'text-tea-text border-tea-gold' : 'text-tea-text-sec hover:text-tea-text border-transparent'
          }`}
        >
          {t}
        </button>
      );
    })}
  </div>
);

function TabStripSection() {
  const [active, setActive] = useState('Published');
  return (
    <section id="sec-tabs" className="mb-20 scroll-mt-24">
      <SectionHeader num="6" eyebrow="Navigation · Tabs" title="Tab strips" lede="One canonical pattern: bottom-border underline. The segmented pill is banned." />

      <div className="space-y-6">
        <Demo label="Canonical · underline tabs (interactive)">
          <TabStrip tabs={['All', 'Drafts (3)', 'Published', 'Archived']} active={active} onChange={setActive} />
          <div className="pt-5 pb-1 text-ui-12 text-tea-text-dim">
            Active tab: <span className="text-tea-text">{active}</span> — click any tab to switch.
          </div>
        </Demo>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Demo label="Inactive">
            <div className="flex items-center gap-6 border-b border-tea-border pb-2.5">
              <span className="text-ui-12 uppercase tracking-caps font-sans text-tea-text-sec">Drafts</span>
            </div>
          </Demo>
          <Demo label="Hover">
            <div className="flex items-center gap-6 border-b border-tea-border pb-2.5">
              <span className="text-ui-12 uppercase tracking-caps font-sans text-tea-text">Drafts</span>
            </div>
          </Demo>
          <Demo label="Active">
            <div className="flex items-center gap-6 border-b border-tea-gold pb-2.5">
              <span className="text-ui-12 uppercase tracking-caps font-sans text-tea-text">Drafts</span>
            </div>
          </Demo>
        </div>

        <Demo banned label="The segmented pill" caption="OS-control aesthetic — fights editorial type">
          <div className="inline-flex bg-tea-elevated rounded-lg border border-tea-border p-0.5">
            {['All', 'Drafts', 'Published'].map((t, i) => (
              <span key={t} className={`px-3 py-1.5 text-ui-12 rounded-md ${i === 1 ? 'bg-tea-bg text-tea-text shadow-sm' : 'text-tea-text-sec'}`}>
                {t}
              </span>
            ))}
          </div>
          <p className="text-ui-11 text-tea-error mt-3">
            Banned: <code className="font-mono">bg-tea-bg shadow-sm</code> on the active tab — see §22.
          </p>
        </Demo>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §7 Buttons
// ─────────────────────────────────────────────────────────────────────────

function ButtonsSection() {
  return (
    <section id="sec-buttons" className="mb-20 scroll-mt-24">
      <SectionHeader num="7" eyebrow="Action · Buttons" title="Buttons" lede="Five variants. Each rendered across five states. Title case, never uppercase tracking." />

      <div className="bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[140px_1fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-3 border-b border-tea-border bg-tea-bg/50">
          <span className="label-caps text-tea-text-dim">Variant</span>
          <span className="label-caps text-tea-text-dim">Rest</span>
          <span className="label-caps text-tea-text-dim">Hover</span>
          <span className="label-caps text-tea-text-dim">Active</span>
          <span className="label-caps text-tea-text-dim">Disabled</span>
          <span className="label-caps text-tea-text-dim">Loading</span>
        </div>

        <div className="grid grid-cols-[140px_1fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-4 items-center border-b border-tea-border">
          <span className="text-ui-13 text-tea-text">Primary</span>
          <PrimaryButton>New article</PrimaryButton>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold/90 text-tea-bg text-xs font-semibold w-fit"><Plus size={13} />New article</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold/80 text-tea-bg text-xs font-semibold w-fit"><Plus size={13} />New article</span>
          <PrimaryButton disabled>New article</PrimaryButton>
          <PrimaryButton loading>Saving</PrimaryButton>
        </div>

        <div className="grid grid-cols-[140px_1fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-4 items-center border-b border-tea-border">
          <span className="text-ui-13 text-tea-text">Secondary</span>
          <SecondaryButton>Cancel</SecondaryButton>
          <span className="inline-flex items-center px-3 py-2 rounded-md border border-tea-border text-tea-text bg-tea-accent-sub text-xs w-fit">Cancel</span>
          <span className="inline-flex items-center px-3 py-2 rounded-md border border-tea-border text-tea-text bg-tea-accent-sub text-xs w-fit">Cancel</span>
          <SecondaryButton disabled>Cancel</SecondaryButton>
          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-tea-border text-tea-text-sec text-xs w-fit"><Loader2 size={13} className="animate-spin" />Cancel</span>
        </div>

        <div className="grid grid-cols-[140px_1fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-4 items-center border-b border-tea-border">
          <span className="text-ui-13 text-tea-text">Ghost</span>
          <GhostButton>Cancel</GhostButton>
          <span className="px-2 py-1 text-xs text-tea-text">Cancel</span>
          <span className="px-2 py-1 text-xs text-tea-text">Cancel</span>
          <span className="px-2 py-1 text-xs text-tea-text-sec opacity-40">Cancel</span>
          <span className="px-2 py-1 text-xs text-tea-text-sec inline-flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" />Cancel</span>
        </div>

        <div className="grid grid-cols-[140px_1fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-4 items-center border-b border-tea-border">
          <span className="text-ui-13 text-tea-text">Icon</span>
          <IconButton icon={RefreshCw} label="Refresh" />
          <span className="p-1.5 rounded-md text-tea-text-sec inline-flex w-fit"><RefreshCw size={16} /></span>
          <span className="p-1.5 rounded-md text-tea-text bg-tea-accent-sub inline-flex w-fit"><RefreshCw size={16} /></span>
          <span className="p-1.5 rounded-md text-tea-text-dim opacity-40 inline-flex w-fit"><RefreshCw size={16} /></span>
          <span className="p-1.5 rounded-md text-tea-text-sec inline-flex w-fit"><Loader2 size={16} className="animate-spin" /></span>
        </div>

        <div className="grid grid-cols-[140px_1fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-4 items-center">
          <span className="text-ui-13 text-tea-text">Destructive</span>
          <DestructiveButton>Delete</DestructiveButton>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-error/90 text-tea-bg text-xs font-semibold w-fit"><Trash2 size={13} />Delete</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-error/80 text-tea-bg text-xs font-semibold w-fit"><Trash2 size={13} />Delete</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-error text-tea-bg text-xs font-semibold opacity-40 w-fit"><Trash2 size={13} />Delete</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-error text-tea-bg text-xs font-semibold w-fit"><Loader2 size={13} className="animate-spin" />Deleting</span>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §8a Status pills + §8b Surfaces
// ─────────────────────────────────────────────────────────────────────────

function PillsSection() {
  return (
    <section id="sec-pills" className="mb-20 scroll-mt-24">
      <SectionHeader num="8" eyebrow="Status · Pills" title="Status pills" lede="Five variants. Caps tracking 1.2px. State color is semantic." />
      <div className="bg-tea-surface border border-tea-border rounded-xl p-6 grid grid-cols-2 md:grid-cols-5 gap-6">
        {(['draft', 'active', 'archived', 'success', 'error'] as StatusVariant[]).map((v) => (
          <div key={v} className="flex flex-col items-start gap-2">
            <StatusPill variant={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</StatusPill>
            <code className="font-mono text-ui-11 text-tea-text-dim">{v}</code>
          </div>
        ))}
      </div>
    </section>
  );
}

function SurfacesSection() {
  const rows: [string, string, StatusVariant][] = [
    ['Spring 2026 Roast', '12 teas · updated 2 days ago', 'active'],
    ['Wholesale Catalog', '24 teas · updated 1 week ago', 'draft'],
    ['Autumn Notes', '8 teas · archived May 2025', 'archived'],
  ];
  const tableRows: [string, string, string, string, StatusVariant][] = [
    ['Hojicha Aki', 'Roasted', '142 g', '$24.00', 'active'],
    ['Koicha Spring', 'Matcha', '38 g', '$36.00', 'active'],
    ['Sample Set', 'Curated', '6 sets', '$12.00', 'draft'],
    ['Genmaicha', 'Blended', '0 g', '$11.00', 'archived'],
  ];

  return (
    <section id="sec-surfaces" className="mb-20 scroll-mt-24">
      <SectionHeader num="8" eyebrow="Surface · Containers" title="Surfaces — card, rows, table" lede="Borders carry shape. No shadows on cards. No zebra striping on tables." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Demo label="Card · feature">
          <article className="bg-tea-surface border border-tea-border rounded-xl p-5 space-y-3">
            <header className="flex items-start justify-between gap-3">
              <div>
                <h4 className="h3">Spring 2026 Roast</h4>
                <p className="text-ui-12 text-tea-text-dim mt-0.5">Updated two days ago</p>
              </div>
              <StatusPill variant="active">Active</StatusPill>
            </header>
            <p className="body-light">A collection of twelve roasts hand-finished at the Kyoto kiln, sequenced from light to heavy.</p>
            <div className="flex items-center justify-between pt-2">
              <span className="font-mono text-ui-12 text-tea-text-sec">12 teas · $284 total</span>
              <a className="link-text" href="#">View →</a>
            </div>
          </article>
        </Demo>

        <Demo label="List rows · divide-y">
          <ul className="divide-y divide-tea-border rounded-xl bg-tea-surface border border-tea-border overflow-hidden">
            {rows.map(([title, sub, status]) => (
              <li key={title}>
                <button className="w-full text-left px-5 py-4 hover:bg-tea-accent-sub transition-colors flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-ui-15 text-tea-text font-display">{title}</div>
                    <div className="text-ui-12 text-tea-text-dim mt-1">{sub}</div>
                  </div>
                  <StatusPill variant={status}>{status}</StatusPill>
                </button>
              </li>
            ))}
          </ul>
        </Demo>
      </div>

      <div className="mt-6">
        <Demo label="Data table · sticky thead · font-serif caps headers">
          <div className="overflow-x-auto bg-tea-bg rounded-lg border border-tea-border">
            <table className="w-full">
              <thead className="bg-tea-bg">
                <tr>
                  {['Name', 'Type', 'Stock', 'Price', 'Status'].map((h, i) => (
                    <th
                      key={h}
                      className={`text-ui-10 uppercase tracking-wider font-serif text-tea-text-sec text-left px-4 py-3 border-b border-tea-border ${i >= 2 && i <= 3 ? 'text-right' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map(([name, type, stock, price, status]) => (
                  <tr key={name} className="border-b border-tea-border last:border-b-0 hover:bg-tea-accent-sub transition-colors">
                    <td className="px-4 py-3 text-ui-14 text-tea-text font-display">{name}</td>
                    <td className="px-4 py-3 text-ui-13 text-tea-text-sec">{type}</td>
                    <td className="px-4 py-3 text-ui-14 text-tea-text text-right font-mono tabular-nums">{stock}</td>
                    <td className="px-4 py-3 text-ui-14 text-tea-text text-right font-mono tabular-nums">{price}</td>
                    <td className="px-4 py-3"><StatusPill variant={status}>{status}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Demo>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §9 Z-index
// ─────────────────────────────────────────────────────────────────────────

function ZIndexSection() {
  return (
    <section id="sec-zindex" className="mb-20 scroll-mt-24">
      <SectionHeader num="9" eyebrow="Stacking · Layers" title="Z-index scale" lede="One scale, no exceptions. No raw z-50, z-panel-modal, or inline zIndex." />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
          <ul>
            {Z_TOKENS.map(([name, val, use]) => (
              <li key={name} className="grid grid-cols-[160px_60px_1fr] gap-3 items-baseline py-2 border-b border-tea-border last:border-b-0">
                <code className="font-mono text-ui-12 text-tea-readgold">{name}</code>
                <span className="font-mono text-ui-11 text-tea-text-dim tabular-nums">{val}</span>
                <span className="text-ui-12 text-tea-text-sec">{use}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
          <div className="label-caps text-tea-text-dim mb-3">Live demo · stacked tokens</div>
          <div className="relative h-[220px] rounded-md bg-tea-bg border border-tea-border overflow-hidden">
            <div className="absolute inset-x-6 top-6 h-10 rounded bg-tea-elevated/80 border border-tea-border z-base flex items-center px-3 text-ui-11 text-tea-text-sec">z-base · page flow</div>
            <div className="absolute inset-x-10 top-12 h-10 rounded bg-tea-elevated border border-tea-border z-dropdown flex items-center px-3 text-ui-11 text-tea-text-sec">z-dropdown · 10</div>
            <div className="absolute inset-x-14 top-20 h-10 rounded bg-tea-gold/15 border border-tea-gold/40 z-sticky flex items-center px-3 text-ui-11 text-tea-text">z-sticky · 20</div>
            <div className="absolute inset-x-16 top-28 h-10 rounded bg-tea-gold/20 border border-tea-gold/40 z-modal flex items-center px-3 text-ui-11 text-tea-text">z-modal · 40</div>
            <div className="absolute inset-x-20 top-36 h-10 rounded bg-tea-gold border border-tea-gold-lt z-toast flex items-center px-3 text-ui-11 text-tea-bg font-semibold">z-toast · 50</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §10 Interaction states
// ─────────────────────────────────────────────────────────────────────────

function StatesSection() {
  const items: { label: string; tone: string; text: string; desc: string }[] = [
    { label: 'Rest', tone: 'bg-tea-surface', text: 'text-tea-text', desc: 'Surface as published.' },
    { label: 'Hover', tone: 'bg-tea-accent-sub', text: 'text-tea-text', desc: 'bg-tea-accent-sub for rows; color shift for icons.' },
    { label: 'Active', tone: 'bg-tea-gold/8', text: 'text-tea-text', desc: 'bg-tea-gold/8 for selected rows.' },
    { label: 'Focus', tone: 'bg-tea-surface ring-2 ring-tea-gold/50 ring-offset-2 ring-offset-tea-bg', text: 'text-tea-text', desc: 'ring-2 ring-tea-gold/50 with offset.' },
    { label: 'Disabled', tone: 'bg-tea-surface opacity-40', text: 'text-tea-text', desc: 'opacity-40 cursor-not-allowed.' },
  ];
  return (
    <section id="sec-states" className="mb-20 scroll-mt-24">
      <SectionHeader num="10" eyebrow="Behavior · Interaction" title="Interaction states" lede="The interface holds still. No scale, translate, or shadow lifts on hover." />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {items.map((s) => (
          <div key={s.label} className={`border border-tea-border rounded-xl p-5 ${s.tone}`}>
            <div className="label-caps text-tea-text-dim mb-3">State</div>
            <div className={`h3 ${s.text}`}>{s.label}</div>
            <p className="text-ui-12 text-tea-text-sec mt-2">{s.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-tea-surface border border-tea-border rounded-xl p-5">
        <div className="label-caps text-tea-text-dim mb-3">Loading · bronze shimmer (never gray)</div>
        <div className="space-y-2 max-w-md">
          <div className="h-3 rounded-md shimmer-warm" />
          <div className="h-3 rounded-md shimmer-warm w-3/4" />
          <div className="h-3 rounded-md shimmer-warm w-1/2" />
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §11 Elevation
// ─────────────────────────────────────────────────────────────────────────

function ElevationSection() {
  return (
    <section id="sec-elevation" className="mb-20 scroll-mt-24">
      <SectionHeader num="11" eyebrow="Depth · Elevation" title="Elevation tiers" lede="Three tiers, no more. Flat, popover, modal. The gold CTA is the lone allowed exception." />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Demo label="Flat · cards, rows, tables">
          <div className="bg-tea-surface border border-tea-border rounded-xl p-5 h-32 flex items-center justify-center text-ui-13 text-tea-text-sec">border carries shape</div>
          <p className="text-ui-11 text-tea-text-dim mt-3">No shadow.</p>
        </Demo>
        <Demo label="Popover · shadow-lg">
          <div className="bg-tea-elevated border border-tea-border rounded-md shadow-lg p-4 h-32 flex items-center justify-center text-ui-13 text-tea-text">menus · tooltips</div>
          <p className="text-ui-11 text-tea-text-dim mt-3">shadow-lg.</p>
        </Demo>
        <Demo label="Modal · shadow-2xl">
          <div className="bg-tea-surface border border-tea-border rounded-xl shadow-2xl p-5 h-32 flex items-center justify-center text-ui-13 text-tea-text">centered dialog</div>
          <p className="text-ui-11 text-tea-text-dim mt-3">shadow-2xl.</p>
        </Demo>
      </div>

      <div className="mt-6">
        <Demo label="Allowed exception · gold CTA at modal-footer scale">
          <div className="flex items-center gap-4 flex-wrap">
            <button className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md bg-tea-gold text-tea-bg text-ui-13 font-semibold shadow-gold-cta hover:bg-tea-gold/90 transition-colors">
              <Check size={13} />
              <span>Save changes</span>
            </button>
            <span className="text-ui-12 text-tea-text-dim">shadow-lg shadow-tea-gold/10 · only at modal footer scale</span>
          </div>
        </Demo>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §12 Forms + §13 Inputs
// ─────────────────────────────────────────────────────────────────────────

const BoxedInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; error?: boolean; label?: string; helper?: string }> = ({ value, onChange, placeholder, error, label, helper }) => (
  <label className="block">
    {label && <div className="label-caps text-tea-text-sec mb-1.5">{label}</div>}
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-tea-bg border ${error ? 'border-tea-error' : 'border-tea-border'} rounded-md px-3 py-2 text-ui-14 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors`}
    />
    {helper && <p className={`text-ui-12 mt-1 ${error ? 'text-tea-error' : 'text-tea-text-dim'}`}>{helper}</p>}
  </label>
);

function FormsSection() {
  const [name, setName] = useState('Adrian Stone');
  const [email, setEmail] = useState('not-a-valid-email');
  const [query, setQuery] = useState('');

  return (
    <section id="sec-forms" className="mb-20 scroll-mt-24">
      <SectionHeader num="12" eyebrow="Input · Forms" title="Forms & inputs" lede="Two input patterns — boxed for fields, underline for toolbars. Pick one per surface." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Demo label="Boxed input · rest + focus + error">
          <div className="space-y-4 max-w-md">
            <BoxedInput label="Display name" value={name} onChange={setName} placeholder="Your name" helper="Shown on invoices and receipts." />
            <BoxedInput
              label="Email"
              value={email}
              onChange={setEmail}
              placeholder="you@teajia.com"
              error={!email.includes('@')}
              helper={!email.includes('@') ? 'Enter a valid email address.' : 'We use this for receipts only.'}
            />
            <div>
              <div className="label-caps text-tea-text-sec mb-1.5">Focus state · always on</div>
              <input
                type="text"
                defaultValue="Type to search…"
                className="w-full bg-tea-bg border border-tea-gold ring-2 ring-tea-gold/30 rounded-md px-3 py-2 text-ui-14 text-tea-text focus:outline-none"
                readOnly
              />
              <p className="text-ui-12 text-tea-text-dim mt-1">Gold focus ring — keep finger here.</p>
            </div>
          </div>
        </Demo>

        <Demo label="Underline input · toolbar density">
          <div className="space-y-4 max-w-md">
            <div>
              <div className="label-caps text-tea-text-sec mb-1.5">Inline filter</div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search teas…"
                className="w-full bg-transparent border-0 border-b border-tea-border rounded-none px-0 py-2 text-ui-14 font-serif text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:outline-none transition-colors"
              />
              <p className="text-ui-12 text-tea-text-dim mt-1">Use in toolbars — boxed would feel heavy here.</p>
            </div>
            <div>
              <div className="label-caps text-tea-text-sec mb-1.5">Always-focused (demo)</div>
              <input
                type="text"
                defaultValue="2026 spring roast"
                className="w-full bg-transparent border-0 border-b border-tea-gold rounded-none px-0 py-2 text-ui-14 font-serif text-tea-text focus:outline-none"
                readOnly
              />
              <p className="text-ui-12 text-tea-text-dim mt-1">Gold underline replaces the border on focus.</p>
            </div>
            <div className="pt-3 border-t border-tea-border space-y-2">
              <div className="label-caps text-tea-text-dim">Field-group spacing</div>
              <code className="block font-mono text-ui-12 text-tea-text-sec">space-y-3 · between fields</code>
              <code className="block font-mono text-ui-12 text-tea-text-sec">space-y-6 · between groups</code>
              <code className="block font-mono text-ui-12 text-tea-text-sec">{'<hr className="border-tea-border" /> · major sections only'}</code>
            </div>
          </div>
        </Demo>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §13 Modal & drawer
// ─────────────────────────────────────────────────────────────────────────

function ModalDrawerSection() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <section id="sec-modal" className="mb-20 scroll-mt-24">
      <SectionHeader num="13" eyebrow="Overlay · Modal · Drawer" title="Modals & drawers" lede="Modals are centered, ≤ 480px, single-purpose. Drawers slide from right, occupy 100vw on mobile." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Demo label="Modal · z-modal · centered · ≤ 480px">
          <div className="relative h-72 rounded-md bg-tea-bg border border-tea-border overflow-hidden">
            <div className="absolute inset-0 bg-tea-bg/70 backdrop-blur-[2px] z-overlay" />
            <div className="absolute inset-0 z-modal flex items-center justify-center p-4">
              <div className="relative bg-tea-surface border border-tea-border rounded-xl shadow-2xl w-full max-w-sm">
                <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
                  <div>
                    <h4 className="h3">Archive this article?</h4>
                    <p className="text-ui-12 text-tea-text-sec mt-1">It moves to Archived. You can restore it anytime.</p>
                  </div>
                  <IconButton icon={X} label="Close" />
                </div>
                <div className="px-5 py-3 flex justify-end gap-2 border-t border-tea-border">
                  <GhostButton>Cancel</GhostButton>
                  <PrimaryButton icon={Archive}>Archive</PrimaryButton>
                </div>
              </div>
            </div>
          </div>
        </Demo>

        <Demo label="Drawer · z-drawer · right slide-in">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <PrimaryButton onClick={() => setDrawerOpen((v) => !v)} icon={drawerOpen ? X : PanelRight}>
              {drawerOpen ? 'Close drawer' : 'Open drawer'}
            </PrimaryButton>
            <span className="text-ui-12 text-tea-text-dim">Persistent header · cancel left · primary right.</span>
          </div>

          <div className="relative h-72 rounded-md bg-tea-bg border border-tea-border overflow-hidden">
            <div
              className={`absolute inset-0 z-overlay bg-tea-bg/70 transition-opacity ${drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              onClick={() => setDrawerOpen(false)}
            />
            <aside
              className={`absolute right-0 top-0 bottom-0 z-drawer w-[260px] bg-tea-surface border-l border-tea-border flex flex-col transition-transform ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}
              style={{ transitionDuration: '320ms', transitionTimingFunction: 'cubic-bezier(0.4, 0.0, 0.2, 1)' }}
            >
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-tea-border">
                <span className="label-caps">Edit profile</span>
                <button onClick={() => setDrawerOpen(false)} className="text-tea-text-dim hover:text-tea-text"><X size={16} /></button>
              </div>
              <div className="flex-1 px-4 py-4 text-ui-13 text-tea-text-sec">Drawer body scrolls independently.</div>
              <div className="border-t border-tea-border px-4 py-3 flex justify-between">
                <GhostButton onClick={() => setDrawerOpen(false)}>Cancel</GhostButton>
                <PrimaryButton icon={Check}>Save</PrimaryButton>
              </div>
            </aside>
          </div>
        </Demo>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §14 Sidebar nav
// ─────────────────────────────────────────────────────────────────────────

const NAV_TREE: { name: string; icon: React.ComponentType<{ size?: number; className?: string }>; children: string[] }[] = [
  { name: 'Editorial', icon: BookOpen, children: ['Articles', 'Drafts', 'Magazine'] },
  { name: 'Inventory', icon: Package, children: ['All teas', 'Collections', 'Tags'] },
  { name: 'People', icon: Users, children: ['Contacts', 'Sources', 'Team'] },
  { name: 'Orders', icon: ScrollText, children: ['Invoices', 'Purchase orders'] },
  { name: 'Settings', icon: SettingsIcon, children: ['Workspace', 'Account'] },
];

function SidebarNavSection() {
  const [active, setActive] = useState('Articles');
  return (
    <section id="sec-nav" className="mb-20 scroll-mt-24">
      <SectionHeader num="14" eyebrow="Navigation · Sidebar" title="Sidebar navigation" lede="Two-tier serif nav. Parent in font-display 17px; child indented 24px in 15px. Gold left-bar marks the leaf." />

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        <div className="bg-tea-surface border border-tea-border rounded-xl p-3">
          <div className="px-3 pt-2 pb-3 border-b border-tea-border mb-2">
            <div className="font-display text-ui-20 text-tea-text">Teajia</div>
            <div className="label-caps text-tea-text-dim mt-0.5">EDITORIAL · COMMERCE</div>
          </div>
          <nav>
            {NAV_TREE.map((group) => {
              const GroupIcon = group.icon;
              return (
                <div key={group.name} className="mb-3 last:mb-0">
                  <div className="flex items-center gap-2.5 px-3 py-2.5 text-tea-text font-display tracking-wider text-ui-17">
                    <GroupIcon size={14} className="text-tea-text-sec" />
                    <span>{group.name}</span>
                  </div>
                  <ul className="ml-[26px]">
                    {group.children.map((child) => {
                      const isActive = active === child;
                      return (
                        <li key={child}>
                          <button
                            onClick={() => setActive(child)}
                            className={`block w-full text-left py-2 pl-3 pr-2 font-display tracking-wider text-ui-15 transition-colors ${
                              isActive ? 'text-tea-text border-l border-tea-gold -ml-px' : 'text-tea-text-sec hover:text-tea-text'
                            }`}
                          >
                            {child}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </nav>
        </div>

        <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
          <SubHeader>Rules</SubHeader>
          <ul className="space-y-3 text-ui-13 text-tea-text-sec">
            {[
              'Parent rows are clickable only if they have a direct view; otherwise they expand.',
              'Child rows: 24px left indent, no extra leading icon.',
              <span key="active-leaf">Active leaf: left border 1px gold, <code className="font-mono text-tea-readgold">text-tea-text</code> — never a filled background.</span>,
              <span key="md"><code className="font-mono">md</code> collapse: icons-only column, 64px wide, labels in tooltip.</span>,
              'No badges or counters in nav. Counts live on the destination page.',
              <span key="active-val">Active: <span className="text-tea-text">{active}</span></span>,
            ].map((line, i) => (
              <li key={i} className="flex gap-2"><span className="text-tea-readgold">·</span> <span>{line}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §15 Icons
// ─────────────────────────────────────────────────────────────────────────

const ICON_GROUPS: { group: string; icons: [string, React.ComponentType<{ size?: number; className?: string }>][] }[] = [
  { group: 'Navigation', icons: [['ChevronLeft', ChevronLeft], ['ChevronRight', ChevronRight], ['ChevronDown', ChevronDown], ['ChevronUp', ChevronUp], ['ArrowLeft', ArrowLeft], ['ArrowRight', ArrowRight], ['X', X], ['Menu', Menu]] },
  { group: 'Actions', icons: [['Plus', Plus], ['Edit3', Edit3], ['Trash2', Trash2], ['Check', Check], ['Copy', Copy], ['Share2', Share2], ['Download', Download], ['Upload', Upload]] },
  { group: 'Status', icons: [['Loader2', Loader2], ['AlertCircle', AlertCircle], ['Info', Info], ['Star', Star], ['Heart', Heart], ['Bell', Bell]] },
  { group: 'Objects', icons: [['BookOpen', BookOpen], ['Package', Package], ['Users', Users], ['ScrollText', ScrollText], ['Settings', SettingsIcon], ['Search', Search], ['Filter', Filter], ['Eye', Eye]] },
];

function IconsSection() {
  const [size, setSize] = useState(14);
  return (
    <section id="sec-icons" className="mb-20 scroll-mt-24">
      <SectionHeader num="15" eyebrow="Glyph · Iconography" title="Iconography" lede="Lucide line icons only. Stroke 1.5–1.75. Default size 14–16px. text-tea-text-sec or text-tea-text-dim by default; gold only when active." />

      <div className="bg-tea-surface border border-tea-border rounded-xl p-5 mb-6 flex flex-wrap items-center gap-4">
        <span className="label-caps text-tea-text-dim">Preview size</span>
        {[12, 14, 16, 20, 24].map((s) => (
          <button
            key={s}
            onClick={() => setSize(s)}
            className={`px-3 py-1 rounded-md text-ui-12 font-mono ${size === s ? 'bg-tea-gold/15 text-tea-text ring-1 ring-tea-gold/40' : 'text-tea-text-sec hover:text-tea-text'}`}
          >
            {s}px
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-ui-12 text-tea-text-dim flex-wrap">
          <span className="inline-flex items-center gap-1.5"><Check size={14} className="text-tea-green" /> success</span>
          <span className="inline-flex items-center gap-1.5"><AlertCircle size={14} className="text-tea-error" /> error</span>
          <span className="inline-flex items-center gap-1.5"><Star size={14} className="text-tea-readgold" /> active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ICON_GROUPS.map((g) => (
          <div key={g.group} className="bg-tea-surface border border-tea-border rounded-xl p-5">
            <SubHeader>{g.group}</SubHeader>
            <div className="grid grid-cols-4 gap-3">
              {g.icons.map(([name, IconCmp]) => (
                <div key={name} className="flex flex-col items-center gap-2 py-3 rounded-md border border-tea-border hover:bg-tea-accent-sub transition-colors">
                  <IconCmp size={size} className="text-tea-text-sec" />
                  <code className="font-mono text-ui-10 text-tea-text-dim text-center truncate w-full px-1">{name}</code>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §16 Animation
// ─────────────────────────────────────────────────────────────────────────

function AnimationSection() {
  const [hover, setHover] = useState(false);
  return (
    <section id="sec-animation" className="mb-20 scroll-mt-24">
      <SectionHeader num="16" eyebrow="Motion · Animation" title="Animation" lede="Sparingly. ≤320ms. Color & opacity only. Never transform a UI surface." />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Demo label="Color · 150ms ease-out" caption="Hover row">
          <div
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            className="rounded-md border border-tea-border bg-tea-bg hover:bg-tea-accent-sub px-4 py-3 cursor-pointer transition-colors"
            style={{ transitionDuration: '150ms' }}
          >
            <div className="text-ui-13 text-tea-text font-display">Hojicha Aki</div>
            <div className="text-ui-12 text-tea-text-sec mt-0.5">{hover ? 'hover' : 'rest'}</div>
          </div>
        </Demo>

        <Demo label="Opacity fade · 200ms">
          <div className="rounded-md border border-tea-border bg-tea-bg px-4 py-3 fade-loop">
            <div className="text-ui-13 text-tea-text font-display">Saved.</div>
            <div className="text-ui-12 text-tea-text-sec mt-0.5">Auto-fading toast</div>
          </div>
        </Demo>

        <Demo label="Slide-in · 320ms · drawer only">
          <div className="rounded-md border border-tea-border bg-tea-bg h-20 overflow-hidden relative">
            <div className="absolute inset-y-0 right-0 w-2/3 bg-tea-surface border-l border-tea-border slide-loop flex items-center px-4 text-ui-12 text-tea-text-sec">
              drawer slides
            </div>
          </div>
        </Demo>
      </div>

      <div className="mt-6 bg-tea-surface border border-tea-border rounded-xl p-5">
        <SubHeader>Durations</SubHeader>
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-3 text-ui-13">
          {[
            ['150ms', 'Hover · focus rings · color shifts'],
            ['200ms', 'Fade in/out · backdrop opacity'],
            ['320ms', 'Slide-in · drawer · sheet'],
          ].map(([dur, use]) => (
            <li key={dur} className="flex items-baseline gap-3 p-3 bg-tea-bg rounded-md border border-tea-border">
              <code className="font-mono text-ui-12 text-tea-readgold">{dur}</code>
              <span className="text-ui-12 text-tea-text-sec">{use}</span>
            </li>
          ))}
        </ul>
        <p className="text-ui-12 text-tea-error mt-4">
          Banned: spring physics on UI · scale transforms on cards · ≥400ms transitions · staggered choreography.
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §17 Empty / error states
// ─────────────────────────────────────────────────────────────────────────

function EmptyStatesSection() {
  return (
    <section id="sec-empty" className="mb-20 scroll-mt-24">
      <SectionHeader num="17" eyebrow="Edge · Empty & error" title="Empty & error states" lede="Quiet. Centered. One line of guidance and one primary action — no decorative illustrations." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Demo label="Empty">
          <div className="py-10 text-center">
            <BookOpen size={28} strokeWidth={1.25} className="text-tea-text-dim mx-auto" />
            <p className="font-display text-ui-17 text-tea-text mt-4">No articles yet</p>
            <p className="text-ui-12 text-tea-text-sec mt-1">Start one to see it here.</p>
            <div className="mt-4 inline-flex"><PrimaryButton>New article</PrimaryButton></div>
          </div>
        </Demo>

        <Demo label="No results">
          <div className="py-10 text-center">
            <Search size={24} strokeWidth={1.25} className="text-tea-text-dim mx-auto" />
            <p className="font-display text-ui-15 text-tea-text mt-4">Nothing matches "shincha"</p>
            <p className="text-ui-12 text-tea-text-sec mt-1">Try a broader keyword, or clear filters.</p>
            <div className="mt-4 inline-flex"><SecondaryButton icon={X}>Clear filters</SecondaryButton></div>
          </div>
        </Demo>

        <Demo label="Error">
          <div className="py-10 text-center">
            <AlertCircle size={24} strokeWidth={1.25} className="text-tea-error mx-auto" />
            <p className="font-display text-ui-15 text-tea-text mt-4">Couldn't load orders</p>
            <p className="text-ui-12 text-tea-text-sec mt-1">Check connection, then retry.</p>
            <div className="mt-4 inline-flex"><SecondaryButton icon={RefreshCw}>Retry</SecondaryButton></div>
          </div>
        </Demo>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §19 Identity card
// ─────────────────────────────────────────────────────────────────────────

function IdentityCardSection() {
  return (
    <section id="sec-identity" className="mb-20 scroll-mt-24">
      <SectionHeader num="19" eyebrow="Domain · Identity" title="Identity card" lede="Customer / vendor / team member surface. One per profile. Top of any drawer or detail page." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-tea-surface border border-tea-border rounded-xl p-5 flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-tea-elevated text-tea-text-sec font-display text-ui-15 flex items-center justify-center flex-shrink-0">AS</div>
          <div className="flex-1 min-w-0">
            <h3 className="h3">Adrian Stone</h3>
            <p className="text-ui-13 text-tea-text-sec mt-0.5">adrian@teajia.com</p>
            <p className="text-ui-12 text-tea-text-dim mt-0.5">Member since March 2024</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <StatusPill variant="active">Customer</StatusPill>
              <StatusPill variant="success">Wholesale</StatusPill>
              <StatusPill variant="draft">VIP</StatusPill>
            </div>
          </div>
        </div>

        <div className="bg-tea-surface border border-tea-border rounded-xl p-5 flex items-start gap-4">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-tea-border flex-shrink-0">
            <div className="w-full h-full" style={{ background: 'radial-gradient(circle at 30% 30%, #c6a473, #8e6d2e 55%, #3a3126)' }} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="h3">Kyoto Roastery</h3>
            <p className="text-ui-13 text-tea-text-sec mt-0.5">contact@kyoto-roastery.jp</p>
            <p className="text-ui-12 text-tea-text-dim mt-0.5">Supplier · Hojicha · since 2022</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <StatusPill variant="draft">Source</StatusPill>
              <StatusPill variant="success">Verified</StatusPill>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §20 Tea card
// ─────────────────────────────────────────────────────────────────────────

const TeaCard: React.FC<{ name: string; region: string; weight: string; price: string; accent: string; hovered: boolean }> = ({ name, region, weight, price, accent, hovered }) => (
  <article
    className="group relative bg-tea-surface border border-tea-border rounded-md overflow-hidden transition-colors"
    style={{
      boxShadow: hovered
        ? '0 8px 24px -8px rgba(0,0,0,0.25), 0 1px 0 rgba(168,135,77,0.10) inset'
        : '0 1px 0 rgba(168,135,77,0.05) inset',
    }}
  >
    <div className="relative aspect-square overflow-hidden">
      <div
        className="absolute inset-0 transition-transform duration-500"
        style={{
          background: `radial-gradient(circle at 50% 60%, ${accent} 0%, #3a3126 70%)`,
          opacity: hovered ? 1 : 0.85,
          transform: hovered ? 'scale(1.06)' : 'scale(1)',
        }}
      />
      <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: accent }} />
    </div>
    <div className="px-3 py-3">
      <h4 className={`font-display text-ui-15 transition-colors ${hovered ? 'text-tea-readgold' : 'text-tea-text'}`}>{name}</h4>
      <p className="text-ui-10 uppercase tracking-caps text-tea-text-dim mt-1">{region} · {weight}</p>
      <p className="font-mono text-ui-13 text-tea-text-sec mt-1.5 tabular-nums">{price}</p>
    </div>
  </article>
);

function TeaCardSection() {
  const [hoverIdx, setHoverIdx] = useState<number>(-1);
  const cards = [
    { name: 'Hojicha Aki', region: 'KYOTO', weight: '50g', price: '$24.00', accent: '#8a5a3a' },
    { name: 'Koicha Spring', region: 'UJI', weight: '20g', price: '$36.00', accent: '#7a8f5e' },
    { name: 'Sencha Asanagi', region: 'SHIZUOKA', weight: '80g', price: '$18.00', accent: '#5a7a5a' },
    { name: 'Genmaicha', region: 'KYOTO', weight: '100g', price: '$11.00', accent: '#a88340' },
  ];

  return (
    <section id="sec-teacard" className="mb-20 scroll-mt-24">
      <SectionHeader num="20" eyebrow="Domain · Product" title="Tea card · shop tile" lede="The most-rendered card in the app. Photo scale 1.06 on hover, title shifts to gold." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <div
            key={c.name}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(-1)}
            onFocus={() => setHoverIdx(i)}
            tabIndex={0}
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
          >
            <TeaCard {...c} hovered={hoverIdx === i} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §20b Inventory list
// ─────────────────────────────────────────────────────────────────────────

type InvRow = {
  name: string;
  type: string;
  dot: string;
  year: string;
  origin: string;
  grams: string;
  price: string;
  starred?: boolean;
  hidden?: boolean;
  editing?: boolean;
  qty?: number;
  pill?: string;
  lowStock?: boolean;
  sold?: boolean;
};

const INV_ROWS: InvRow[] = [
  { name: 'Te Quan Yin', type: '', dot: 'Dark', year: '1983', origin: '', grams: '111', price: '1.90', starred: true, hidden: true },
  { name: 'Oolong', type: 'Loose Leaf', dot: 'Dark', year: '1983', origin: 'Zhudong, Taiwan', grams: '118', price: '0.04' },
  { name: 'Phoenix Mountain', type: '', dot: 'Dark', year: '2012', origin: '', grams: '230', price: '1.55', editing: true, qty: 1 },
  { name: 'Aged Sour Citrus 1983', type: 'Other', dot: 'Dark', year: '1983', origin: '', grams: '54', price: '1.55', lowStock: true },
  { name: 'Aged Liu Bao 1960', type: 'Loose Leaf', dot: 'Dark', year: '1960', origin: 'Guangxi', grams: '250', price: '2.79' },
  { name: 'Aged Liu An 1985', type: 'Basket', dot: 'Dark', year: '1985', origin: 'Qimen, Anhui', grams: '330', price: '1.59' },
  { name: "Ya'an Kang Brick 1980", type: 'Brick', dot: 'Dark', year: '1980', origin: "Ya'an, Sichuan", grams: '0g', price: '1.86', starred: true, hidden: true, pill: 'hidden' },
  { name: 'Yiwu Mushroom', type: 'Other', dot: 'Dark', year: '–', origin: 'Yiwu, Yunnan', grams: '0g', price: '3.83', sold: true },
  { name: 'Wild Ancha', type: 'Loose Leaf', dot: 'Dark', year: '2023', origin: 'Anhua, Hunan', grams: '0g', price: '1.21', sold: true },
  { name: 'Wild Ancha', type: 'Loose Leaf', dot: 'Dark', year: '2024', origin: 'Anhua, Hunan', grams: '0g', price: '5.42', sold: true },
  { name: 'Anhua Yi Ji 2015', type: 'Loose Leaf', dot: 'Dark', year: '2015', origin: 'Anhua, Hunan', grams: '0g', price: '0.00', sold: true },
  { name: 'Anhua Huangye 2024', type: 'Loose Leaf', dot: 'Dark', year: '2024', origin: 'Anhua, Hunan', grams: '0g', price: '0.00', sold: true },
  { name: 'Anhua Huangye 2022', type: 'Loose Leaf', dot: 'Dark', year: '2022', origin: 'Anhua, Hunan', grams: '0g', price: '0.00', sold: true },
  { name: 'Anhua Yi Ji 2020', type: 'Loose Leaf', dot: 'Dark', year: '2020', origin: 'Anhua, Hunan', grams: '0g', price: '0.00', sold: true },
];

function InventoryListSection() {
  const [stars, setStars] = useState<boolean[]>(() => INV_ROWS.map((r) => !!r.starred));
  const [hidden, setHidden] = useState<boolean[]>(() => INV_ROWS.map((r) => !!r.hidden));

  const cols: { key: string; label: string; align: 'left' | 'right' }[] = [
    { key: 'product', label: 'Product', align: 'left' },
    { key: 'type', label: 'Type ↑', align: 'left' },
    { key: 'year', label: 'Year', align: 'left' },
    { key: 'origin', label: 'Origin', align: 'left' },
    { key: 'grams', label: 'Grams', align: 'right' },
    { key: 'price', label: 'Retail/g', align: 'right' },
  ];

  return (
    <section id="sec-inventory" className="mb-20 scroll-mt-24">
      <SectionHeader
        num="20"
        eyebrow="Domain · Inventory · Table"
        title="Inventory table"
        lede="Multi-column product ledger. Mono numerics align right. Active row gets a gold-tinted background and inline qty stepper; sold-out rows fade text to dim."
      />

      <div className="bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-tea-border">
          <button className="text-ui-11 uppercase tracking-caps font-sans text-tea-text-sec hover:text-tea-text transition-colors inline-flex items-center gap-1.5">
            <History size={12} /> View stock history
          </button>
          <span className="label-caps text-tea-text-dim tabular-nums">196 items</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead className="bg-tea-bg/30">
              <tr>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    className={`font-serif text-ui-11 uppercase tracking-display text-tea-text-sec font-normal px-4 py-3 border-b border-tea-border ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {c.label}
                  </th>
                ))}
                <th className="border-b border-tea-border w-[160px]" aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody>
              {INV_ROWS.map((r, i) => {
                const isEdit = r.editing;
                const isStarred = stars[i];
                const isHidden = hidden[i];
                const nameTone = r.lowStock ? 'text-tea-readgold' : r.sold ? 'text-tea-text-sec' : 'text-tea-text';
                const gramsTone = r.lowStock ? 'text-tea-readgold' : r.sold ? 'text-tea-text-dim' : 'text-tea-text';
                const priceTone = r.lowStock ? 'text-tea-readgold' : r.sold ? 'text-tea-text-dim' : 'text-tea-text';
                return (
                  <tr
                    key={i}
                    className={`border-b border-tea-border last:border-b-0 transition-colors ${
                      isEdit ? 'bg-tea-gold/8 outline outline-1 -outline-offset-1 outline-tea-gold/40' : 'hover:bg-tea-accent-sub'
                    }`}
                  >
                    <td className="px-4 py-3 align-middle">
                      <div className={`font-display text-ui-17 leading-tight ${nameTone}`}>{r.name}</div>
                      {r.type && (
                        <div className="font-sans text-ui-11 text-tea-text-dim mt-0.5" style={{ letterSpacing: '0.02em' }}>
                          {r.type}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ui-13 text-tea-text-sec align-middle">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-tea-text-dim inline-block" />
                        {r.dot}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-ui-15 align-middle font-serif ${r.sold ? 'text-tea-text-dim' : 'text-tea-text-sec'}`}>
                      {r.year}
                    </td>
                    <td className="px-4 py-3 text-ui-13 text-tea-text-sec align-middle">{r.origin}</td>
                    <td className={`px-4 py-3 text-ui-15 text-right tabular-nums align-middle font-serif ${gramsTone}`}>{r.grams}</td>
                    <td className={`px-4 py-3 text-ui-15 text-right tabular-nums align-middle font-serif ${priceTone}`}>{r.price}</td>
                    <td className="px-3 py-3 align-middle text-right whitespace-nowrap">
                      {isEdit ? (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-tea-gold/50 rounded-md bg-tea-bg text-ui-15 text-tea-text tabular-nums font-serif">
                          {r.qty} <ChevronDown size={12} className="text-tea-text-dim ml-0.5" />
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-0.5 text-tea-text-dim">
                          {r.pill && <StatusPill variant="archived">{r.pill}</StatusPill>}
                          <button
                            onClick={() => setStars((s) => s.map((v, k) => (k === i ? !v : v)))}
                            className="p-1.5 hover:text-tea-readgold transition-colors"
                            aria-label="Star"
                          >
                            <Star size={14} className={isStarred ? 'text-tea-readgold' : ''} style={isStarred ? { fill: 'currentColor' } : undefined} />
                          </button>
                          <button
                            onClick={() => setHidden((h) => h.map((v, k) => (k === i ? !v : v)))}
                            className="p-1.5 hover:text-tea-text-sec transition-colors"
                            aria-label="Hide"
                          >
                            {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button className="p-1.5 hover:text-tea-text-sec transition-colors" aria-label="Edit">
                            <Edit3 size={14} />
                          </button>
                          <button className="p-1.5 hover:text-tea-text-sec transition-colors" aria-label="More">
                            <MoreHorizontal size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-tea-border flex items-center justify-between">
          <span className="text-ui-13 text-tea-text-dim tabular-nums font-serif">14 of 196</span>
          <button className="text-ui-12 text-tea-readgold hover:text-tea-gold-lt">Load 20 more</button>
        </div>
      </div>

      <p className="text-ui-12 text-tea-text-dim mt-3 max-w-3xl">
        Active row: <code className="font-mono text-tea-text-sec">bg-tea-gold/8</code> + 1px gold outline + inline qty stepper. Low-stock numerics:{' '}
        <code className="font-mono text-tea-readgold">text-tea-readgold</code>. Sold-out rows: name <code className="font-mono">text-tea-text-sec</code>, numerics{' '}
        <code className="font-mono">text-tea-text-dim</code>.
      </p>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §21 Order lines + activity timeline
// ─────────────────────────────────────────────────────────────────────────

function OrderTimelineSection() {
  const lines: [string, string, number][] = [
    ['Hojicha Aki 2026', '50 g × $0.48', 24.00],
    ['Koicha Spring', '20 g × $1.80', 36.00],
    ['Sample Set (3)', '1 × $12.00', 12.00],
  ];
  const events = [
    { date: 'Mar 12 · 2:14 PM', body: 'Placed order — $124.00', system: false },
    { date: 'Mar 11 · 4:02 PM', body: 'Sent invoice INV-0042', system: false },
    { date: 'Mar 11 · 3:58 PM', body: 'Created order — 3 items', system: false },
    { date: 'Mar 10 · 9:00 AM', body: 'Tag "VIP" added by automation', system: true },
  ];

  return (
    <section id="sec-order" className="mb-20 scroll-mt-24">
      <SectionHeader num="21" eyebrow="Domain · Commerce · Audit" title="Order lines & activity timeline" lede="Mono numerics, tabular-nums for alignment. Timeline rail has 1px border-l with offset dots." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="h3">Invoice INV-0042</h3>
            <span className="label-caps text-tea-text-dim">ISSUED · MAR 12 2026</span>
          </div>
          <div className="border-t border-tea-border">
            {lines.map(([item, qty, total]) => (
              <div key={item} className="flex justify-between items-baseline py-2 text-ui-14 text-tea-text border-b border-tea-border">
                <span className="flex-1 truncate">{item}</span>
                <span className="text-tea-text-sec text-ui-13 mx-4 font-mono tabular-nums">{qty}</span>
                <span className="font-mono tabular-nums w-20 text-right">${total.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="pt-3 space-y-1.5 text-ui-13">
            {[
              ['Subtotal', 72.00],
              ['Shipping', 9.00],
              ['Tax (GST 10%)', 7.20],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between">
                <span className="text-tea-text-sec">{k}</span>
                <span className="text-tea-text font-mono tabular-nums">${(v as number).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-baseline pt-3 mt-2 border-t border-tea-border">
            <span className="font-display text-ui-17 font-medium text-tea-text">Total</span>
            <span className="font-mono text-ui-17 text-tea-text tabular-nums">$88.20</span>
          </div>
        </div>

        <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
          <h3 className="h3 mb-1">Activity</h3>
          <p className="text-ui-12 text-tea-text-dim mb-5">Customer audit thread</p>
          <ul className="relative pl-5 border-l border-tea-border space-y-5">
            {events.map((e, i) => (
              <li key={i} className="relative">
                <span className={`absolute -left-[22px] top-1.5 w-2 h-2 rounded-full ${e.system ? 'bg-tea-text-dim' : 'bg-tea-gold'}`} />
                <div className="label-caps text-tea-text-dim mb-0.5">{e.date}</div>
                <div className="text-ui-13 text-tea-text-sec">
                  {e.body.split(/(\$[0-9.]+|INV-[0-9]+)/).map((part, k) =>
                    /\$|INV-/.test(part) ? (
                      <code key={k} className="font-mono text-tea-text">{part}</code>
                    ) : (
                      <React.Fragment key={k}>{part}</React.Fragment>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// §22 Anti-patterns
// ─────────────────────────────────────────────────────────────────────────

function AntiPatternsSection() {
  return (
    <section id="sec-anti" className="mb-20 scroll-mt-24">
      <SectionHeader num="22" eyebrow="Rules · Anti-patterns" title="What never to ship" lede="The fastest way to define our visual language is to name what it isn't." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Demo banned label="Segmented pill tabs" caption="OS-control aesthetic, fights serif type">
          <div className="inline-flex bg-tea-elevated rounded-lg border border-tea-border p-0.5">
            {['All', 'Drafts', 'Live'].map((t, i) => (
              <span key={t} className={`px-3 py-1.5 text-ui-12 rounded-md ${i === 0 ? 'bg-tea-bg text-tea-text shadow-sm' : 'text-tea-text-sec'}`}>{t}</span>
            ))}
          </div>
        </Demo>

        <Demo banned label="Scale or shadow lift on hover" caption="UI is a printed page, not a button">
          <div className="bg-tea-surface border border-tea-border rounded-xl p-5 hover-lift-bad">
            <div className="font-display text-ui-15 text-tea-text">Hover me</div>
            <p className="text-ui-12 text-tea-text-sec">This card translates and shadows on hover.</p>
          </div>
        </Demo>

        <Demo banned label="Bright system red" caption="Use --tea-error instead">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-ui-10 uppercase font-sans tracking-caps"
              style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', boxShadow: 'inset 0 0 0 1px rgba(239, 68, 68, 0.45)' }}
            >
              Error
            </span>
            <span className="text-ui-12 text-tea-text-dim">→</span>
            <StatusPill variant="error">Error</StatusPill>
          </div>
        </Demo>

        <Demo banned label="Inline arbitrary pixels" caption="Use the token scale">
          <code className="block font-mono text-ui-12 text-tea-text-sec bg-tea-bg rounded-md p-3 break-all">
            {'text-[12px] · gap-[14px] · z-priority · style={{ marginTop: 12 }}'}
          </code>
          <p className="text-ui-11 text-tea-text-dim mt-2">Use text-ui-12, gap-4, z-popover, mt-3.</p>
        </Demo>

        <Demo banned label="Glassy emoji" caption="Use lucide line icons">
          <div className="flex items-center gap-4 text-ui-20 flex-wrap">
            <span>📚</span><span>📦</span><span>👥</span><span>📃</span><span>⚙️</span>
            <span className="text-ui-12 text-tea-text-dim">→</span>
            <BookOpen size={20} /><Package size={20} /><Users size={20} /><ScrollText size={20} /><SettingsIcon size={20} />
          </div>
        </Demo>

        <Demo banned label="Cards with white surfaces" caption="Surfaces are warm — never #fff in dark mode">
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-gray-900">
            <div className="font-sans text-sm font-semibold">White card on warm bg</div>
            <p className="text-xs text-gray-600 mt-1">Reads as a popup, not a surface.</p>
          </div>
        </Demo>

        <Demo banned label="Raw z-50 / z-panel-modal" caption="Use the z- token scale">
          <code className="block font-mono text-ui-12 text-tea-text-sec bg-tea-bg rounded-md p-3 break-all">
            {'<div className="fixed inset-0 z-panel-modal" />'}
          </code>
          <p className="text-ui-11 text-tea-text-dim mt-2">→ z-modal, z-popover, z-drawer.</p>
        </Demo>

        <Demo banned label="Decorative emoji in body copy" caption="Editorial product. No party hats.">
          <p className="text-ui-13 text-tea-text">
            <span>🎉</span> New season! <span>🍵</span> Aki hojicha just dropped. <span>✨</span>
          </p>
        </Demo>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Header + sticky jump nav
// ─────────────────────────────────────────────────────────────────────────

function ShowcaseHeader({ mode, setMode }: { mode: 'dark' | 'light'; setMode: (m: 'dark' | 'light') => void }) {
  return (
    <header className="border-b border-tea-border">
      <div className="max-w-6xl mx-auto px-4 md:px-8 pt-10 pb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full border border-tea-gold/40 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-tea-gold" />
              </div>
              <span className="font-display text-ui-17 tracking-wide text-tea-text">Teajia</span>
              <span className="text-tea-text-dim text-ui-12">·</span>
              <span className="label-caps">Design system v1.0</span>
            </div>
            <h1
              className="font-display text-tea-text"
              style={{ fontWeight: 300, fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1.05, letterSpacing: '0.01em' }}
            >
              The design language
            </h1>
            <p className="subtitle mt-3 max-w-2xl">
              Tokens, primitives, recipes. The whole system in one document — colors and chrome through anti-patterns.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="label-caps text-tea-text-dim hidden md:inline">Mode</span>
            <div className="inline-flex border border-tea-border rounded-md overflow-hidden">
              <button
                onClick={() => setMode('dark')}
                className={`flex items-center gap-1.5 px-3 py-2 text-ui-12 ${
                  mode === 'dark' ? 'bg-tea-gold/15 text-tea-text' : 'text-tea-text-sec hover:text-tea-text'
                }`}
              >
                <Moon size={13} /> Dark
              </button>
              <button
                onClick={() => setMode('light')}
                className={`flex items-center gap-1.5 px-3 py-2 text-ui-12 ${
                  mode === 'light' ? 'bg-tea-gold/15 text-tea-text' : 'text-tea-text-sec hover:text-tea-text'
                }`}
              >
                <Sun size={13} /> Light
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function JumpNav() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="sticky top-0 z-sticky bg-tea-bg/95 backdrop-blur-md border-b border-tea-border">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-3">
          {SECTIONS.map((s) => {
            const isActive = active === s.id;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`whitespace-nowrap px-3 py-1.5 rounded-md text-ui-11 uppercase tracking-caps font-sans transition-colors ${
                  isActive ? 'bg-tea-gold/10 text-tea-text ring-1 ring-tea-gold/40' : 'text-tea-text-sec hover:text-tea-text'
                }`}
              >
                <span className="font-mono text-tea-text-dim mr-1.5 tabular-nums">{s.num}</span>
                {s.label}
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function ShowcaseFooter() {
  return (
    <footer className="border-t border-tea-border mt-10">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="font-display text-ui-20 text-tea-text">Universal rules. Concrete recipes. One visual language.</div>
          <p className="text-ui-13 text-tea-text-sec mt-2 max-w-md">
            Components reference the semantic token, not the hex. Modes share names — values switch. Surfaces do not lift.
          </p>
        </div>
        <div>
          <div className="label-caps text-tea-text-dim">Index</div>
          <ul className="mt-2 grid grid-cols-2 gap-1">
            {SECTIONS.slice(0, 10).map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-ui-12 text-tea-text-sec hover:text-tea-text font-mono tabular-nums">§{s.num} {s.label}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 border-t border-tea-border flex items-center justify-between">
        <span className="label-caps text-tea-text-dim">Teajia · Design system v1.0</span>
        <span className="font-mono text-ui-11 text-tea-text-dim tabular-nums">© 2026</span>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tweaks panel — mode toggle, accent palette, type scale
// ─────────────────────────────────────────────────────────────────────────

function TweaksPanel({
  mode,
  setMode,
  accent,
  setAccent,
  fontScale,
  setFontScale,
}: {
  mode: 'dark' | 'light';
  setMode: (m: 'dark' | 'light') => void;
  accent: string;
  setAccent: (a: string) => void;
  fontScale: number;
  setFontScale: (n: number) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="fixed bottom-4 right-4 z-toast">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-tea-surface border border-tea-border shadow-lg text-ui-12 text-tea-text-sec hover:text-tea-text"
        >
          <SettingsIcon size={13} /> Tweaks
        </button>
      )}
      {open && (
        <div className="w-[280px] bg-tea-surface border border-tea-border rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-tea-border">
            <span className="label-caps">Tweaks</span>
            <button
              onClick={() => setOpen(false)}
              className="p-1 text-tea-text-dim hover:text-tea-text"
              aria-label="Close tweaks"
            >
              <X size={14} />
            </button>
          </div>

          <div className="px-4 py-4 space-y-5">
            <div>
              <div className="label-caps text-tea-text-dim mb-2">Mode</div>
              <div className="inline-flex border border-tea-border rounded-md overflow-hidden">
                {(['dark', 'light'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-ui-12 ${
                      mode === m ? 'bg-tea-gold/15 text-tea-text' : 'text-tea-text-sec hover:text-tea-text'
                    }`}
                  >
                    {m === 'dark' ? <Moon size={12} /> : <Sun size={12} />} {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="label-caps text-tea-text-dim mb-2">Accent palette</div>
              <div className="flex items-center gap-2 flex-wrap">
                {ACCENT_OPTIONS.map((o) => (
                  <button
                    key={o.label}
                    onClick={() => setAccent(o.label)}
                    title={o.label}
                    className={`w-7 h-7 rounded-full border ${accent === o.label ? 'ring-2 ring-offset-2 ring-offset-tea-bg' : ''}`}
                    style={{
                      background: `rgb(${o.rgb})`,
                      borderColor: 'rgb(var(--tea-gold-rgb) / 0.4)',
                      boxShadow: accent === o.label ? `0 0 0 2px rgb(${o.rgb} / 0.6)` : undefined,
                    }}
                  />
                ))}
              </div>
              <p className="text-ui-11 text-tea-text-dim mt-2">Selected: {accent}</p>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="label-caps text-tea-text-dim">Type scale</span>
                <span className="font-mono text-ui-11 text-tea-text-sec tabular-nums">{Math.round(fontScale * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.875}
                max={1.125}
                step={0.0125}
                value={fontScale}
                onChange={(e) => setFontScale(parseFloat(e.target.value))}
                className="w-full accent-tea-gold"
              />
            </div>

            <div className="pt-3 border-t border-tea-border">
              <p className="text-ui-11 text-tea-text-dim">
                Changes apply live to <code className="font-mono text-tea-readgold">/design/system</code>. Refresh to reset.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Root export
// ─────────────────────────────────────────────────────────────────────────

export default function DesignSystemShowcase() {
  // Local mode state — bridges between the production .light class and the showcase's mode toggle.
  const [mode, setMode] = useState<'dark' | 'light'>(() => (typeof document !== 'undefined' && document.documentElement.classList.contains('light') ? 'light' : 'dark'));
  const [accent, setAccent] = useState<string>('Aged brass');
  const [fontScale, setFontScale] = useState<number>(1);

  // Track original values so we can restore them when leaving the showcase.
  const originalsRef = useRef<{ classList: string[]; goldRgb: string | null; goldLtRgb: string | null; fontSize: string }>({
    classList: [],
    goldRgb: null,
    goldLtRgb: null,
    fontSize: '',
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    originalsRef.current = {
      classList: Array.from(html.classList),
      goldRgb: html.style.getPropertyValue('--tea-gold-rgb') || null,
      goldLtRgb: html.style.getPropertyValue('--tea-gold-lt-rgb') || null,
      fontSize: html.style.fontSize,
    };
    return () => {
      const orig = originalsRef.current;
      html.classList.remove('light');
      orig.classList.forEach((c) => html.classList.add(c));
      if (orig.goldRgb) html.style.setProperty('--tea-gold-rgb', orig.goldRgb);
      else html.style.removeProperty('--tea-gold-rgb');
      if (orig.goldLtRgb) html.style.setProperty('--tea-gold-lt-rgb', orig.goldLtRgb);
      else html.style.removeProperty('--tea-gold-lt-rgb');
      html.style.fontSize = orig.fontSize;
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('light', mode === 'light');
  }, [mode]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const opt = ACCENT_OPTIONS.find((o) => o.label === accent) ?? ACCENT_OPTIONS[1];
    document.documentElement.style.setProperty('--tea-gold-rgb', opt.rgb);
    document.documentElement.style.setProperty('--tea-gold-lt-rgb', opt.lt);
  }, [accent]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.style.fontSize = `${fontScale * 100}%`;
  }, [fontScale]);

  return (
    <div className="font-body bg-tea-bg text-tea-text min-h-dvh">
      <ShowcaseHeader mode={mode} setMode={setMode} />
      <JumpNav />
      <main className="max-w-6xl mx-auto px-4 md:px-8 py-10">
        <Overview />
        <ColorsSection />
        <TypographySection />
        <SpacingSection />
        <PageChromeSection />
        <TabStripSection />
        <ButtonsSection />
        <PillsSection />
        <SurfacesSection />
        <ZIndexSection />
        <StatesSection />
        <ElevationSection />
        <FormsSection />
        <ModalDrawerSection />
        <SidebarNavSection />
        <IconsSection />
        <AnimationSection />
        <EmptyStatesSection />
        <IdentityCardSection />
        <TeaCardSection />
        <InventoryListSection />
        <OrderTimelineSection />
        <AntiPatternsSection />
      </main>
      <ShowcaseFooter />
      <TweaksPanel mode={mode} setMode={setMode} accent={accent} setAccent={setAccent} fontScale={fontScale} setFontScale={setFontScale} />
    </div>
  );
}
