import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-10 border-t border-tea-border px-6 py-5 pb-20 md:pb-6">
      <div className="flex items-center justify-between max-w-screen-lg mx-auto">
        <span className="text-[11px] text-tea-text/35 font-sans tracking-wide">
          teajia &copy; {new Date().getFullYear()}
        </span>
        <div className="flex items-center gap-4">
          <a
            href="https://instagram.com/teajia.journal"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-tea-text/35 hover:text-tea-gold tracking-wide transition-colors duration-300 font-sans"
          >
            Instagram
          </a>
          <a
            href="mailto:hello@teajia.com"
            className="text-[11px] text-tea-text/35 hover:text-tea-gold tracking-wide transition-colors duration-300 font-sans"
          >
            Contact
          </a>
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
