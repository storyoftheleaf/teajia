import React from 'react';
import { Link } from 'react-router-dom';
import { LogoEmblem } from '../Logos';
import { EmailCapture } from '../EmailCapture';

type FooterLink = { label: string; to?: string; href?: string };

const COLUMNS: { heading: string; links: FooterLink[] }[] = [
  {
    heading: 'Explore',
    links: [
      { label: 'Read', to: '/read' },
      { label: 'Craft', to: '/craft' },
      { label: 'Shop', to: '/shop' },
      { label: 'Advise', to: '/advise' },
    ],
  },
  {
    heading: 'Learn',
    links: [
      { label: 'Courses', to: '/learn' },
      { label: 'About', to: '/about' },
    ],
  },
  {
    heading: 'Visit',
    links: [
      { label: 'For Your Space', to: '/for-your-space' },
      { label: 'Tea Spaces', to: '/spaces' },
      { label: 'Store Playbook', to: '/stores/playbook' },
    ],
  },
  {
    heading: 'Connect',
    links: [
      { label: 'Instagram', href: 'https://instagram.com/teajia.journal' },
      { label: 'Contact', href: 'mailto:hello@teajia.com' },
    ],
  },
];

const linkClass =
  'text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors duration-300';
const linkStyle = { fontFamily: 'var(--font-body)' } as const;

function FooterLinkItem({ link }: { link: FooterLink }) {
  if (link.to) {
    return (
      <Link to={link.to} className={linkClass} style={linkStyle}>
        {link.label}
      </Link>
    );
  }
  return (
    <a
      href={link.href}
      target={link.href?.startsWith('http') ? '_blank' : undefined}
      rel={link.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      className={linkClass}
      style={linkStyle}
    >
      {link.label}
    </a>
  );
}

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-tea-border bg-tea-surface">
      {/* Newsletter band — the one action a footer should carry */}
      <div className="border-b border-tea-border">
        <div className="max-w-screen-lg mx-auto px-6 py-10 md:py-12">
          <EmailCapture
            heading="Stay close to the leaf"
            subtitle="Monthly tea insights, seasonal picks, and first access to rare releases."
            className="max-w-2xl"
          />
        </div>
      </div>

      {/* Link grid */}
      <div className="max-w-screen-lg mx-auto px-6 pt-12 pb-8">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-[1.4fr_repeat(4,1fr)] sm:gap-x-10">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-1 flex flex-col gap-3">
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
              className="text-ui-13 text-tea-text-sec leading-relaxed max-w-[240px]"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Fine tea and teaware. Every culture brings wisdom to the table.
            </p>
          </div>

          {/* Navigation columns */}
          {COLUMNS.map((col) => (
            <nav key={col.heading} className="flex flex-col gap-2.5" aria-label={col.heading}>
              <span className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-dim font-sans font-semibold mb-1">
                {col.heading}
              </span>
              {col.links.map((link) => (
                <FooterLinkItem key={link.label} link={link} />
              ))}
            </nav>
          ))}
        </div>
      </div>

      {/* Base row — copyright + quiet utility */}
      <div className="border-t border-tea-border">
        <div className="max-w-screen-lg mx-auto px-6 flex items-center justify-between pt-5 pb-nav-gap md:pb-4">
          <span className="text-ui-12 text-tea-text-sec/70 font-sans tracking-wide">
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
