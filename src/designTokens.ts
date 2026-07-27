/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  TEAJIA DESIGN SYSTEM, "Espresso + Gold"                      ║
 * ║  Single source of truth for all visual decisions.               ║
 * ║                                                                 ║
 * ║  Typography:  Cormorant Garamond · Lora · Plus Jakarta Sans · IBM Plex Mono║
 * ║  Palette:     Warm espresso-and-gold, dark/light via CSS vars   ║
 * ║  Textures:    SVG grain, paper weave, fabric overlay            ║
 * ║  Philosophy:  Editorial calm. Nothing shouts. Everything hums.  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { normalizeTeaType, NON_TEA_TYPES, type TeaType as WisdomTeaType } from './wisdom';

// ─────────────────────────────────────────────────────────────
// 1. TYPOGRAPHY
// ─────────────────────────────────────────────────────────────

/**
 * Font Roles:
 *
 *   DISPLAY   : Cormorant Garamond 400
 *                Article titles, page headings, hero text, card titles.
 *                Old Style serif with warmth and gravitas.
 *
 *   BODY      : Lora 400 (reading), 300 italic (subtitles)
 *                Long-form articles, descriptions, editorial prose.
 *                Calligraphic serif optimized for screen reading.
 *
 *   UI / SANS : Plus Jakarta Sans 300–600
 *                Labels, navigation, tags, buttons, metadata.
 *                Geometric but soft, warmer than Inter, better at small sizes.
 *
 *   MONO      : IBM Plex Mono 400
 *                Prices, weights, hex codes, technical metadata.
 *                Wider and more readable at small sizes than JetBrains Mono.
 *
 *   CHINESE   : Noto Serif SC (body), Ma Shan Zheng (calligraphy)
 *                Chinese product names and tea card watermarks.
 */

export const FONT_STACKS = {
  display: ['Cormorant Garamond', 'Noto Serif SC', 'Georgia', 'serif'],
  body:    ['Lora', 'Noto Serif SC', 'Georgia', 'serif'],
  caption: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
  sans:    ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
  // Mono rebound: Plus Jakarta Sans 500 with tabular-nums.
  // Clean geometric numerals, no dotted zero. The `.num` helper and
  // `font-mono` utility both resolve to this stack; numerics get
  // weight 500 + tabular-nums via the .num class in card-utilities.css.
  mono:    ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  chinese: ['Noto Serif SC', 'serif'],
  chineseCalligraphy: ['Ma Shan Zheng', 'cursive'],
} as const;

export const TYPE_SCALE = {
  /** Page titles, hero headings: Cormorant Garamond 400 (300 hairline strokes broke up in sunlight) */
  display: {
    fontFamily: 'display',
    fontWeight: 400,
    fontSize: 'clamp(32px, 4.8vw, 48px)',
    lineHeight: 1.12,
    letterSpacing: '0.01em',
  },

  /** Section headings: Cormorant Garamond 500 (weight contrast against h1 creates hierarchy) */
  h2: {
    fontFamily: 'display',
    fontWeight: 500,
    fontSize: 'clamp(24px, 3.5vw, 32px)',
    lineHeight: 1.2,
    letterSpacing: '0.01em',
  },

  /** Card titles, drawer headings: Cormorant Garamond 400 (bridges h2→body gap) */
  h3: {
    fontFamily: 'display',
    fontWeight: 400,
    fontSize: '19px',
    lineHeight: 1.3,
    letterSpacing: '0.01em',
  },

  /** Descriptive subtitles, poetic text: Lora 400 italic (300 was too thin on non-retina) */
  subtitle: {
    fontFamily: 'body',
    fontWeight: 400,
    fontStyle: 'italic' as const,
    fontSize: '17px',
    lineHeight: 1.4,
  },

  /** Article text, long-form reading: Lora 400 (tighter leading: 1.7 reduces float) */
  body: {
    fontFamily: 'body',
    fontWeight: 400,
    fontSize: '17px',
    lineHeight: 1.7,
  },

  /** Captions, secondary text: Lora 400 (300 was too thin on non-retina / outdoors) */
  bodyLight: {
    fontFamily: 'body',
    fontWeight: 400,
    fontSize: '15px',
    lineHeight: 1.65,
  },

  /** Tags, categories, metadata: Plus Jakarta Sans 400 uppercase (11px, tighter tracking) */
  label: {
    fontFamily: 'sans',
    fontWeight: 400,
    fontSize: '11px',
    lineHeight: 1.4,
    letterSpacing: '1.2px',
    textTransform: 'uppercase' as const,
  },

  /** Nav items, section headers: Plus Jakarta Sans 400 uppercase */
  nav: {
    fontFamily: 'sans',
    fontWeight: 400,
    fontSize: '12px',
    lineHeight: 1.4,
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
  },

  /** Interactive text, buttons: Plus Jakarta Sans 400 */
  link: {
    fontFamily: 'sans',
    fontWeight: 400,
    fontSize: '14px',
    letterSpacing: '0.2px',
  },

  /** Prices, hex codes, specs: IBM Plex Mono 400 (11px, wider and more readable) */
  mono: {
    fontFamily: 'mono',
    fontWeight: 400,
    fontSize: '11px',
  },
} as const;

