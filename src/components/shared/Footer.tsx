import React from 'react';
import { Link } from 'react-router-dom';
import { LogoEmblem } from '../Logos';

/**
 * Site footer — matches the Craft / Learn closing register: a warm divider,
 * then an inset panel holding the emblem, the editorial line, and a
 * divider-flanked wordmark. Nav + colophon sit quietly below the panel.
 * Uses shared tea tokens + utility classes so it reads identically everywhere.
 */
const links: { label: string; to?: string; href?: string }[] = [
  { label: 'Read', to: '/read' },
  { label: 'Craft', to: '/craft' },
  { label: 'Shop', to: '/shop' },
  { label: 'Learn', to: '/learn' },
  { label: 'Advise', to: '/advise' },
  { label: 'About', to: '/about' },
  { label: 'Instagram', href: 'https://instagram.com/teajia.journal' },
  { label: 'Contact', href: 'mailto:hello@teajia.com' },
];

const linkClass =
  'text-ui-11 uppercase tracking-[0.1em] font-sans text-tea-text-sec hover:text-tea-text transition-colors duration-200';

function FooterLink({ label, to, href }: { label: string; to?: string; href?: string }) {
  if (to) return <Link to={to} className={linkClass}>{label}</Link>;
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
    <footer
      className="pb-32 md:pb-24 lg:pb-10"
      style={{
        paddingLeft: 'clamp(24px,5vw,56px)',
        paddingRight: 'clamp(24px,5vw,56px)',
        paddingTop: 'clamp(32px,5vw,56px)',
      }}
    >
      <div className="max-w-3xl mx-auto">
        <div className="divider-warm mb-10" />

        {/* Inset panel — the Craft-style closing block */}
        <div className="inset-panel" style={{ padding: 'clamp(32px,5vw,56px)' }}>
          <div className="text-center max-w-md mx-auto">
            {/* Circle emblem — muted */}
            <div className="flex justify-center mb-6" style={{ opacity: 0.7 }}>
              <LogoEmblem size={38} color="var(--tea-text-sec)" />
            </div>

            {/* Editorial line */}
            <p
              className="text-tea-text/80 leading-[1.6] mb-0"
              style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: 'clamp(18px,2.4vw,24px)',
              }}
            >
              Every culture brings wisdom to the table.
            </p>

            {/* Divider-flanked wordmark */}
            <div className="mt-8 flex items-center justify-center gap-2.5">
              <div className="w-6 h-px bg-tea-gold/15" />
              <span className="text-ui-9 font-sans uppercase tracking-[0.25em] text-tea-text-dim">
                Teajia &middot; Fine Tea &amp; Teaware
              </span>
              <div className="w-6 h-px bg-tea-gold/15" />
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav
          aria-label="Footer"
          className="flex flex-wrap justify-center gap-x-6 gap-y-3"
          style={{ marginTop: 'clamp(28px,4vw,40px)' }}
        >
          {links.map((l) => <FooterLink key={l.label} {...l} />)}
        </nav>

        {/* Colophon base — copyright + admin */}
        <div className="mt-8 pt-5 flex items-center justify-between flex-wrap gap-3 border-t border-tea-border">
          <span className="text-ui-10 font-sans tracking-[0.14em] text-tea-text-dim">
            &copy; {new Date().getFullYear()} Teajia
          </span>
          <FooterLink label="Admin" to="/admin" />
        </div>
      </div>
    </footer>
  );
}
