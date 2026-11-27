import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

// The site's one "page not found" view. The catch-all route renders it, and so
// does the Tea Atlas for anyone without access (docs/TEA_ATLAS.md): the two
// must be identical, or the difference would say the library is there.
// `onReturnHome` lets App reset its own section state on the way out; without
// it the button simply goes home.
const NOT_FOUND_TITLE = 'Page not found · Teajia';

export const SiteNotFound: React.FC<{ onReturnHome?: () => void }> = ({ onReturnHome }) => {
  const navigate = useNavigate();
  // The tab says "Page not found", never the section's name (a closed door
  // titled "Your Table" said what was behind it). Leaving, the tab falls back
  // to the site's name until the next page or section names itself.
  useEffect(() => () => {
    if (document.title === NOT_FOUND_TITLE) document.title = 'Teajia · A Home for Tea';
  }, []);
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 animate-[fadeIn_0.5s_ease-out]">
      <Helmet><title>{NOT_FOUND_TITLE}</title></Helmet>
      <h1 className="text-6xl font-serif text-tea-gold mb-4">404</h1>
      <p className="text-xl font-serif text-tea-text mb-2">Page not found</p>
      <p className="text-sm text-tea-text-sec mb-8 max-w-md">The page you're looking for doesn't exist or may have been moved.</p>
      <button onClick={() => (onReturnHome ? onReturnHome() : navigate('/'))} className="btn-primary">Return Home</button>
    </div>
  );
};

export default SiteNotFound;