/** Tailwind class presets for common typography patterns */
export const TYPOGRAPHY_CLASSES = {
  h1:        'font-display text-[clamp(32px,4.8vw,48px)] font-normal leading-[1.12] tracking-[0.01em]',
  h2:        'font-display text-[clamp(24px,3.5vw,32px)] font-medium leading-[1.2] tracking-[0.01em]',
  h3:        'font-display text-[19px] font-normal leading-[1.3] tracking-[0.01em]',
  subtitle:  'font-body text-ui-17 font-normal italic leading-[1.4]',
  body:      'font-body text-ui-17 font-normal leading-[1.7]',
  bodyLight: 'font-body text-ui-15 font-normal leading-[1.65]',
  label:     'font-sans text-ui-11 font-normal uppercase tracking-[1.2px] leading-[1.4]',
  nav:       'font-sans text-ui-12 font-normal uppercase tracking-[1px] leading-[1.4]',
  link:      'font-sans text-ui-14 font-normal tracking-[0.2px]',
  mono:      'font-mono text-ui-11 font-normal',
  // Sidebar nav: Adrian feedback: 15/13 was too small, lifted to 17/15.
  // Group labels (BROWSE / MANAGE / CURATE micro-caps) are sans 10 semibold.
  navSidebar:      'font-display text-ui-17 font-medium tracking-[0.04em] leading-[1.3]',
  navSidebarChild: 'font-display text-ui-15 font-normal tracking-[0.04em] leading-[1.3]',
  navSidebarGroup: 'font-sans text-ui-10 font-semibold uppercase tracking-[0.18em] leading-[1.3]',
  accountMeta:     'font-sans text-ui-12 font-normal tracking-[0.04em] leading-[1.3]',
} as const;

export const FONT_SIZES = {
  xs:   '0.75rem',     // 12px
  sm:   '0.875rem',    // 14px
  base: '1rem',        // 16px
  lg:   '1.125rem',    // 18px
  xl:   '1.25rem',     // 20px
  '2xl': '1.5rem',     // 24px
  '3xl': '1.875rem',   // 30px
  '4xl': '2.25rem',    // 36px
  '5xl': '3rem',       // 48px
} as const;

/**
 * UI text scale, named pixel stops for high-frequency UI sizes.
 * Each stop maps directly to its pixel value, producing utility classes
 * like `text-ui-10` → font-size: 10px. Use these instead of arbitrary
 * `text-[Npx]` for any value that has a defined stop.
 */
export const UI_TEXT_SCALE = {
  'ui-8':  '8px',
  'ui-9':  '9px',
  'ui-10': '10px',
  'ui-11': '11px',
  'ui-12': '12px',
  'ui-13': '13px',
  'ui-14': '14px',
  'ui-15': '15px',
  'ui-16': '16px',
  'ui-17': '17px',
  'ui-20': '20px',
  'ui-26': '26px',
  'ui-28': '28px',
} as const;

export const FONT_WEIGHTS = {
  light:    300,
  normal:   400,
  medium:   500,
  semibold: 600,
  bold:     700,
} as const;

export const LINE_HEIGHTS = {
  tight:   '1.12',    // Display headings
  snug:    '1.2',     // H2 headings
  normal:  '1.4',     // Subtitles, labels
  relaxed: '1.625',   // UI text
  loose:   '1.65',    // Body light (captions)
  reading: '1.7',     // Body / article text
} as const;

/**
 * Letter-spacing scale. Editorial typography lives in the 0.01em–0.04em range
 * for headings; uppercase labels and nav use wider tracking (0.1em–0.2em).
 * Phase C will migrate the ~30 arbitrary `tracking-[Xem]` sites onto this scale.
 */
export const LETTER_SPACING = {
  tighter: '-0.02em',  // Display headlines that need optical tightening
  tight:   '-0.01em',  // Large display, slightly tightened
  normal:  '0',        // Body default
  wide:    '0.01em',   // Headings (h1, h2, h3)
  wider:   '0.04em',   // Sidebar nav, account meta
  widest:  '0.1em',    // Uppercase labels (loose)
  caps:    '0.15em',   // Uppercase eyebrow labels
  display: '0.2em',    // Spaced caps for editorial display
} as const;

/**
 * Backdrop-blur scale. Tailwind's defaults cover most cases; this is here so
 * future audits don't re-introduce the missing-scale finding when components
 * reach for arbitrary `backdrop-blur-[Xpx]` values.
 */
export const BACKDROP_BLUR = {
  none: '0',
  sm:   '4px',
  base: '8px',
  md:   '12px',
  lg:   '16px',
  xl:   '24px',
} as const;


// ─────────────────────────────────────────────────────────────
// 1b. Z-INDEX SCALE
// ─────────────────────────────────────────────────────────────

/**
 * Semantic z-index scale. Every layered element must use one of these
 * values (via Tailwind `z-base` … `z-priority` utilities or the JS constant).
 *
 * The scale is intentionally compact (0–60) so that stacking conflicts
 * are obvious. NEVER use arbitrary `z-[NNN]` values.
 */
