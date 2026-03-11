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
      colors: {
        // CSS variable-driven tokens (switch with dark/light mode)
        'tea-bg': 'var(--tea-bg)',
        'tea-surface': 'var(--tea-surface)',
        'tea-elevated': 'var(--tea-elevated)',
        'tea-text': 'var(--tea-text)',
        'tea-text-sec': 'var(--tea-text-sec)',
        'tea-text-dim': 'var(--tea-text-dim)',
        'tea-gold': 'var(--tea-gold)',
        'tea-gold-lt': 'var(--tea-gold-lt)',
        'tea-border': 'var(--tea-border)',
        'tea-accent-sub': 'var(--tea-accent-sub)',
        // DEPRECATED LEGACY ALIASES — DO NOT USE IN NEW CODE
        // See COLOR_RULES.md for correct tokens.
        'tea-charcoal': 'var(--tea-bg)',
        'tea-paper': '#ede4d4',
        'tea-paper-dark': 'var(--tea-surface)',
        'tea-beige': 'var(--tea-elevated)',
        'tea-ink': 'var(--tea-text)',
        'tea-ink-light': 'var(--tea-text-sec)',
        'tea-ink-secondary': 'var(--tea-text-sec)',
        'tea-paper-secondary': 'var(--tea-text-dim)',
        'tea-seal': 'var(--tea-gold)',
        'tea-seal-dark': 'var(--tea-gold)',
        'tea-accent': 'var(--tea-gold)',
        'tea-muted': 'var(--tea-text-dim)',
        'tea-beige-dark': 'var(--tea-text-dim)',
        'tea-green': '#5A6E5A',
        'tea-moss': '#2A3430',
        'tea-shadow': 'rgba(0,0,0,0.15)',
      },
      fontFamily: {
        display: DESIGN_TOKENS.fontFamily.display as string[],
        serif: DESIGN_TOKENS.fontFamily.serif as string[],
        body: DESIGN_TOKENS.fontFamily.body as string[],
        sans: DESIGN_TOKENS.fontFamily.sans as string[],
        mono: DESIGN_TOKENS.fontFamily.mono as string[],
      },
      fontSize: DESIGN_TOKENS.fontSize as Record<string, string>,
      fontWeight: DESIGN_TOKENS.fontWeight as Record<string, number>,
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
        toast: '50',
        priority: '60',
      },
    },
  },
  plugins: [],
};

export default config;
