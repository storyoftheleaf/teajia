import React from 'react';
import { Link } from 'react-router-dom';
import { LogoEmblem } from '../Logos';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-tea-border">
      <div className="max-w-screen-lg mx-auto px-6 pt-10 pb-6">
        {/* Top row — brand + nav */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8 sm:gap-12 mb-10">
          {/* Brand column */}
          <div className="flex flex-col gap-3 sm:max-w-[260px]">
            <div className="flex items-center gap-2.5">
              <LogoEmblem size={22} color="var(--tea-gold)" />
              <span
                className="text-base text-tea-text tracking-wide"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 300 }}
              >
                Teajia
              </span>
            </div>
            <p
              className="text-ui-13 text-tea-text-dim leading-relaxed"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Fine tea and teaware. Every culture brings wisdom to the table.
            </p>
          </div>

          {/* Navigation columns */}
          <div className="flex gap-12 sm:gap-16">
            <div className="flex flex-col gap-2.5">
              <span className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-dim/70 font-sans font-semibold mb-1">Explore</span>
              <Link to="/read" className="text-ui-13 text-tea-text-dim hover:text-tea-text-sec transition-colors duration-300" style={{ fontFamily: 'var(--font-body)' }}>Read</Link>
              <Link to="/craft" className="text-ui-13 text-tea-text-dim hover:text-tea-text-sec transition-colors duration-300" style={{ fontFamily: 'var(--font-body)' }}>Craft</Link>
              <Link to="/shop" className="text-ui-13 text-tea-text-dim hover:text-tea-text-sec transition-colors duration-300" style={{ fontFamily: 'var(--font-body)' }}>Shop</Link>
              <Link to="/learn" className="text-ui-13 text-tea-text-dim hover:text-tea-text-sec transition-colors duration-300" style={{ fontFamily: 'var(--font-body)' }}>Learn</Link>
              <Link to="/advise" className="text-ui-13 text-tea-text-dim hover:text-tea-text-sec transition-colors duration-300" style={{ fontFamily: 'var(--font-body)' }}>Advise</Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-dim/70 font-sans font-semibold mb-1">Connect</span>
              <a
                href="https://instagram.com/teajia.journal"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ui-13 text-tea-text-dim hover:text-tea-text-sec transition-colors duration-300"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Instagram
              </a>
              <a
                href="mailto:hello@teajia.com"
                className="text-ui-13 text-tea-text-dim hover:text-tea-text-sec transition-colors duration-300"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Contact
              </a>
              <Link to="/about" className="text-ui-13 text-tea-text-dim hover:text-tea-text-sec transition-colors duration-300" style={{ fontFamily: 'var(--font-body)' }}>About</Link>
            </div>
          </div>
        </div>

        {/* Bottom row — copyright */}
        <div className="flex items-center justify-between border-t border-tea-border pt-5 pb-nav-gap md:pb-2">
          <span className="text-ui-12 text-tea-text-dim/70 font-sans tracking-wide">
            &copy; {new Date().getFullYear()} Teajia
          </span>
          <Link
            to="/admin"
            className="tap-target text-ui-11 text-tea-text-dim hover:text-tea-text tracking-wide transition-colors duration-300 font-sans"
          >
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
