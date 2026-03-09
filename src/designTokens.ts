/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  TEAJIA DESIGN SYSTEM — "Espresso + Gold"                      ║
 * ║  Single source of truth for all visual decisions.               ║
 * ║                                                                 ║
 * ║  Typography:  Vollkorn · Lora · Inter · JetBrains Mono          ║
 * ║  Palette:     Warm espresso-and-gold, dark/light via CSS vars   ║
 * ║  Textures:    SVG grain, paper weave, fabric overlay            ║
 * ║  Philosophy:  Editorial calm. Nothing shouts. Everything hums.  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ─────────────────────────────────────────────────────────────
// 1. TYPOGRAPHY
// ─────────────────────────────────────────────────────────────

/**
 * Font Roles:
 *
 *   DISPLAY    — Vollkorn 400
 *                Article titles, page headings, hero text, card titles.
 *                Old Style serif with warmth and gravitas.
 *
 *   BODY       — Lora 400 (reading), 300 italic (subtitles)
 *                Long-form articles, descriptions, editorial prose.
 *                Calligraphic serif optimized for screen reading.
 *
 *   UI / SANS  — Inter 300–500
 *                Labels, navigation, tags, buttons, metadata.
 *                Neutral, screen-first. Invisible when it should be.
 *
 *   MONO       — JetBrains Mono 400
 *                Prices, weights, hex codes, technical metadata.
 *                Tabular nums, lining figures for clean alignment.
 *
 *   CHINESE    — Noto Serif SC (body), Ma Shan Zheng (calligraphy)
 *                Chinese product names and tea card watermarks.
 */

export const FONT_STACKS = {
  display: ['Vollkorn', 'Lora', 'Noto Serif SC', 'Georgia', 'serif'],
  body:    ['Lora', 'Noto Serif SC', 'Georgia', 'serif'],
  sans:    ['Inter', 'system-ui', 'sans-serif'],
  mono:    ['JetBrains Mono', 'Menlo', 'Courier New', 'monospace'],
  chinese: ['Noto Serif SC', 'serif'],
  chineseCalligraphy: ['Ma Shan Zheng', 'cursive'],
} as const;

/**
 * Google Fonts import URL (for index.html <link>):
 *
 * Vollkorn:       400, 500, 600 (normal + italic 400, 500)
 * Lora:           400, 500, 600, 700 (normal + italic 400, 500)
 * Inter:          300, 400, 500, 600
 * JetBrains Mono: 400
 * Noto Serif SC:  200, 400, 700
 * Ma Shan Zheng:  400
 *
 * https://fonts.googleapis.com/css2?family=Vollkorn:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600&family=JetBrains+Mono&family=Noto+Serif+SC:wght@200;400;700&family=Ma+Shan+Zheng&display=swap
 */

export const TYPE_SCALE = {
  /** Page titles, hero headings — Vollkorn 400 */
  display: {
    fontFamily: 'display',
    fontWeight: 400,
    fontSize: 'clamp(32px, 4.8vw, 48px)',
    lineHeight: 1.12,
    letterSpacing: '0.01em',
  },

  /** Section headings, card titles — Vollkorn 400 */
  h2: {
    fontFamily: 'display',
    fontWeight: 400,
    fontSize: 'clamp(24px, 3.5vw, 32px)',
    lineHeight: 1.2,
    letterSpacing: '0.01em',
  },

  /** Descriptive subtitles, poetic text — Lora 300 italic */
  subtitle: {
    fontFamily: 'body',
    fontWeight: 300,
    fontStyle: 'italic' as const,
    fontSize: '17px',
    lineHeight: 1.4,
  },

  /** Article text, long-form reading — Lora 400 */
  body: {
    fontFamily: 'body',
    fontWeight: 400,
    fontSize: '17px',
    lineHeight: 1.85,
  },

  /** Captions, secondary text — Lora 300 */
  bodyLight: {
    fontFamily: 'body',
    fontWeight: 300,
    fontSize: '15px',
    lineHeight: 1.8,
  },

  /** Tags, categories, metadata — Inter 400 uppercase */
  label: {
    fontFamily: 'sans',
    fontWeight: 400,
    fontSize: '10px',
    lineHeight: 1.4,
    letterSpacing: '2px',
    textTransform: 'uppercase' as const,
  },

  /** Nav items, section headers — Inter 400 uppercase */
  nav: {
    fontFamily: 'sans',
    fontWeight: 400,
    fontSize: '11px',
    lineHeight: 1.4,
    letterSpacing: '1.5px',
    textTransform: 'uppercase' as const,
  },

  /** Interactive text, buttons — Inter 400 */
  link: {
    fontFamily: 'sans',
    fontWeight: 400,
    fontSize: '13px',
    letterSpacing: '0.3px',
  },

  /** Prices, hex codes, specs — JetBrains Mono 400 */
  mono: {
    fontFamily: 'mono',
    fontWeight: 400,
    fontSize: '9px',
  },
} as const;