export const Z_INDEX = {
  base: 0,        // Normal content flow
  dropdown: 10,   // Dropdowns, tooltips, popovers
  sticky: 20,     // Sticky headers, bottom tab bar, floating action buttons
  overlay: 30,    // Backdrop overlays (dim background)
  drawer: 35,     // Side drawers, cart panel
  modal: 40,      // Modal dialogs
  toast: 50,      // Toast notifications (above modals)
  priority: 60,   // Skip links, critical accessibility UI
} as const;


// ─────────────────────────────────────────────────────────────
// 2. COLOR PALETTE, "Espresso + Gold"
// ─────────────────────────────────────────────────────────────

/**
 * At runtime, colors switch via CSS custom properties (--tea-*).
 * These are the canonical hex/rgba values for each mode.
 *
 * CSS Variables (set on :root):
 *   --tea-bg, --tea-surface, --tea-elevated,
 *   --tea-text, --tea-text-sec, --tea-text-dim,
 *   --tea-gold, --tea-gold-lt,
 *   --tea-border, --tea-accent-sub
 */

export const COLORS = {
  dark: {
    bg:        '#1a1714',                  // Cooler espresso, reduced yellow undertone
    surface:   '#2a2622',                  // Primary surface, cards, panels
    elevated:  '#3a3530',                  // Elevated surfaces, modals, popovers
    text:      '#ede4d4',                  // Primary text, cream white
    textSec:   '#cdc0a8',                  // Secondary text: RAISED floor for outdoor legibility (was #b5a892)
    textDim:   '#80735f',                  // Dimmed text, labels, captions
    gold:      '#a8874d',                  // Structural accent, primary buttons, active borders, focus rings
    goldLt:    '#bfa06a',                  // Light gold, hover states, highlights
    readGold:  '#a8874d',                  // Reading gold, pinned for text (type token names, eyebrow markers, inline code, hover links)
    border:    'rgba(168,135,77,0.08)',    // Subtle gold borders, derived from tea-gold-rgb @ 8%
    accentSub: 'rgba(168,135,77,0.10)',    // Subtle gold backgrounds, derived from tea-gold-rgb @ 10%
    error:     '#c46a5a',                  // Warm terracotta, reds that read on espresso (was #8a3a32 oxblood)
    leaf:      '#5a6e5a',                  // Success only, never decorative
  },
  light: {
    bg:        '#f4ece0',                  // Warm parchment, page background
    surface:   '#e6dbcc',                  // Tinted surface, cards, panels
    elevated:  '#d5c8b4',                  // Elevated surfaces
    text:      '#18130e',                  // Dark espresso text
    textSec:   '#443a2c',                  // Secondary text: RAISED floor (was #5e5342)
    textDim:   '#9a8c78',                  // Dimmed text
    gold:      '#8e6d2e',                  // Darker gold for light backgrounds
    goldLt:    '#a88340',                  // Light gold variant
    readGold:  '#8e6d2e',                  // Reading gold, pinned for text
    border:    'rgba(142,109,46,0.1)',     // Warm borders
    accentSub: 'rgba(142,109,46,0.07)',    // Subtle accent backgrounds
    error:     '#732a23',                  // Muted oxblood (works on parchment)
    leaf:      '#4a5e4a',                  // Success only
  },
} as const;

/** Utility color aliases, not for component className use */
export const UTIL_COLORS = {
  'tea-green':    '#5A6E5A',
  'tea-moss':     '#2A3430',
  'tea-shadow':   'rgba(0,0,0,0.15)',
} as const;


// ─────────────────────────────────────────────────────────────
// 3. TEA TYPE COLORS
// ─────────────────────────────────────────────────────────────

/**
 * Every tea type has two color sets:
 *   - card:  Muted, sophisticated tones for card badges/accents on dark backgrounds
 *   - vivid: Brighter values for SVG illustrations and light-background contexts
 */

type ColorSet = { card: string; vivid: string };

// Typed against the wisdom base's TeaType so a missing or extra key is a compile
// error. 'Teaware' and 'Misc' are the wisdom base's NON_TEA_TYPES, not teas,
// but the same product records carry them.
export const TEA_TYPE_COLORS: Record<WisdomTeaType | typeof NON_TEA_TYPES[number], ColorSet> = {
  Green:   { card: '#859F85', vivid: '#86efac' },
  Yellow:  { card: '#D4C586', vivid: '#fde047' },
  White:   { card: '#D6D3CD', vivid: '#e5e5e5' },
  Oolong:  { card: '#C4A484', vivid: '#6ee7b7' },
  Red:     { card: '#A67B70', vivid: '#fda4af' },
  Dark:    { card: '#8B8C89', vivid: '#a8a29e' },
  Shou:    { card: '#5C544E', vivid: '#78716c' },
  Sheng:   { card: '#98A67B', vivid: '#bef264' },
  Herbal:  { card: '#BFA09E', vivid: '#f9a8d4' },
  Teaware: { card: '#C4A484', vivid: '#fdba74' },
  Misc:    { card: '#737373', vivid: '#a3a3a3' },
};

export type TeaType = keyof typeof TEA_TYPE_COLORS;

// Kept for reference/back-compat call sites that pass a raw stored value:
// dialects (e.g. 'Black') resolve to their canonical wisdom type before lookup.
const resolveColorKey = (type: string): TeaType => (normalizeTeaType(type) ?? type) as TeaType;

