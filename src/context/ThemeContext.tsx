
import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DESIGN_TOKENS } from '../designTokens';

interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: (e?: React.MouseEvent) => void;
  designTokens: typeof DESIGN_TOKENS;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('teajia_theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    }
    return 'dark';
  });

  // Radial reveal animation state
  const [revealClip, setRevealClip] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem('teajia_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Listen to system preference changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        const saved = localStorage.getItem('teajia_theme');
        if (!saved) {
          setTheme(e.matches ? 'dark' : 'light');
        }
      };
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      }
    }
  }, []);

  const toggleTheme = useCallback((e?: React.MouseEvent) => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';

    // If we have a click event, do radial reveal animation
    if (e) {
      const x = e.clientX;
      const y = e.clientY;
      const maxRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      setRevealClip(`circle(0px at ${x}px ${y}px)`);
      setTheme(nextTheme);

      // Animate the clip-path expanding
      requestAnimationFrame(() => {
        setRevealClip(`circle(${maxRadius}px at ${x}px ${y}px)`);
        setTimeout(() => setRevealClip(null), 500);
      });
    } else {
      setTheme(nextTheme);
    }
  }, [theme]);

  const value = useMemo(() => ({ theme, toggleTheme, designTokens: DESIGN_TOKENS }), [theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
      {/* Radial reveal overlay for dark mode transition */}
      {revealClip && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[9999] pointer-events-none transition-[clip-path] duration-500 ease-out"
          style={{
            clipPath: revealClip,
            backgroundColor: 'var(--tea-bg)',
          }}
        />
      )}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
