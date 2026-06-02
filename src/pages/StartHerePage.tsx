import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { LogoEmblem } from '../components/Logos/LogoEmblem';

interface Path {
  label: string;
  desc: string;
  route: string;
}

const PATHS: Path[] = [
  {
    label: 'New to tea',
    desc: 'Discover what tea really is',
    route: '/craft',
  },
  {
    label: 'I have a practice',
    desc: 'Deepen your knowledge and find your next tea',
    route: '/shop',
  },
  {
    label: 'I want to open a space',
    desc: 'Get the infrastructure to build your tea house',
    route: '/advise',
  },
  {
    label: 'Tea for my business',
    desc: 'Integrate tea into your hotel, studio, or retreat',
    route: '/for-your-space',
  },
  {
    label: 'Tea Masters & Professionals',
    desc: 'Professional tools for sourcing, stock, and events',
    route: '/admin',
  },
  {
    label: 'The Magazine',
    desc: 'Read, learn, and contribute to the conversation',
    route: '/read',
  },
];

export const StartHerePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center pb-nav-gap-lg">
      <Helmet>
        <title>Start Here — Teajia</title>
        <meta name="description" content="Find your path into Teajia — whether you're new to tea, building a practice, or running a business." />
      </Helmet>

      {/* Header */}
      <div className="flex flex-col items-center pt-12 pb-10 px-6 text-center max-w-2xl">
        <LogoEmblem
          size={48}
          color="var(--tea-gold)"
          className="opacity-70 mb-6"
        />
        <p className="label-caps text-tea-text-dim mb-3">Start here</p>
        <h1 className="h1 mb-3">
          Where would you like to begin?
        </h1>
        <p className="subtitle">
          Six paths into the practice — choose the one that meets you where you are.
        </p>
      </div>

      {/* Numbered steps list */}
      <div className="w-full max-w-2xl px-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {PATHS.map((path, idx) => (
          <button
            key={path.route}
            onClick={() => navigate(path.route)}
            className="group relative flex flex-col justify-between text-left bg-tea-surface border border-tea-border rounded-xl p-5 transition-colors duration-200 hover:border-tea-gold/40 hover:bg-tea-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1"
            style={{ minHeight: '108px' }}
          >
            <div className="flex-1">
              <p className="label-caps text-tea-readgold mb-2">
                {String(idx + 1).padStart(2, '0')}
              </p>
              <p className="font-display text-ui-16 text-tea-text leading-snug mb-1.5" style={{ fontWeight: 400 }}>
                {path.label}
              </p>
              <p className="font-body text-ui-13 text-tea-text-sec leading-relaxed">
                {path.desc}
              </p>
            </div>
            <div className="mt-3 flex justify-end">
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                className="text-tea-text-dim opacity-0 group-hover:opacity-60 -translate-x-1 group-hover:translate-x-0 transition-all duration-200"
                aria-hidden="true"
              >
                <path
                  d="M2 7h10M9 3.5L12.5 7 9 10.5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default StartHerePage;