/** Get the card-appropriate color for a tea type. Accepts any historical dialect. */
export const getTeaColor = (type: string): string =>
  TEA_TYPE_COLORS[resolveColorKey(type)]?.card ?? '#737373';

/** Get the vivid/illustration color for a tea type. Accepts any historical dialect. */
export const getTeaVividColor = (type: string): string =>
  TEA_TYPE_COLORS[resolveColorKey(type)]?.vivid ?? '#a3a3a3';


// ─────────────────────────────────────────────────────────────
// 4. ALCOVE CARD PALETTE
// ─────────────────────────────────────────────────────────────

/**
 * The Alcove card is the premium product display component.
 * It uses the main Espresso+Gold palette: NOT its own color system.
 * The textures, gradients, and processing are Alcove-specific,
 * but the base colors come from the shared palette.
 *
 * These map to --alcove-* CSS variables with main palette fallbacks.
 */

export const ALCOVE_COLORS = {
  bg:            '#18130e',   // --tea-bg
  title:         '#ede4d4',   // --tea-text
  subtitle:      '#80735f',   // --tea-text-dim
  body:          '#b5a892',   // --tea-text-sec
  bodyHighlight: '#ede4d4',   // --tea-text
  note:          '#b5a892',   // --tea-text-sec
  accent:        '#a8874d',   // --tea-gold
  muted:         '#80735f',   // --tea-text-dim
  mutedDark:     '#80735f',   // --tea-text-dim
  success:       '#5A6E5A',   // --tea-green
} as const;


// ─────────────────────────────────────────────────────────────
// 5. GRADIENTS
// ─────────────────────────────────────────────────────────────

export const GRADIENTS = {
  /** Subtle top warmth for card surfaces */
  cardWarmth: 'radial-gradient(ellipse 100% 80% at 50% 0%, rgba(184, 146, 78, 0.03) 0%, transparent 60%)',

  /** Inset panel highlight, recessed alcove feel */
  insetHighlight: 'radial-gradient(ellipse 80% 40% at 70% 0%, rgba(200, 170, 120, 0.04), transparent)',

  /** Light mode inset variant */
  insetHighlightLight: 'radial-gradient(ellipse 80% 40% at 70% 0%, rgba(142, 109, 46, 0.03), transparent)',

  /** Warm section divider, replaces flat border-top */
  divider: 'linear-gradient(90deg, transparent, rgba(184, 146, 78, 0.2) 20%, rgba(184, 146, 78, 0.3) 50%, rgba(184, 146, 78, 0.2) 80%, transparent)',

  /** Sidebar background */
  sidebar: 'linear-gradient(180deg, var(--tea-surface) 0%, rgba(24,19,14,0.95) 100%)',

  /** Pull quote left accent */
  pullQuote: 'linear-gradient(90deg, rgba(184, 146, 78, 0.04) 0%, transparent 80%)',

  /** Image overlays for photo essays and cards */
  imageSheen: 'linear-gradient(90deg, transparent, rgba(200,170,120,0.08), transparent)',

  /** Alcove card top warmth, the signature glow */
  alcoveWarmth: 'radial-gradient(ellipse 70% 50% at 85% 8%, rgba(180,120,40,0.09), transparent)',
  alcoveWarmthSecondary: 'radial-gradient(ellipse 50% 40% at 90% 0%, rgba(200,140,50,0.05), transparent)',

  /** Alcove photo mask, horizontal and vertical fades */
  alcovePhotoMaskH: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.02) 15%, rgba(0,0,0,0.08) 30%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.5) 70%, black 90%)',
  alcovePhotoMaskV: 'linear-gradient(to bottom, black 85%, transparent 100%)',

  /** Alcove slider fill */
  alcoveSlider: 'linear-gradient(90deg, rgba(184,146,78,0.45), rgba(184,146,78,0.75))',
} as const;


// ─────────────────────────────────────────────────────────────
// 6. TEXTURES
// ─────────────────────────────────────────────────────────────

/**
 * SVG-based noise and weave patterns applied as background-image.
 * These create the tactile, paper-like feel of the interface.
 *
 * CSS classes:
 *   .texture-overlay  → Full-page grain at opacity 0.06 (fixed position)
 *   .grain-texture    → Multiply-blend grain for surfaces
 *   .fabric-texture   → Subtle linen weave pattern
 *   bg-paper-texture  → Tailwind utility for paper feel
 */

export const TEXTURES = {
  /** Full-page noise overlay, fractalNoise 0.65, 4 octaves, opacity 0.06 */
  grainOverlay: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,

  /** Denser grain for surfaces, fractalNoise 0.55, 5 octaves, multiply blend */
  surfaceGrain: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='5' stitchTiles='stitch' seed='2'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)'/%3E%3C/svg%3E")`,

  /** Fine grain for Alcove card inset panels, 0.85 base, 4 octaves, 120px tile */
  alcoveGrain: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,

  /** Paper weave, crossing horizontal and vertical fine lines */
  paperTexture: `repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(180, 165, 140, 0.03) 1px, rgba(180, 165, 140, 0.03) 2px), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(180, 165, 140, 0.02) 2px, rgba(180, 165, 140, 0.02) 3px)`,

  /** Fabric / linen weave, warm thread pattern */
  fabricTexture: `repeating-linear-gradient(90deg, rgba(200,170,120,0.03) 0px, rgba(200,170,120,0.03) 1px, transparent 1px, transparent 4px), repeating-linear-gradient(0deg, rgba(200,170,120,0.03) 0px, rgba(200,170,120,0.03) 1px, transparent 1px, transparent 4px)`,
} as const;

