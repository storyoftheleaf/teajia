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