/** Tailwind class presets for common typography patterns */
export const TYPOGRAPHY_CLASSES = {
  h1:        'font-display text-[clamp(32px,4.8vw,48px)] font-normal leading-[1.12] tracking-[0.01em]',
  h2:        'font-display text-[clamp(24px,3.5vw,32px)] font-normal leading-[1.2] tracking-[0.01em]',
  subtitle:  'font-body text-[17px] font-light italic leading-[1.4]',
  body:      'font-body text-[17px] font-normal leading-[1.85]',
  bodyLight: 'font-body text-[15px] font-light leading-[1.8]',
  label:     'font-sans text-[10px] font-normal uppercase tracking-[2px] leading-[1.4]',
  nav:       'font-sans text-[11px] font-normal uppercase tracking-[1.5px] leading-[1.4]',
  link:      'font-sans text-[13px] font-normal tracking-[0.3px]',
  mono:      'font-mono text-[9px] font-normal',
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
  loose:   '1.8',     // Body light
  reading: '1.85',    // Body / article text
} as const;


// ─────────────────────────────────────────────────────────────
// 2. COLOR PALETTE — "Espresso + Gold"
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
    bg:        '#18130e',                  // Rich espresso — page background
    surface:   '#28211a',                  // Primary surface — cards, panels
    elevated:  '#3a3126',                  // Elevated surfaces — modals, popovers
    text:      '#ede4d4',                  // Primary text — cream white
    textSec:   '#b5a892',                  // Secondary text — warm gray
    textDim:   '#80735f',                  // Dimmed text — labels, captions
    gold:      '#b8924e',                  // Accent gold — links, accents, active states
    goldLt:    '#d4ac66',                  // Light gold — hover states, highlights
    border:    'rgba(184,146,78,0.08)',     // Subtle gold borders
    accentSub: 'rgba(184,146,78,0.1)',     // Subtle gold backgrounds
  },
  light: {
    bg:        '#f4ece0',                  // Warm parchment — page background
    surface:   '#e6dbcc',                  // Tinted surface — cards, panels
    elevated:  '#d5c8b4',                  // Elevated surfaces
    text:      '#18130e',                  // Dark espresso text
    textSec:   '#5e5342',                  // Secondary text — warm brown
    textDim:   '#9a8c78',                  // Dimmed text
    gold:      '#8e6d2e',                  // Darker gold for light backgrounds
    goldLt:    '#a88340',                  // Light gold variant
    border:    'rgba(142,109,46,0.1)',      // Warm borders
    accentSub: 'rgba(142,109,46,0.07)',    // Subtle accent backgrounds
  },
} as const;