/** How textures are applied in CSS */
export const TEXTURE_USAGE = {
  grainOverlay: { opacity: 0.06, position: 'fixed', zIndex: 1, pointerEvents: 'none' },
  surfaceGrain: { blendMode: 'multiply' },
  alcoveGrain:  { opacity: 0.05, backgroundSize: '120px' },
  insetGrain:   { opacity: 0.08, backgroundSize: '120px' },
} as const;


// ─────────────────────────────────────────────────────────────
// 7. SHADOWS
// ─────────────────────────────────────────────────────────────

export const SHADOWS = {
  sm:   '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  base: '0 1px 3px rgba(0,0,0,0.3)',
  md:   '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  lg:   '0 8px 20px rgba(0,0,0,0.4)',
  xl:   '0 20px 25px -5px rgb(0 0 0 / 0.1)',

  /** Card grid item resting state */
  card: '0 1px 4px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.12), inset 0 1px 0 rgba(184,146,78,0.05)',

  /** Card grid item hover */
  cardHover: '0 6px 16px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(184,146,78,0.08)',

  /** Inset panel, alcove-inspired recessed surface */
  insetPanel: 'inset 0 1px 0 rgba(200,170,120,0.06), inset 0 -1px 0 rgba(200,170,120,0.03), 0 -1px 0 rgba(200,170,120,0.05)',

  /** Light mode inset panel */
  insetPanelLight: 'inset 0 1px 0 rgba(142,109,46,0.08), inset 0 -1px 0 rgba(142,109,46,0.04), 0 -1px 0 rgba(142,109,46,0.06)',

  /** Sidebar edge lighting */
  sidebar: 'inset -1px 0 0 rgba(200,170,120,0.06), 1px 0 8px rgba(0,0,0,0.15)',

  /** Focus ring (keyboard navigation) */
  focusRing: '0 0 0 4px var(--tea-accent-sub)',
} as const;


// ─────────────────────────────────────────────────────────────
// 8. SPACING
// ─────────────────────────────────────────────────────────────

export const SPACING = {
  xs:   '0.25rem',   // 4px
  sm:   '0.5rem',    // 8px
  md:   '1rem',      // 16px
  lg:   '1.5rem',    // 24px
  xl:   '2rem',      // 32px
  '2xl': '3rem',     // 48px
  '3xl': '4rem',     // 64px
} as const;


// ─────────────────────────────────────────────────────────────
// 9. BORDER RADIUS
// ─────────────────────────────────────────────────────────────

export const BORDER_RADIUS = {
  none: '0px',
  sm:   '0.125rem',   // 2px , subtle rounding
  base: '0.25rem',    // 4px
  md:   '0.375rem',   // 6px , inset panels
  lg:   '0.5rem',     // 8px
  xl:   '0.75rem',    // 12px
  '2xl': '0.875rem',  // 14px, cards
  '3xl': '1.125rem',  // 18px, large panels, modals
  full: '9999px',     // pills, tags, avatars
} as const;


// ─────────────────────────────────────────────────────────────
// 10. ANIMATION
// ─────────────────────────────────────────────────────────────

export const TIMING = {
  micro:    '150ms',  // Hover states, badges, small feedback
  standard: '300ms',  // Transitions, modals, buttons
  emphasis: '500ms',  // Page transitions, image reveals, color mode
} as const;

export const EASING = {
  default:  'cubic-bezier(0.4, 0, 0.2, 1)',   // Tailwind default
  easeOut:  'ease-out',                         // Most animations
  spring:   'cubic-bezier(0.34, 1.56, 0.64, 1)', // Playful bounce (use sparingly)
} as const;

export const KEYFRAMES = {
  fadeIn: {
    '0%':   { opacity: '0' },
    '100%': { opacity: '1' },
  },
  slideIn: {
    '0%':   { transform: 'scaleX(0)', transformOrigin: 'left' },
    '100%': { transform: 'scaleX(1)', transformOrigin: 'left' },
  },
  slideInWidth: {
    '0%':   { width: '0' },
    '100%': { width: '100%' },
  },
  slideUp: {
    '0%':   { transform: 'translateY(100%)', opacity: '0' },
    '100%': { transform: 'translateY(0)', opacity: '1' },
  },
  scaleIn: {
    '0%':   { opacity: '0', transform: 'scale(0.95)' },
    '100%': { opacity: '1', transform: 'scale(1)' },
  },
  revealUp: {
    '0%':   { opacity: '0', transform: 'translateY(16px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' },
  },
  shimmer: {
    '0%':   { transform: 'translateX(-100%)' },
    '100%': { transform: 'translateX(200%)' },
  },
  panelReveal: {
    '0%':   { opacity: '0', transform: 'translateY(4px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' },
  },
} as const;

