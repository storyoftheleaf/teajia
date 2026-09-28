import React from 'react';
import { useNavigate } from 'react-router-dom';

// The site's one "page not found" view. The catch-all route renders it, and so
// does the Tea Atlas for anyone without access (docs/TEA_ATLAS.md): the two
// must be identical, or the difference would say the library is there.
// `onReturnHome` lets App reset its own section state on the way out; without
// it the button simply goes home.
export const SiteNotFound: React.FC<{ onReturnHome?: () => void }> = ({ onReturnHome }) => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 animate-[fadeIn_0.5s_ease-out]">
      <h1 className="text-6xl font-serif text-tea-gold mb-4">404</h1>
      <p className="text-xl font-serif text-tea-text mb-2">Page not found</p>
      <p className="text-sm text-tea-text-sec mb-8 max-w-md">The page you're looking for doesn't exist or may have been moved.</p>
      <button onClick={() => (onReturnHome ? onReturnHome() : navigate('/'))} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors">Return Home</button>
    </div>
  );
};

export default SiteNotFound;
