import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Icons } from '../Icons';

export const ThemeSettings: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors"
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