export const ANIMATIONS = {
  fadeIn:       'fadeIn 0.5s ease-out',
  slideIn:      'slideIn 0.3s ease-out',
  slideInWidth: 'slideInWidth 0.3s ease-out',
  slideUp:      'slideUp 0.4s ease-out',
  scaleIn:      'scaleIn 0.2s ease-out',
  revealUp:     'revealUp 0.5s ease-out forwards',
  shimmer:      'shimmer 1.5s infinite',
  panelReveal:  'panelReveal 0.3s ease-out',
} as const;


// ─────────────────────────────────────────────────────────────
// 11. ICON GUIDANCE
// ─────────────────────────────────────────────────────────────

/**
 * Icon library: lucide-react (both public and admin)
 *
 * Style rules:
 *   - Stroke weight:  1.5 (default lucide), clean but not hairline
 *   - Navigation:     18–22px
 *   - Inline w/ text: 14–16px
 *   - Aesthetic:      Geometric and minimal. No rounded/playful/heavy styles.
 *   - Color:          Inherit from text color. Active state uses --tea-gold.
 *   - The icons should feel like they were drawn with a fine pen,
 *     matching the delicacy of Lora at light weights.
 */

export const ICON_SIZES = {
  inline: { width: 14, height: 14 },
  small:  { width: 16, height: 16 },
  nav:    { width: 18, height: 18 },
  navLg:  { width: 22, height: 22 },
} as const;


// ─────────────────────────────────────────────────────────────
// 12. SURFACE TREATMENTS, "The Alcove System"
// ─────────────────────────────────────────────────────────────

/**
 * The Alcove texture system is the STANDARD surface treatment for
 * panels, drawers, modals, and any container that needs atmospheric depth.
 *
 * It consists of layered effects applied via CSS classes (see card-utilities.css):
 *
 *   .surface-warm       : Primary panel surface
 *                           Layers: radial warmth gradient + grain noise overlay
 *                           Use on: drawers, sidebars, full-panel backgrounds
 *
 *   .surface-warm-inset : Recessed content area within a .surface-warm panel
 *                           Layers: darkened bg + edge-lit inset shadows +
 *                                   denser grain + ambient top-glow
 *                           Use on: content areas, scrollable regions, form sections
 *
 * The system creates tactile, editorial depth without relying on borders or
 * heavy shadows. Everything is warm-toned, never white, never cold.
 *
 * Example structure:
 *   <div class="surface-warm">           ← Drawer/panel shell
 *     <header>...</header>
 *     <div class="surface-warm-inset">   ← Recessed content area
 *       ...scrollable content...
 *     </div>
 *     <footer>...</footer>
 *   </div>
 */

/* =====================================================
   §12: SURFACE_TREATMENTS
   The full Alcove texture system.
   Canonical values for both dark and light modes.
   Source of truth: src/components/shop/AlcoveCard.tsx
   ===================================================== */

