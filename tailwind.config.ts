import type { Config } from 'tailwindcss';
import { DESIGN_TOKENS } from './src/designTokens';

const config: Config = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Tailwind's opacity scale jumps 5, 10, 20. The house style reaches for 6
      // and 8 for the faintest washes (sidebar hover and active, documented in
      // CLAUDE.md), and without these two steps those classes compile to
      // nothing at all: the sidebar had no hover or active background for as
      // long as they have been written.
      opacity: { 6: '0.06', 8: '0.08' },
      colors: {
        // CSS variable-driven tokens (switch with dark/light mode)
        'tea-bg': 'rgb(var(--tea-bg-rgb) / <alpha-value>)',
        'tea-surface': 'rgb(var(--tea-surface-rgb) / <alpha-value>)',
        'tea-elevated': 'rgb(var(--tea-elevated-rgb) / <alpha-value>)',
        'tea-text': 'rgb(var(--tea-text-rgb) / <alpha-value>)',
        'tea-text-sec': 'rgb(var(--tea-text-sec-rgb) / <alpha-value>)',
        'tea-text-dim': 'rgb(var(--tea-text-dim-rgb) / <alpha-value>)',
        'tea-gold': 'rgb(var(--tea-gold-rgb) / <alpha-value>)',
        'tea-gold-lt': 'rgb(var(--tea-gold-lt-rgb) / <alpha-value>)',
        // Warm gold pinned for text — type token names, eyebrow markers,
        // inline code, hover links. Use this when `tea-gold` would be too dim
        // or when accent shifts toward aged brass for structural primary.
        'tea-readgold': 'rgb(var(--tea-readgold-rgb) / <alpha-value>)',
        'tea-error': 'rgb(var(--tea-error-rgb) / <alpha-value>)',
        'tea-border': 'var(--tea-border)',
        'tea-accent-sub': 'var(--tea-accent-sub)',
        'tea-green': '#5A6E5A',
        'tea-moss': '#2A3430',
        'tea-shadow': 'rgba(0,0,0,0.15)',
        // Modal/overlay scrim. Fixed value, not alpha-aware — use bare
        // `bg-tea-overlay`, never with a /N modifier.
        'tea-overlay': 'rgba(12,9,6,0.78)',
        // Admin neutral palette — see card-utilities.css for the full
        // rationale. Intentionally NOT alpha-channel-aware so /N modifiers
        // don't accidentally produce off-system colors.
        'admin-bg':           'var(--admin-bg)',
        'admin-surface':      'var(--admin-surface)',
        'admin-elevated':     'var(--admin-elevated)',
        'admin-input':        'var(--admin-input-bg)',
        'admin-border':       'var(--admin-border)',
        'admin-border-hover': 'var(--admin-border-hover)',
        'admin-text':         'var(--admin-text)',
        'admin-text-sec':     'var(--admin-text-sec)',
        'admin-text-dim':     'var(--admin-text-dim)',
        'admin-text-faint':   'var(--admin-text-faint)',
      },
      fontFamily: {
        display: DESIGN_TOKENS.fontFamily.display as string[],
        serif: DESIGN_TOKENS.fontFamily.serif as string[],
        body: DESIGN_TOKENS.fontFamily.body as string[],
        sans: DESIGN_TOKENS.fontFamily.sans as string[],
        mono: DESIGN_TOKENS.fontFamily.mono as string[],
      },
      fontSize: {
        ...(DESIGN_TOKENS.fontSize as Record<string, string>),
        ...(DESIGN_TOKENS.uiTextScale as Record<string, string>),
      },
      fontWeight: DESIGN_TOKENS.fontWeight as Record<string, number>,
      lineHeight: DESIGN_TOKENS.lineHeight as Record<string, string>,
      letterSpacing: DESIGN_TOKENS.letterSpacing as Record<string, string>,
      transitionDuration: DESIGN_TOKENS.transitionDuration as Record<string, string>,
      backdropBlur: DESIGN_TOKENS.backdropBlur as Record<string, string>,
      spacing: DESIGN_TOKENS.spacing as Record<string, string>,
      boxShadow: DESIGN_TOKENS.shadows as Record<string, string>,
      borderRadius: DESIGN_TOKENS.borderRadius as Record<string, string>,
      keyframes: DESIGN_TOKENS.keyframes as Record<string, Record<string, Record<string, string>>>,
      animation: DESIGN_TOKENS.animations as Record<string, string>,
      backgroundImage: DESIGN_TOKENS.backgroundImage as Record<string, string>,
      zIndex: {
        base: '0',
        dropdown: '10',
        sticky: '20',
        overlay: '30',
        drawer: '35',
        modal: '40',
        popover: '45',
        toast: '50',
        priority: '60',
        'panel-backdrop': '65',
        'panel-modal': '70',
        nav: '75',
      },
    },
  },
  plugins: [],
};

export default config;
