/**
 * Design Tokens — "Espresso + Gold / The Whisper + Storyteller"
 *
 * Single source of truth for all design decisions.
 * Source of truth for palette: plan/teajia-palettes.html
 *
 * Fonts: Vollkorn (display), Spectral (body), Jost (labels/nav), Space Mono (technical)
 * Colors: Warm espresso-and-gold with dark/light mode via CSS variables
 */

export const DESIGN_TOKENS = {
  // Typography — "The Whisper + Storyteller"
  fontFamily: {
    serif: ['Lora', 'Noto Serif SC', 'serif'],
    sans: ['Inter', 'sans-serif'],
    mono: ['JetBrains Mono', 'Menlo', 'Courier New', 'monospace'],
  },

  // Type Scale (from plan/teajia-palettes.html)
  typeScale: {
    display: { family: 'serif', weight: 400, size: 'clamp(32px, 4.8vw, 48px)', lineHeight: 1.12, letterSpacing: '0.01em' },
    h2: { family: 'serif', weight: 400, size: 'clamp(24px, 3.5vw, 32px)', lineHeight: 1.2, letterSpacing: '0.01em' },
    subtitle: { family: 'body', weight: 300, style: 'italic', size: '17px', lineHeight: 1.4 },
    body: { family: 'body', weight: 400, size: '17px', lineHeight: 1.85 },
    bodyLight: { family: 'body', weight: 300, size: '15px', lineHeight: 1.8 },
    label: { family: 'sans', weight: 400, size: '10px', lineHeight: 1.4, letterSpacing: '2px', textTransform: 'uppercase' },
    nav: { family: 'sans', weight: 400, size: '11px', lineHeight: 1.4, letterSpacing: '1.5px', textTransform: 'uppercase' },
    link: { family: 'sans', weight: 400, size: '13px', letterSpacing: '0.3px' },
    mono: { family: 'mono', weight: 400, size: '9px' },
  },

  // Font Sizes — Tailwind scale (kept for utility classes)
  fontSize: {
    xs: '0.75rem',      // 12px
    sm: '0.875rem',     // 14px
    base: '1rem',       // 16px
    lg: '1.125rem',     // 18px
    xl: '1.25rem',      // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '1.875rem',  // 30px
    '4xl': '2.25rem',   // 36px
    '5xl': '3rem',      // 48px
  },

  // Font Weights
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  // Line Heights
  lineHeight: {
    tight: '1.12',     // Display headings
    snug: '1.2',       // H2 headings
    normal: '1.4',     // Subtitles, labels
    relaxed: '1.625',  // UI text
    loose: '1.8',      // Body light
    reading: '1.85',   // Body / article text
  },

  // Typography Presets (Tailwind class strings)
  typography: {
    h1: 'font-serif text-[clamp(32px,4.8vw,48px)] font-normal leading-[1.12] tracking-[0.01em]',
    h2: 'font-serif text-[clamp(24px,3.5vw,32px)] font-normal leading-[1.2] tracking-[0.01em]',
    subtitle: 'font-body text-[17px] font-light italic leading-[1.4]',
    body: 'font-body text-[17px] font-normal leading-[1.85]',
    bodyLight: 'font-body text-[15px] font-light leading-[1.8]',
    label: 'font-sans text-[10px] font-normal uppercase tracking-[2px] leading-[1.4]',
    nav: 'font-sans text-[11px] font-normal uppercase tracking-[1.5px] leading-[1.4]',
    link: 'font-sans text-[13px] font-normal tracking-[0.3px]',
  },

  // Animation Timing
  timing: {
    micro: '150ms',    // hover states, badges, small feedback
    standard: '300ms', // transitions, modals, buttons
    emphasis: '500ms', // page transitions, image reveals, color mode
  },

  // Color Palette — "Espresso + Gold"
  // These are the canonical values. At runtime, CSS variables (--tea-*) handle mode switching.
  colors: {
    dark: {
      bg: '#18130e',
      surface: '#28211a',
      elevated: '#3a3126',
      text: '#ede4d4',
      textSec: '#b5a892',
      textDim: '#80735f',
      gold: '#b8924e',
      goldLt: '#d4ac66',
      border: 'rgba(181,168,146,0.14)',
      accentSub: 'rgba(184,146,78,0.1)',
    },
    light: {
      bg: '#f4ece0',
      surface: '#e6dbcc',
      elevated: '#d5c8b4',
      text: '#18130e',
      textSec: '#5e5342',
      textDim: '#9a8c78',
      gold: '#8e6d2e',
      goldLt: '#a88340',
      border: 'rgba(24,19,14,0.1)',
      accentSub: 'rgba(142,109,46,0.07)',
    },
  },

  // Spacing Scale
  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    '2xl': '3rem',    // 48px
    '3xl': '4rem',    // 64px
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    base: '0 1px 3px rgba(0,0,0,0.3)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 8px 20px rgba(0,0,0,0.4)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
  },

  // Border Radius
  borderRadius: {
    none: '0px',
    sm: '0.125rem',
    base: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '0.875rem',   // 14px — cards in HTML reference
    '3xl': '1.125rem',   // 18px — panels in HTML reference
    full: '9999px',       // pills, tags
  },

  // Animations (Tailwind keyframes) — Using consistent timing
  animations: {
    fadeIn: 'fadeIn 0.5s ease-out',
    slideIn: 'slideIn 0.3s ease-out',
    slideInWidth: 'slideInWidth 0.3s ease-out',
    slideUp: 'slideUp 0.3s ease-out',
    scaleIn: 'scaleIn 0.15s ease-out',
  },

  // Keyframe definitions for animations
  keyframes: {
    fadeIn: {
      '0%': { opacity: '0' },
      '100%': { opacity: '1' },
    },
    slideIn: {
      '0%': { transform: 'scaleX(0)', transformOrigin: 'left' },
      '100%': { transform: 'scaleX(1)', transformOrigin: 'left' },
    },
    slideInWidth: {
      '0%': { width: '0' },
      '100%': { width: '100%' },
    },
    slideUp: {
      '0%': { transform: 'translateY(100%)', opacity: '0' },
      '100%': { transform: 'translateY(0)', opacity: '1' },
    },
    scaleIn: {
      '0%': { opacity: '0', transform: 'scale(0.95)' },
      '100%': { opacity: '1', transform: 'scale(1)' },
    },
  },

  // Background Images — Textures (DO NOT REMOVE — core to the design atmosphere)
  backgroundImage: {
    'paper-texture': "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(180, 165, 140, 0.03) 1px, rgba(180, 165, 140, 0.03) 2px), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(180, 165, 140, 0.02) 2px, rgba(180, 165, 140, 0.02) 3px)",
  },
} as const;