/** Legacy color aliases — kept during migration */
export const LEGACY_COLORS = {
  'tea-paper':    '#ede4d4',
  'tea-charcoal': '#18130e',
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

export const TEA_TYPE_COLORS = {
  Green:   { card: '#859F85', vivid: '#86efac' },
  Yellow:  { card: '#D4C586', vivid: '#fde047' },
  White:   { card: '#D6D3CD', vivid: '#e5e5e5' },
  Oolong:  { card: '#C4A484', vivid: '#6ee7b7' },
  Red:     { card: '#A67B70', vivid: '#fda4af' },
  Dark:    { card: '#8B8C89', vivid: '#a8a29e' },
  Shou:    { card: '#5C544E', vivid: '#78716c' },
  Sheng:   { card: '#98A67B', vivid: '#bef264' },
  Herbal:  { card: '#BFA09E', vivid: '#f9a8d4' },
  Matcha:  { card: '#6F8C60', vivid: '#4ade80' },
  Flower:  { card: '#B596A6', vivid: '#e879f9' },
  Teaware: { card: '#C4A484', vivid: '#fdba74' },
  Misc:    { card: '#737373', vivid: '#a3a3a3' },
} as const;

export type TeaType = keyof typeof TEA_TYPE_COLORS;

/** Get the card-appropriate color for a tea type */
export const getTeaColor = (type: string): string =>
  TEA_TYPE_COLORS[type as TeaType]?.card ?? '#737373';

/** Get the vivid/illustration color for a tea type */
export const getTeaVividColor = (type: string): string =>
  TEA_TYPE_COLORS[type as TeaType]?.vivid ?? '#a3a3a3';


// ─────────────────────────────────────────────────────────────
// 4. ALCOVE CARD PALETTE
// ─────────────────────────────────────────────────────────────

/**
 * The Alcove card is the premium product display component.
 * It uses the main Espresso+Gold palette — NOT its own color system.
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
  accent:        '#b8924e',   // --tea-gold
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

  /** Inset panel highlight — recessed alcove feel */
  insetHighlight: 'radial-gradient(ellipse 80% 40% at 70% 0%, rgba(200, 170, 120, 0.04), transparent)',

  /** Light mode inset variant */
  insetHighlightLight: 'radial-gradient(ellipse 80% 40% at 70% 0%, rgba(142, 109, 46, 0.03), transparent)',

  /** Warm section divider — replaces flat border-top */
  divider: 'linear-gradient(90deg, transparent, rgba(184, 146, 78, 0.2) 20%, rgba(184, 146, 78, 0.3) 50%, rgba(184, 146, 78, 0.2) 80%, transparent)',

  /** Sidebar background */
  sidebar: 'linear-gradient(180deg, var(--tea-surface) 0%, rgba(24,19,14,0.95) 100%)',

  /** Pull quote left accent */
  pullQuote: 'linear-gradient(90deg, rgba(184, 146, 78, 0.04) 0%, transparent 80%)',

  /** Image overlays for photo essays and cards */
  imageSheen: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',

  /** Alcove card top warmth — the signature glow */
  alcoveWarmth: 'radial-gradient(ellipse 70% 50% at 85% 8%, rgba(180,120,40,0.09), transparent)',
  alcoveWarmthSecondary: 'radial-gradient(ellipse 50% 40% at 90% 0%, rgba(200,140,50,0.05), transparent)',

  /** Alcove photo mask — horizontal and vertical fades */
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
  /** Full-page noise overlay — fractalNoise 0.65, 4 octaves, opacity 0.06 */
  grainOverlay: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,

  /** Denser grain for surfaces — fractalNoise 0.55, 5 octaves, multiply blend */
  surfaceGrain: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.55' numOctaves='5' stitchTiles='stitch' seed='2'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)'/%3E%3C/svg%3E")`,

  /** Fine grain for Alcove card inset panels — 0.85 base, 4 octaves, 120px tile */
  alcoveGrain: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,

  /** Paper weave — crossing horizontal and vertical fine lines */
  paperTexture: `repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(180, 165, 140, 0.03) 1px, rgba(180, 165, 140, 0.03) 2px), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(180, 165, 140, 0.02) 2px, rgba(180, 165, 140, 0.02) 3px)`,

  /** Fabric / linen weave — warm thread pattern */
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

  /** Inset panel — alcove-inspired recessed surface */
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
  sm:   '0.125rem',   // 2px  — subtle rounding
  base: '0.25rem',    // 4px
  md:   '0.375rem',   // 6px  — inset panels
  lg:   '0.5rem',     // 8px
  xl:   '0.75rem',    // 12px
  '2xl': '0.875rem',  // 14px — cards
  '3xl': '1.125rem',  // 18px — large panels, modals
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
 *   - Stroke weight:  1.5 (default lucide) — clean but not hairline
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
// 12. SURFACE TREATMENTS — "The Alcove System"
// ─────────────────────────────────────────────────────────────

/**
 * The Alcove texture system is the STANDARD surface treatment for
 * panels, drawers, modals, and any container that needs atmospheric depth.
 *
 * It consists of layered effects applied via CSS classes (see card-utilities.css):
 *
 *   .surface-warm        — Primary panel surface
 *                           Layers: radial warmth gradient + grain noise overlay
 *                           Use on: drawers, sidebars, full-panel backgrounds
 *
 *   .surface-warm-inset  — Recessed content area within a .surface-warm panel
 *                           Layers: darkened bg + edge-lit inset shadows +
 *                                   denser grain + ambient top-glow
 *                           Use on: content areas, scrollable regions, form sections
 *
 * The system creates tactile, editorial depth without relying on borders or
 * heavy shadows. Everything is warm-toned — never white, never cold.
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

export const SURFACE_TREATMENTS = {
  /** Primary warm surface — radial warmth + grain */
  warm: {
    warmthGradient: `
      radial-gradient(ellipse 70% 50% at 85% 8%, rgba(180,120,40,0.09) 0%, transparent 60%),
      radial-gradient(ellipse 50% 40% at 90% 0%, rgba(200,140,50,0.05) 0%, transparent 50%)
    `,
    grain: TEXTURES.alcoveGrain,
    grainOpacity: 0.06,
    grainSize: '120px',
  },

  /** Recessed inset surface — darker bg, edge-lit, denser grain, ambient glow */
  warmInset: {
    background: 'rgba(0,0,0,0.25)',
    boxShadow: 'inset 0 1px 0 rgba(200,170,120,0.06), inset 0 -1px 0 rgba(200,170,120,0.04), 0 -1px 0 rgba(200,170,120,0.06)',
    borderRadius: '6px',
    grain: TEXTURES.alcoveGrain,
    grainOpacity: 0.08,
    grainSize: '120px',
    ambientGlow: 'radial-gradient(ellipse 80% 30% at 70% 0%, rgba(200,170,120,0.04), transparent)',
    ambientGlowHeight: '60%',
  },

  /** Light mode warm inset — softer treatment */
  warmInsetLight: {
    background: 'rgba(0,0,0,0.04)',
    boxShadow: 'inset 0 1px 0 rgba(142,109,46,0.08), inset 0 -1px 0 rgba(142,109,46,0.04), 0 -1px 0 rgba(142,109,46,0.06)',
    borderRadius: '6px',
    grain: TEXTURES.alcoveGrain,
    grainOpacity: 0.04,
    grainSize: '120px',
    ambientGlow: 'radial-gradient(ellipse 80% 30% at 70% 0%, rgba(142,109,46,0.03), transparent)',
    ambientGlowHeight: '60%',
  },
} as const;


