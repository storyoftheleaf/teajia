import React from 'react';
import { Link } from 'react-router-dom';
import { Icons } from '../Icons';
import { AnimatedDivider } from './AnimatedDivider';

export default function Footer() {
  return (
    <footer className="relative mt-20">
      {/* Top layer: warm gradient fade */}
      <div
        className="absolute top-0 left-0 right-0 h-24 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, transparent, rgba(184, 146, 78, 0.03) 50%, rgba(184, 146, 78, 0.06))',
        }}
      />

      {/* Animated divider */}
      <AnimatedDivider ornament />

      {/* Middle layer: inset panel with depth */}
      <div className="inset-panel mx-4 md:mx-8 lg:mx-16 p-8 md:p-12 mb-10">
        <div className="flex flex-col items-center gap-3">
          <a
            href="https://instagram.com/teajia.journal"
            target="_blank"
            rel="noopener noreferrer"
            className="text-tea-gold hover:text-tea-gold/80 uppercase tracking-[0.15em] text-xs font-medium inline-flex items-center gap-2 transition-colors duration-300"
          >
            Art Studio
            <Icons.ExternalLink className="w-3.5 h-3.5" />
          </a>
          <a
            href="mailto:hello@teajia.com"
            className="text-tea-text/50 hover:text-tea-gold text-xs transition-colors duration-300 font-sans"
          >
            hello@teajia.com
          </a>
        </div>
      </div>

      {/* Bottom layer: copyright + admin */}
      <div className="pb-16 md:pb-20 lg:pb-20 text-center">
        <p className="text-xs text-tea-text/40 font-sans tracking-wide mb-4">
          teajia &copy; {new Date().getFullYear()}
        </p>
        <Link
          to="/admin"
          className="text-[10px] text-tea-text/15 hover:text-tea-gold font-mono tracking-[0.15em] uppercase transition-colors duration-300"
        >
          Admin
        </Link>
      </div>
    </footer>
  );
}
