import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Colophon-style site footer — matches the Read section's closing block.
 * Self-contained palette/fonts so it renders identically on every page,
 * independent of the immersive module or the tea-* Tailwind tokens.
 */
const C = {
  taupe: '#cdc0a8',
  dim: '#80735f',
  gold: 'var(--tj-gold,#a8874d)',
  hair: 'rgba(168,135,77,0.14)',
} as const;
const F = {
  display: "'Cormorant Garamond',serif",
  body: "'Lora',Georgia,serif",
  mono: "'IBM Plex Mono',monospace",
  cn: "'Noto Serif SC',serif",
} as const;

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

const linkStyle: React.CSSProperties = {
  fontFamily: F.mono,
  fontSize: 11,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: C.dim,
  textDecoration: 'none',
  transition: 'color 240ms',
};

function FooterLink({ label, to, href }: { label: string; to?: string; href?: string }) {
  const onEnter = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.color = C.taupe; };
  const onLeave = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.color = C.dim; };
  if (to) {
    return <Link to={to} style={linkStyle} onMouseEnter={onEnter} onMouseLeave={onLeave}>{label}</Link>;
  }
  return (
    <a
      href={href}
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      style={linkStyle}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {label}
    </a>
  );
}

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: `1px solid ${C.hair}`,
        padding: 'clamp(44px,6vw,72px) clamp(24px,5vw,56px) clamp(28px,4vw,40px)',
        textAlign: 'center',
      }}
    >
      {/* 茶 emblem */}
      <div aria-hidden="true" style={{ fontFamily: F.cn, fontSize: 38, fontWeight: 200, color: C.gold, opacity: 0.7, marginBottom: 24 }}>
        茶
      </div>

      {/* Editorial line */}
      <p style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 'clamp(18px,2.4vw,24px)', lineHeight: 1.5, color: C.taupe, margin: '0 auto', maxWidth: 560 }}>
        Every culture brings wisdom to the table.
      </p>

      {/* Mono breadcrumb */}
      <div style={{ marginTop: 30, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 }}>
        Teajia · Fine Tea &amp; Teaware
      </div>

      {/* Link row */}
      <nav
        aria-label="Footer"
        style={{
          marginTop: 'clamp(32px,5vw,48px)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '12px 22px',
        }}
      >
        {links.map((l) => <FooterLink key={l.label} {...l} />)}
      </nav>

      {/* Base — copyright + admin */}
      <div
        className="pb-nav-gap md:pb-0"
        style={{
          marginTop: 'clamp(32px,5vw,48px)',
          paddingTop: 20,
          borderTop: `1px solid ${C.hair}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.14em', color: C.dim }}>
          &copy; {new Date().getFullYear()} Teajia
        </span>
        <FooterLink label="Admin" to="/admin" />
      </div>
    </footer>
  );
}