export const SURFACE_TREATMENTS = {
  /** Alcove card-level colors (CSS custom-prop with fallback) */
  alcoveColors: {
    bg:            'var(--alcove-bg, #1c1b19)',
    title:         'var(--alcove-title, #ede6d8)',
    subtitle:      'var(--alcove-subtitle, #8a7e6a)',
    body:          'var(--alcove-body, #c0b49a)',
    bodyHighlight: 'var(--alcove-body-highlight, #d0c4aa)',
    note:          'var(--alcove-note, #c4b89a)',
    accent:        'var(--alcove-accent, #b5651d)',
    muted:         'var(--alcove-muted, #9a9080)',
    mutedDark:     'var(--alcove-muted-dark, #6a6050)',
    success:       'var(--alcove-success, #7a9a72)',
  },

  /** Warm bronze palette used for all transparency-based treatments.
   *  Base RGB: 200,170,120, the single source for dividers, glows, borders. */
  warmBronze: {
    rgb: '200,170,120',
    divider:    'rgba(200,170,120,0.08)',
    border:     'rgba(200,170,120,0.06)',
    borderHover:'rgba(200,170,120,0.20)',
    glow:       'rgba(200,170,120,0.04)',
    scrollbar:  'rgba(200,170,120,0.15)',
    tagBg:      'rgba(200,170,120,0.03)',
  },

  /** Card frame, outermost wrapper */
  cardFrame: {
    background: 'var(--tea-surface)',
    border: '1px solid var(--tea-border)',
    borderRadius: 8,
    boxShadow: '0 2px 8px rgba(0,0,0,0.15), 0 0 0 1px rgba(200,170,120,0.06)',
  } as React.CSSProperties,

  /** Recessed panel, darkened inset used for content sections
   *  (The Process, Offerings table, story text area) */
  recessedPanel: {
    background: 'rgba(0,0,0,0.25)',
    boxShadow: 'inset 0 1px 0 rgba(200,170,120,0.06), inset 0 -1px 0 rgba(200,170,120,0.04), 0 -1px 0 rgba(200,170,120,0.06)',
    borderRadius: 6,
  } as React.CSSProperties,

  /** Image inset, recessed treatment for hero/product photos */
  imageInset: {
    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3), inset 0 -1px 0 rgba(200,170,120,0.06)',
  } as React.CSSProperties,

  /** Radial warmth, ambient light overlay placed behind content.
   *  Two radial ellipses at top-right create a soft glow. */
  radialWarmth: {
    position: 'absolute' as const,
    inset: 0,
    pointerEvents: 'none' as const,
    background: `
      radial-gradient(ellipse 70% 50% at 85% 8%, rgba(180,120,40,0.09) 0%, transparent 60%),
      radial-gradient(ellipse 50% 40% at 90% 0%, rgba(200,140,50,0.05) 0%, transparent 50%)
    `,
  } as React.CSSProperties,

  /** Fine grain texture: SVG fractal noise overlay.
   *  Applied at card-level and panel-level with different opacities. */
  grainTexture: {
    card: {
      position: 'absolute' as const,
      inset: 0,
      pointerEvents: 'none' as const,
      opacity: 0.06,
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      backgroundSize: '120px',
    } as React.CSSProperties,
    panel: {
      position: 'absolute' as const,
      inset: 0,
      pointerEvents: 'none' as const,
      opacity: 0.08,
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      backgroundSize: '120px',
    } as React.CSSProperties,
  },

  /** Ambient top glow, radial gradient at top of recessed panels */
  ambientGlow: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    pointerEvents: 'none' as const,
    background: 'radial-gradient(ellipse 80% 30% at 70% 0%, rgba(200,170,120,0.04), transparent)',
  } as React.CSSProperties,

  /** Scroll fade gradients, mask content overflow at edges */
  scrollFade: {
    top: {
      position: 'absolute' as const,
      top: 0, left: 0, right: 0,
      height: 20,
      background: 'linear-gradient(to bottom, rgba(0,0,0,0.25), transparent)',
      pointerEvents: 'none' as const,
      zIndex: 1,
      borderRadius: '6px 6px 0 0',
    } as React.CSSProperties,
    bottom: {
      position: 'absolute' as const,
      bottom: 0, left: 0, right: 0,
      height: 20,
      background: 'linear-gradient(to top, rgba(0,0,0,0.25), transparent)',
      pointerEvents: 'none' as const,
      zIndex: 1,
    } as React.CSSProperties,
  },

  /** Commerce section, pinned bottom area */
  commerceBar: {
    borderTop: '1px solid rgba(200,170,120,0.06)',
    background: 'var(--alcove-bg, #1c1b19)',
  },

  /** Price tag recessed background */
  priceTag: {
    background: 'rgba(200,170,120,0.03)',
    borderRadius: 3,
  } as React.CSSProperties,

  /** Button outline (Save / Share) */
  buttonOutline: {
    border: '1px solid rgba(200,170,120,0.2)',
    borderRadius: 3,
  } as React.CSSProperties,

  /** Image mask, dual-layer gradient for hero photo fade-in */
  imageMask: {
    WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.12) 25%, rgba(0,0,0,0.3) 45%, rgba(0,0,0,0.55) 60%, black 85%, black 100%), linear-gradient(to bottom, black 85%, transparent 100%)",
    WebkitMaskComposite: 'destination-in' as const,
    maskImage: "linear-gradient(to right, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.12) 25%, rgba(0,0,0,0.3) 45%, rgba(0,0,0,0.55) 60%, black 85%, black 100%), linear-gradient(to bottom, black 85%, transparent 100%)",
    maskComposite: 'intersect',
  } as React.CSSProperties,
} as const;


// ─────────────────────────────────────────────────────────────
// 13. COMPONENT PATTERNS
// ─────────────────────────────────────────────────────────────

/**
 * Common component styling patterns for reference.
 * Not used programmatically, documentation for consistency.
 *
 * IMPORTANT: Never use white (#fff, rgba(255,255,255,*)) for borders,
 * rings, glows, or backgrounds. Use warm palette tones instead:
 *   - Borders/rings: --tea-border or --tea-text-dim at low opacity
 *   - Backgrounds: --tea-surface or --tea-elevated
 *   - Glows: rgba(200,170,120,0.1), the warm accent glow
 *   - Spinners: border-t color should be --tea-text-sec, not white
 *
 * CARDS (card-grid-item):
 *   - Background: cardWarmth gradient + var(--tea-surface)
 *   - Shadow: SHADOWS.card → SHADOWS.cardHover on hover
 *   - Border radius: 1px (intentionally minimal)
 *   - Transform: translateY(-3px) scale(1.01) on hover
 *   - Image: aspect-ratio 1/1, opacity 0.9 → 1 on hover, scale(1.06)
 *   - Title: font-display (Cormorant Garamond), color transitions to --tea-gold on hover
 *   - Price: .num class (IBM Plex Mono, tabular-nums)
 *
 * SURFACE TREATMENTS (see §12):
 *   - .surface-warm: Radial warmth gradient + grain noise, use on all panels/drawers
 *   - .surface-warm-inset: Recessed content area with edge lighting + denser grain
 *   - These classes replace ad-hoc texture layering throughout the site
 *
 * INSET PANELS (.inset-panel):
 *   - Background: insetHighlight gradient + rgba(0,0,0,0.15)
 *   - Shadow: SHADOWS.insetPanel
 *   - Border radius: 6px
 *   - Grain overlay: alcoveGrain at 0.05 opacity
 *
 * TAGS / PILLS:
 *   - Font: Inter 400, 10px, uppercase, 2px tracking
 *   - Border: 1px solid --tea-border (inactive) or gold+50% alpha (active)
 *   - Border radius: full (pill)
 *   - Padding: 5px 14px
 *
 * LINKS / CTAs:
 *   - Font: Inter 400, 13px, 0.3px tracking
 *   - Color: --tea-gold
 *   - Border-bottom: 1px solid --tea-gold
 *
 * PULL QUOTES:
 *   - Border-left: 3px solid --tea-gold
 *   - Background: pullQuote gradient
 *   - Font: body italic
 *   - Color: --tea-text-sec
 *
 * DROP CAPS:
 *   - Font-size: 2.5em, weight: 700, float: left
 *   - Color: --tea-gold
 *
 * ARTICLE BODY (.article-body):
 *   - Line-height: 1.85
 *   - Letter-spacing: 0.2px
 *   - Paragraph margin-bottom: 1.5rem
 *   - Section break: 1px height, --tea-border color, 3rem vertical margin
 *
 * SCROLLBARS:
 *   - Thumb: rgba(200,170,120,0.15)
 *   - Width: 3px (tea card), 6px (desktop hover)
 *   - Border-radius: 2–3px
 *   - Track: transparent
 *
 * FOCUS STATES:
 *   - Outline: 2px solid --tea-gold, offset 2px
 *   - Box-shadow: SHADOWS.focusRing
 */


