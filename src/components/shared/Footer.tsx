import React from 'react';
import { Link } from 'react-router-dom';
import { LogoEmblem } from '../Logos';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-tea-border">
      <div className="max-w-screen-lg mx-auto px-6 pt-10 pb-6">
        {/* Top row — brand + nav */}
        <div className="flex flex-col sm:flex-row gap-8 sm:gap-12 mb-10">
          {/* Brand column */}
          <div className="flex flex-col gap-3 sm:min-w-[180px]">
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
              className="text-[13px] text-tea-text-sec leading-relaxed max-w-[240px]"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Fine tea &amp; teaware. Every culture brings wisdom to the table.
            </p>
          </div>

          {/* Navigation columns */}
          <div className="flex gap-12 sm:gap-16">
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] uppercase tracking-[0.2em] text-tea-gold/70 font-sans font-semibold mb-1">Explore</span>
              <Link to="/magazine" className="text-[13px] text-tea-text-sec hover:text-tea-gold transition-colors duration-300" style={{ fontFamily: 'var(--font-body)' }}>Magazine</Link>
              <Link to="/learn" className="text-[13px] text-tea-text-sec hover:text-tea-gold transition-colors duration-300" style={{ fontFamily: 'var(--font-body)' }}>Learn</Link>
              <Link to="/shop" className="text-[13px] text-tea-text-sec hover:text-tea-gold transition-colors duration-300" style={{ fontFamily: 'var(--font-body)' }}>Shop</Link>
              <Link to="/consult" className="text-[13px] text-tea-text-sec hover:text-tea-gold transition-colors duration-300" style={{ fontFamily: 'var(--font-body)' }}>Consult</Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] uppercase tracking-[0.2em] text-tea-gold/70 font-sans font-semibold mb-1">Connect</span>
              <a
                href="https://instagram.com/teajia.journal"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] text-tea-text-sec hover:text-tea-gold transition-colors duration-300"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Instagram
              </a>
              <a
                href="mailto:hello@teajia.com"
                className="text-[13px] text-tea-text-sec hover:text-tea-gold transition-colors duration-300"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Contact
              </a>
              <Link to="/about" className="text-[13px] text-tea-text-sec hover:text-tea-gold transition-colors duration-300" style={{ fontFamily: 'var(--font-body)' }}>About</Link>
            </div>
          </div>
        </div>

        {/* Bottom row — copyright */}
        <div className="flex items-center justify-between border-t border-tea-border pt-5 pb-14 md:pb-2">
          <span className="text-[12px] text-tea-text-sec/60 font-sans tracking-wide">
            &copy; {new Date().getFullYear()} Teajia
          </span>
          <Link
            to="/admin"
            className="text-[11px] text-tea-text/15 hover:text-tea-gold tracking-wide transition-colors duration-300 font-sans"
          >
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
