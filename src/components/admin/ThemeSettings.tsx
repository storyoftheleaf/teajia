import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Icons } from '../Icons';

export const ThemeSettings: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-sm text-white text-xs uppercase tracking-widest flex items-center gap-2 transition-colors"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <>
          <Icons.Sun className="w-4 h-4" />
          Light Mode
        </>
      ) : (
        <>
          <Icons.Moon className="w-4 h-4" />
          Dark Mode
        </>
      )}
    </button>
  );
};
