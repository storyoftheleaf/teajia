/**
 * Design Tokens - Single source of truth for all design decisions
 *
 * Edit this file to change fonts, colors, spacing, and sizes across the entire site.
 * Change `fontFamily.serif` or `fontFamily.sans` to experiment with different typefaces.
 */

export const DESIGN_TOKENS = {
  // Typography - EASILY SWAPPABLE
  fontFamily: {
    serif: ['Lora', 'Noto Serif SC', 'serif'],
    sans: ['Inter', 'sans-serif'],
    mono: ['Menlo', 'Courier New', 'monospace'],
  },

  // Font Sizes - Current scale, easy to adjust
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
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '1.75',
  },

  // Typography Presets (for reference)
  typography: {
    h1: 'font-serif text-4xl md:text-5xl lg:text-6xl font-light leading-tight',
    h2: 'font-serif text-3xl md:text-4xl font-normal leading-snug',
    h3: 'font-serif text-xl md:text-2xl font-medium leading-snug',
    body: 'font-sans text-base font-normal leading-relaxed',
    bodySmall: 'font-sans text-sm font-normal leading-relaxed',
  },

  // Animation Timing
  timing: {
    micro: '150ms',    // hover states, badges, small feedback
    standard: '300ms', // transitions, modals, buttons
    emphasis: '500ms', // page transitions, image reveals
  },

  // Color Palette - Tea theme
  colors: {
    // Primary backgrounds
    'tea-charcoal': '#1a1a1a',    // Dark background
    'tea-paper': '#F3F0E7',       // Light background (paper aesthetic)
    'tea-paper-dark': '#E6E2D6',  // Lighter variant

    // Neutrals
    'tea-beige': '#D8D0C0',
    'tea-ink': '#2C2C2C',         // Primary dark text
    'tea-ink-light': '#555555',   // Secondary text
    'tea-ink-secondary': '#555555',      // Accessible secondary text (light mode)
    'tea-paper-secondary': '#B8B4AA',    // Accessible secondary text (dark mode)

    // Accents
    'tea-seal': '#c9943a',        // Primary accent (warm gold)
    'tea-seal-dark': '#a07830',   // Accessible gold for text on light backgrounds
    'tea-green': '#5A6E5A',       // Accent green
    'tea-moss': '#2A3430',        // Dark green/grey

    // Utilities
    'tea-shadow': 'rgba(0,0,0,0.15)',
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
  },

  // Animations (Tailwind keyframes) - Using consistent timing
  animations: {
    fadeIn: 'fadeIn 0.5s ease-out',       // emphasis timing
    slideIn: 'slideIn 0.3s ease-out',     // standard timing
    slideInWidth: 'slideInWidth 0.3s ease-out', // standard timing
    slideUp: 'slideUp 0.3s ease-out',     // standard timing (was 0.4s)
    scaleIn: 'scaleIn 0.15s ease-out',    // micro timing (was 0.2s)
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

  // Background Images
  backgroundImage: {
    'paper-texture': "url('https://www.transparenttextures.com/patterns/cream-paper.png')",
  },
} as const;

// Font Theme Presets for testing and customization
export const FONT_THEMES = {
  default: {
    name: 'Default (Lora)',
    serif: ['Lora', 'Noto Serif SC', 'serif'],
    sans: ['Inter', 'sans-serif'],
    mono: ['Menlo', 'Courier New', 'monospace'],
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
