import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Icons } from '../Icons';
import { Section } from '../../types';
import { AnimatedDivider } from './AnimatedDivider';

const NAV_LINKS: { label: string; section?: Section }[] = [
  { label: 'Read', section: 'MAGAZINE' },
  { label: 'Learn', section: 'LEARN' },
  { label: 'Shop', section: 'SHOP' },
  { label: 'Consult', section: 'OFFERINGS' },
];

interface FooterProps {
  onNavigate?: (section: Section) => void;
}

export default function Footer({ onNavigate }: FooterProps) {
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

      {/* Navigation links — staggered entrance */}
      <nav className="flex flex-wrap justify-center gap-x-8 gap-y-3 mb-10">
        {NAV_LINKS.map((link, i) => (
          <motion.button
            key={link.label}
            onClick={() => link.section && onNavigate?.(link.section)}
            className="text-sm text-tea-text/60 hover:text-tea-gold transition-colors duration-300 font-sans uppercase tracking-[0.15em]"
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            viewport={{ once: true }}
          >
            {link.label}
          </motion.button>
        ))}
      </nav>

      {/* Middle layer: inset panel with depth */}
      <div className="inset-panel mx-4 md:mx-8 lg:mx-16 p-8 md:p-12 mb-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          {/* Brand statement */}
          <div className="max-w-sm">
            <p className="font-serif text-lg text-tea-text/80 leading-relaxed" style={{ fontFamily: 'var(--font-display)' }}>
              Fine tea, told well.
            </p>
            <p className="text-xs text-tea-text/40 mt-2 font-sans">
              Curated teas, stories, and education from twenty years of tea culture.
            </p>
          </div>

          {/* Links cluster */}
          <div className="flex flex-col gap-3 items-start md:items-end">
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
