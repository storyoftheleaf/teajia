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
    desc: 'Professional tools for sourcing, inventory, and events',
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
    <div className="min-h-screen flex flex-col items-center pb-[calc(1rem+44px+env(safe-area-inset-bottom,0px))]">
      <Helmet>
        <title>Start Here — Teajia</title>
        <meta name="description" content="Find your path into Teajia — whether you're new to tea, building a practice, or running a business." />
      </Helmet>

      {/* Header */}
      <div className="flex flex-col items-center pt-12 pb-8 px-6 text-center">
        <LogoEmblem
          size={48}
          color="var(--tea-gold)"
          className="opacity-70 mb-6"
        />
        <h1
          className="text-tea-text text-[22px] md:text-ui-26 font-normal leading-snug tracking-[0.01em]"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}
        >
          Where would you like to begin?
        </h1>
      </div>

      {/* 2-column grid */}
      <div className="w-full max-w-2xl px-4 grid grid-cols-2 gap-3">
        {PATHS.map((path) => (
          <button
            key={path.route}
            onClick={() => navigate(path.route)}
            className="group relative flex flex-col justify-between text-left bg-tea-surface border border-tea-border p-5 transition-all duration-200 hover:border-tea-gold/40 hover:bg-tea-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1"
            style={{ minHeight: '100px' }}
          >
            <div className="flex-1">
              <p
                className="text-tea-text text-ui-15 md:text-ui-16 leading-snug mb-1.5"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}
              >
                {path.label}
              </p>
              <p
                className="text-tea-text-sec text-ui-12 md:text-ui-13 leading-relaxed"
                style={{ fontFamily: 'var(--font-body)' }}
              >
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