// Font Theme Presets for testing and customization
export const FONT_THEMES = {
  default: {
    name: 'Default (Lora)',
    serif: ['Lora', 'Noto Serif SC', 'serif'],
    sans: ['Inter', 'sans-serif'],
    mono: ['JetBrains Mono', 'Menlo', 'Courier New', 'monospace'],
  },
  georgia: {
    name: 'Georgia Classic',
    serif: ['Georgia', 'serif'],
    sans: ['Arial', 'sans-serif'],
    mono: ['Courier New', 'monospace'],
  },
  modern: {
    name: 'Modern (System)',
    serif: ['Georgia', 'serif'],
    sans: ['system-ui', 'sans-serif'],
    mono: ['monospace'],
  },
  serif_minimal: {
    name: 'Minimal Serif',
    serif: ['Garamond', 'serif'],
    sans: ['Helvetica', 'Arial', 'sans-serif'],
    mono: ['monospace'],
  },
  tech: {
    name: 'Tech Modern',
    serif: ['Optima', 'Georgia', 'serif'],
    sans: ['Helvetica Neue', 'sans-serif'],
    mono: ['SF Mono', 'Monaco', 'monospace'],
  },
} as const;

// Font Size Scales for proportional sizing
export const FONT_SIZE_SCALES = {
  compact: {
    name: 'Compact (90%)',
    multiplier: 0.9,
  },
  default: {
    name: 'Default (100%)',
    multiplier: 1.0,
  },
  comfortable: {
    name: 'Comfortable (110%)',
    multiplier: 1.1,
  },
  large: {
    name: 'Large (120%)',
    multiplier: 1.2,
  },
  xlarge: {
    name: 'Extra Large (130%)',
    multiplier: 1.3,
  },
} as const;

// Export type for TypeScript support
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
