import React from 'react';
import { Link } from 'react-router-dom';
import { LogoEmblem } from '../Logos';

const linkClass =
  'text-ui-12 sm:text-ui-13 text-tea-text-dim hover:text-tea-text-sec transition-colors duration-300';
const linkStyle = { fontFamily: 'var(--font-body)' } as const;

export default function Footer() {
  return (
    <footer className="mt-10 border-t border-tea-border">
      <div className="relative max-w-screen-lg mx-auto px-6 pt-9 pb-4 overflow-hidden">
        {/* Faint emblem watermark — depth without weight */}
        <div className="pointer-events-none absolute -right-6 -top-4 opacity-[0.04] hidden sm:block" aria-hidden="true">
          <LogoEmblem size={160} color="var(--tea-gold)" />
        </div>

        {/* Editorial closing line — the soft landing, in the homepage voice */}
        <p
          className="text-center sm:text-left text-ui-15 sm:text-ui-16 italic text-tea-text-sec leading-relaxed max-w-[420px] mx-auto sm:mx-0"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}
        >
          Every culture brings wisdom to the table.
        </p>

        {/* Thin inline link row */}
        <nav
          className="mt-7 flex flex-wrap justify-center sm:justify-start gap-x-5 gap-y-2"
          aria-label="Footer"
        >
          <Link to="/read" className={linkClass} style={linkStyle}>Read</Link>
          <Link to="/craft" className={linkClass} style={linkStyle}>Craft</Link>
          <Link to="/shop" className={linkClass} style={linkStyle}>Shop</Link>
          <Link to="/learn" className={linkClass} style={linkStyle}>Learn</Link>
          <Link to="/advise" className={linkClass} style={linkStyle}>Advise</Link>
          <Link to="/about" className={linkClass} style={linkStyle}>About</Link>
          <a href="https://instagram.com/teajia.journal" target="_blank" rel="noopener noreferrer" className={linkClass} style={linkStyle}>Instagram</a>
          <a href="mailto:hello@teajia.com" className={linkClass} style={linkStyle}>Contact</a>
        </nav>

        {/* Base — emblem + copyright + admin */}
        <div className="mt-7 flex items-center justify-between border-t border-tea-border pt-4 pb-nav-gap md:pb-2">
          <div className="flex items-center gap-2">
            <LogoEmblem size={16} color="var(--tea-gold)" />
            <span className="text-ui-11 text-tea-text-dim/70 font-sans tracking-wide">
              &copy; {new Date().getFullYear()} Teajia
            </span>
          </div>
          <Link
            to="/admin"
            className="tap-target text-ui-11 text-tea-text-dim/70 hover:text-tea-text-sec tracking-wide transition-colors duration-300 font-sans"
          >
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
