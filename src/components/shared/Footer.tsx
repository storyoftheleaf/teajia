import React from 'react';
import { Link } from 'react-router-dom';
import { LogoEmblem } from '../Logos';

const linkClass =
  'text-ui-12 sm:text-ui-13 text-tea-text-dim hover:text-tea-text-sec transition-colors duration-300';
const linkStyle = { fontFamily: 'var(--font-body)' } as const;
const labelClass =
  'hidden sm:block text-ui-10 uppercase tracking-[0.2em] text-tea-text-dim/70 font-sans font-semibold mb-1';

export default function Footer() {
  return (
    <footer className="mt-10 border-t border-tea-border">
      <div className="max-w-screen-lg mx-auto px-6 pt-7 pb-4">
        {/* Top — brand + nav. Centered/stacked on mobile, split row on desktop. */}
        <div className="flex flex-col items-center text-center gap-5 sm:flex-row sm:items-start sm:justify-between sm:text-left sm:gap-12 mb-7">
          {/* Brand */}
          <div className="flex flex-col items-center sm:items-start gap-2 sm:max-w-[260px]">
            <div className="flex items-center gap-2.5">
              <LogoEmblem size={20} color="var(--tea-gold)" />
              <span
                className="text-base text-tea-text tracking-wide"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}
              >
                Teajia
              </span>
            </div>
            <p
              className="text-ui-12 sm:text-ui-13 text-tea-text-dim leading-snug"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Fine tea and teaware.
            </p>
          </div>

          {/* Nav — single wrapped inline row on mobile, two columns on desktop */}
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 sm:flex-nowrap sm:justify-start sm:gap-12">
            <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 sm:flex-col sm:gap-2" aria-label="Explore">
              <span className={labelClass}>Explore</span>
              <Link to="/read" className={linkClass} style={linkStyle}>Read</Link>
              <Link to="/craft" className={linkClass} style={linkStyle}>Craft</Link>
              <Link to="/shop" className={linkClass} style={linkStyle}>Shop</Link>
              <Link to="/learn" className={linkClass} style={linkStyle}>Learn</Link>
              <Link to="/advise" className={linkClass} style={linkStyle}>Advise</Link>
            </nav>
            <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 sm:flex-col sm:gap-2" aria-label="Connect">
              <span className={labelClass}>Connect</span>
              <a href="https://instagram.com/teajia.journal" target="_blank" rel="noopener noreferrer" className={linkClass} style={linkStyle}>Instagram</a>
              <a href="mailto:hello@teajia.com" className={linkClass} style={linkStyle}>Contact</a>
              <Link to="/about" className={linkClass} style={linkStyle}>About</Link>
            </nav>
          </div>
        </div>

        {/* Bottom — copyright + admin on one line */}
        <div className="flex items-center justify-between border-t border-tea-border pt-4 pb-nav-gap md:pb-2">
          <span className="text-ui-11 text-tea-text-dim/70 font-sans tracking-wide">
            &copy; {new Date().getFullYear()} Teajia
          </span>
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