// ─────────────────────────────────────────────────────────────
// 13. COMPONENT PATTERNS
// ─────────────────────────────────────────────────────────────

/**
 * Common component styling patterns for reference.
 * Not used programmatically — documentation for consistency.
 *
 * IMPORTANT: Never use white (#fff, rgba(255,255,255,*)) for borders,
 * rings, glows, or backgrounds. Use warm palette tones instead:
 *   - Borders/rings: --tea-border or --tea-text-dim at low opacity
 *   - Backgrounds: --tea-surface or --tea-elevated
 *   - Glows: rgba(200,170,120,0.1) — the warm accent glow
 *   - Spinners: border-t color should be --tea-text-sec, not white
 *
 * CARDS (card-grid-item):
 *   - Background: cardWarmth gradient + var(--tea-surface)
 *   - Shadow: SHADOWS.card → SHADOWS.cardHover on hover
 *   - Border radius: 1px (intentionally minimal)
 *   - Transform: translateY(-3px) scale(1.01) on hover
 *   - Image: aspect-ratio 1/1, opacity 0.9 → 1 on hover, scale(1.06)
 *   - Title: font-display (Vollkorn), color transitions to --tea-gold on hover
 *   - Price: .num class (JetBrains Mono, tabular-nums)
 *
 * SURFACE TREATMENTS (see §12):
 *   - .surface-warm: Radial warmth gradient + grain noise — use on all panels/drawers
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
 *               #b8924e on #18130e = 5.2:1  (AA)
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
    sans:    FONT_STACKS.sans,
    mono:    FONT_STACKS.mono,
  },
  typeScale:       TYPE_SCALE,
  typography:      TYPOGRAPHY_CLASSES,
  fontSize:        FONT_SIZES,
  fontWeight:      FONT_WEIGHTS,
  lineHeight:      LINE_HEIGHTS,
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
  backgroundImage: { 'paper-texture': TEXTURES.paperTexture },
} as const;

// Font Theme Presets for testing and customization
export const FONT_THEMES = {
  default: {
    name: 'Default (Vollkorn + Lora)',
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

/* =====================================================
   §12 — SURFACE_TREATMENTS
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
   *  Base RGB: 200,170,120 — the single source for dividers, glows, borders. */
  warmBronze: {
    rgb: '200,170,120',
    divider:    'rgba(200,170,120,0.08)',
    border:     'rgba(200,170,120,0.06)',
    borderHover:'rgba(200,170,120,0.20)',
    glow:       'rgba(200,170,120,0.04)',
    scrollbar:  'rgba(200,170,120,0.15)',
    tagBg:      'rgba(200,170,120,0.03)',
  },

  /** Card frame — outermost wrapper */
  cardFrame: {
    background: 'var(--tea-surface)',
    border: '1px solid var(--tea-border)',
    borderRadius: 8,
    boxShadow: '0 2px 8px rgba(0,0,0,0.15), 0 0 0 1px rgba(200,170,120,0.06)',
  } as React.CSSProperties,

  /** Recessed panel — darkened inset used for content sections
   *  (The Process, Offerings table, story text area) */
  recessedPanel: {
    background: 'rgba(0,0,0,0.25)',
    boxShadow: 'inset 0 1px 0 rgba(200,170,120,0.06), inset 0 -1px 0 rgba(200,170,120,0.04), 0 -1px 0 rgba(200,170,120,0.06)',
    borderRadius: 6,
  } as React.CSSProperties,

  /** Image inset — recessed treatment for hero/product photos */
  imageInset: {
    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3), inset 0 -1px 0 rgba(200,170,120,0.06)',
  } as React.CSSProperties,

  /** Radial warmth — ambient light overlay placed behind content.
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

  /** Fine grain texture — SVG fractal noise overlay.
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

  /** Ambient top glow — radial gradient at top of recessed panels */
  ambientGlow: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    pointerEvents: 'none' as const,
    background: 'radial-gradient(ellipse 80% 30% at 70% 0%, rgba(200,170,120,0.04), transparent)',
  } as React.CSSProperties,

  /** Scroll fade gradients — mask content overflow at edges */
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

  /** Commerce section — pinned bottom area */
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

  /** Image mask — dual-layer gradient for hero photo fade-in */
  imageMask: {
    WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.12) 25%, rgba(0,0,0,0.3) 45%, rgba(0,0,0,0.55) 60%, black 85%, black 100%), linear-gradient(to bottom, black 85%, transparent 100%)",
    WebkitMaskComposite: 'destination-in' as const,
    maskImage: "linear-gradient(to right, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.12) 25%, rgba(0,0,0,0.3) 45%, rgba(0,0,0,0.55) 60%, black 85%, black 100%), linear-gradient(to bottom, black 85%, transparent 100%)",
    maskComposite: 'intersect',
  } as React.CSSProperties,
} as const;
