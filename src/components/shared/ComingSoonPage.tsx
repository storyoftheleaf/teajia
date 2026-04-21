import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogoEmblem } from '../Logos';
import { useTheme } from '../../context/ThemeContext';

interface ComingSoonPageProps {
  label?: string;
}

export const ComingSoonPage: React.FC<ComingSoonPageProps> = ({ label }) => {
  const navigate = useNavigate();
  const { theme } = useTheme();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6 animate-[fadeIn_0.6s_ease-out]">
      <LogoEmblem
        size={48}
        color={theme === 'dark' ? '#c0b49a' : '#010101'}
        className="mb-8 opacity-40"
      />
      {label && (
        <p className="text-[10px] uppercase tracking-[0.25em] text-tea-text-dim mb-3">{label}</p>
      )}
      <h1
        className="text-2xl text-tea-text mb-3"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 200 }}
      >
        Being prepared.
      </h1>
      <p className="text-sm text-tea-text-sec max-w-xs leading-relaxed mb-10">
        This space isn't ready yet. Check back soon.
      </p>
      <button
        onClick={() => navigate('/')}
        className="text-xs uppercase tracking-[0.18em] text-tea-text-sec hover:text-tea-text transition-colors duration-200"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}
      >
        ← Return home
      </button>
    </div>
  );
};
