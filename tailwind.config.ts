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
        'tea-bg': 'rgb(var(--tea-bg-rgb) / <alpha-value>)',
        'tea-surface': 'rgb(var(--tea-surface-rgb) / <alpha-value>)',
        'tea-elevated': 'rgb(var(--tea-elevated-rgb) / <alpha-value>)',
        'tea-text': 'rgb(var(--tea-text-rgb) / <alpha-value>)',
        'tea-text-sec': 'rgb(var(--tea-text-sec-rgb) / <alpha-value>)',
        'tea-text-dim': 'rgb(var(--tea-text-dim-rgb) / <alpha-value>)',
        'tea-gold': 'rgb(var(--tea-gold-rgb) / <alpha-value>)',
        'tea-gold-lt': 'rgb(var(--tea-gold-lt-rgb) / <alpha-value>)',
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