// ─────────────────────────────────────────────────────────────
// 13. ACCESSIBILITY
// ─────────────────────────────────────────────────────────────

/**
 * Reduced motion: All animations collapse to 0.01ms.
 * Applied via @media (prefers-reduced-motion: reduce) in index.html.
 *
 * Focus visible: 2px gold outline + 2px offset on all focusable elements.
 *
 * Skip link: .sr-only → visible on focus, positioned top-left,
 * styled with --tea-gold background.
 *
 * Color contrast targets:
 *   Dark mode:  #ede4d4 on #18130e = 13.3:1 (AAA)
 *               #b5a892 on #18130e = 6.7:1  (AA)
 *               #a8874d on #18130e = 5.2:1  (AA)
 *   Light mode: #18130e on #f4ece0 = 13.3:1 (AAA)
 *               #5e5342 on #f4ece0 = 6.1:1  (AA)
 *               #8e6d2e on #f4ece0 = 4.7:1  (AA for large text)
 */


// ─────────────────────────────────────────────────────────────
// COMBINED EXPORT (for backward compatibility)
// ─────────────────────────────────────────────────────────────

export const DESIGN_TOKENS = {
  fontFamily: {
    display: FONT_STACKS.display,
    serif:   FONT_STACKS.body,
    body:    FONT_STACKS.body,
    caption: FONT_STACKS.caption,
    sans:    FONT_STACKS.sans,
    mono:    FONT_STACKS.mono,
  },
  typeScale:       TYPE_SCALE,
  typography:      TYPOGRAPHY_CLASSES,
  fontSize:        FONT_SIZES,
  uiTextScale:     UI_TEXT_SCALE,
  fontWeight:      FONT_WEIGHTS,
  lineHeight:      LINE_HEIGHTS,
  letterSpacing:   LETTER_SPACING,
  backdropBlur:    BACKDROP_BLUR,
  transitionDuration: TIMING,
  colors:          COLORS,
  teaTypeColors:   TEA_TYPE_COLORS,
  alcoveColors:    ALCOVE_COLORS,
  gradients:       GRADIENTS,
  textures:        TEXTURES,
  shadows:         SHADOWS,
  surfaceTreatments: SURFACE_TREATMENTS,
  spacing:         SPACING,
  borderRadius:    BORDER_RADIUS,
  timing:          TIMING,
  easing:          EASING,
  keyframes:       KEYFRAMES,
  animations:      ANIMATIONS,
  iconSizes:       ICON_SIZES,
  zIndex:          Z_INDEX,
  backgroundImage: { 'paper-texture': TEXTURES.paperTexture },
} as const;

// Font Theme Presets for testing and customization
export const FONT_THEMES = {
  default: {
    name: 'Default (Cormorant Garamond + Lora)',
    display: FONT_STACKS.display,
    serif: FONT_STACKS.body,
    sans: FONT_STACKS.sans,
    mono: FONT_STACKS.mono,
  },
  georgia: {
    name: 'Georgia Classic',
    display: ['Georgia', 'serif'],
    serif: ['Georgia', 'serif'],
    sans: ['Arial', 'sans-serif'],
    mono: ['Courier New', 'monospace'],
  },
  modern: {
    name: 'Modern (System)',
    display: ['Georgia', 'serif'],
    serif: ['Georgia', 'serif'],
    sans: ['system-ui', 'sans-serif'],
    mono: ['monospace'],
  },
} as const;

// Font Size Scales for proportional sizing
export const FONT_SIZE_SCALES = {
  compact:     { name: 'Compact (90%)',      multiplier: 0.9 },
  default:     { name: 'Default (100%)',      multiplier: 1.0 },
  comfortable: { name: 'Comfortable (110%)', multiplier: 1.1 },
  large:       { name: 'Large (120%)',        multiplier: 1.2 },
  xlarge:      { name: 'Extra Large (130%)',  multiplier: 1.3 },
} as const;

export type DesignTokens = typeof DESIGN_TOKENS;
