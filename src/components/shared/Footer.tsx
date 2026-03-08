import React from 'react';
import { Link } from 'react-router-dom';
import { Icons } from '../Icons';
import { Section } from '../../types';

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
    <footer className="border-t border-tea-border pt-12 pb-16 md:pt-16 md:pb-20 lg:pb-20 mt-20">
      {/* Navigation links */}
      <nav className="flex flex-wrap justify-center gap-x-6 gap-y-3 mb-8">
        {NAV_LINKS.map((link) => (
          <button
            key={link.label}
            onClick={() => link.section && onNavigate?.(link.section)}
            className="text-sm text-tea-text/60 hover:text-tea-gold transition-colors duration-300 font-sans"
          >
            {link.label}
          </button>
        ))}
      </nav>

      {/* Art Studio link */}
      <div className="text-center mb-8">
        <a
          href="https://instagram.com/teajia.journal"
          target="_blank"
          rel="noopener noreferrer"
          className="text-tea-gold hover:text-tea-gold/80 uppercase tracking-widest text-xs font-medium inline-flex items-center gap-2 transition-colors duration-300"
        >
          Explore Adrian's Art Studio
          <Icons.ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Contact */}
      <p className="text-center text-sm text-tea-text/50 font-sans mb-4">
        Questions?{' '}
        <a
          href="mailto:hello@teajia.com"
          className="hover:text-tea-gold transition-colors duration-300"
        >
          hello@teajia.com
        </a>
      </p>

      {/* Copyright */}
      <p className="text-center text-xs text-tea-text/40 font-sans tracking-wide">
        teajia &copy; {new Date().getFullYear()}
      </p>

      {/* Admin access */}
      <div className="text-center mt-6">
        <Link
          to="/admin"
          className="text-[10px] text-tea-text/20 hover:text-tea-gold font-mono tracking-widest uppercase transition-colors duration-300"
        >
          Admin
        </Link>
      </div>
    </footer>
  );
}
