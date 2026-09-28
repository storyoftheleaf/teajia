import React from 'react';
import { Link } from 'react-router-dom';
import { LogoEmblem } from '../Logos';
import { PUBLIC_REFERENCE_ROUTES } from '../navigationConnections';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

const links: { label: string; to?: string; href?: string }[] = [
  { label: 'Read', to: '/read' },
  { label: 'Craft', to: '/craft' },
  { label: 'Shop', to: '/shop' },
  { label: 'Advise', to: '/advise' },
  { label: 'People', to: PUBLIC_REFERENCE_ROUTES.people },
  { label: 'Tea Wisdom', to: PUBLIC_REFERENCE_ROUTES.wisdom },
  { label: 'About', to: '/about' },
  { label: 'Instagram', href: 'https://instagram.com/teajia.journal' },
  { label: 'Contact', href: 'mailto:hello@teajia.com' },
];

const linkClass = `${TYPOGRAPHY_CLASSES.nav} inline-flex min-h-11 items-center text-[var(--tea-footer-ink-dim)] transition-colors duration-200 hover:text-[var(--tea-footer-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--tea-footer-band)]`;

function FooterLink({ label, to, href }: { label: string; to?: string; href?: string }) {
  if (to) {
    return <Link to={to} className={linkClass}>{label}</Link>;
  }
  return (
    <a
      href={href}
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      className={linkClass}
    >
      {label}
    </a>
  );
}

export default function Footer() {
  return (
    <footer className="site-footer border-t border-tea-border bg-[var(--tea-footer-band)] px-6 pt-14 pb-8 sm:px-10 lg:px-14 lg:pt-20 lg:pb-10">
      <div className="mx-auto max-w-[1160px]">
        <div className="flex flex-col items-center text-center">
          <div className="opacity-70"><LogoEmblem size={38} color="var(--tea-footer-ink)" /></div>
          <p className={`${TYPOGRAPHY_CLASSES.h3} mt-6 max-w-[28ch] italic sm:text-2xl text-[var(--tea-footer-ink)]`}>
            Every culture brings wisdom to the table.
          </p>
        </div>

        <nav aria-label="Footer" className="mt-10 grid grid-cols-3 gap-x-4 border-t border-tea-border pt-5 sm:mt-12 sm:flex sm:flex-wrap sm:justify-center sm:gap-x-7 sm:gap-y-1 sm:border-0 sm:pt-0">
          {links.map(link => <FooterLink key={link.label} {...link} />)}
        </nav>

        <div className="pb-nav-gap mt-7 flex items-center justify-between gap-4 border-t border-tea-border pt-5 sm:mt-10">
          <span className={`${TYPOGRAPHY_CLASSES.label} text-[var(--tea-footer-ink-dim)]`}>
            &copy; {new Date().getFullYear()} Teajia
          </span>
          <FooterLink label="Admin" to="/admin" />
        </div>
      </div>
    </footer>
  );
}
