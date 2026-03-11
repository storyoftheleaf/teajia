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
      colors: DESIGN_TOKENS.colors as Record<string, string>,
      fontFamily: {
        serif: DESIGN_TOKENS.fontFamily.serif as string[],
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
