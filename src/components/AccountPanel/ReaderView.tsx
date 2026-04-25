import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ReaderViewProps {
  onClose: () => void;
  onOpenSignIn: () => void;
  onOpenSignUp: () => void;
  onOpenEvents: () => void;
}

// Small text-link cluster, matches the footer pattern used in
// MemberView/OperatorView — no chevrons, no row grammar.
const LinkCluster: React.FC<{
  hint: string;
  links: { label: string; onClick: () => void }[];
}> = ({ hint, links }) => (
  <div className="px-6 py-5 border-t border-tea-border">
    <div className="text-[11px] uppercase tracking-[0.24em] text-tea-text-sec font-medium mb-3">{hint}</div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] text-tea-text-sec tracking-[0.01em]">
      {links.map((link, i) => (
        <React.Fragment key={link.label}>
          {i > 0 && <span className="text-tea-text-sec" aria-hidden="true">·</span>}
          <button
            onClick={link.onClick}
            className="py-1 -my-1 hover:text-tea-gold transition-colors"
            style={{ fontFamily: 'var(--font-display)', WebkitTapHighlightColor: 'transparent' }}
          >
            {link.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  </div>
);

export const ReaderView: React.FC<ReaderViewProps> = ({
  onClose,
  onOpenSignIn,
  onOpenSignUp,
  onOpenEvents,
}) => {
  const navigate = useNavigate();
  const go = (route: string) => { onClose(); navigate(route); };

  return (
    <div>
      {/* ── Hero — the invitation ───────────────────────────────────── */}
      <div className="px-6 pt-8 pb-6">
        <p className="text-[11px] uppercase tracking-[0.28em] text-tea-text-sec font-medium mb-3">Teajia</p>
        <h2
          className="text-[30px] font-normal text-tea-text leading-[1.05] tracking-[-0.5px]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Gather <em className="text-tea-gold italic">around tea.</em>
        </h2>
        <p
          className="italic text-[15px] text-tea-text-sec mt-3 leading-relaxed"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          A home for practitioners, readers, and those just beginning.
        </p>
      </div>

      {/* ── Primary + secondary CTA ─────────────────────────────────── */}
      <div className="px-6 pb-6">
        <button
          onClick={onOpenSignIn}
          className="w-full py-3.5 bg-tea-gold text-tea-bg text-[12px] uppercase tracking-[0.22em] font-semibold rounded-sm hover:bg-tea-gold-lt transition-colors"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          Sign In
        </button>
        <button
          onClick={onOpenSignUp}
          className="w-full mt-2 py-3 text-[12px] uppercase tracking-[0.18em] text-tea-text-sec hover:text-tea-text transition-colors"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          Create an account
        </button>
      </div>

      {/* ── What's inside — text-link cluster, not rows ─────────────── */}
      <LinkCluster
        hint="What's inside"
        links={[
          { label: 'Journal your sessions', onClick: onOpenSignUp },
          { label: 'Find teas for your taste', onClick: () => go('/compass') },
          { label: 'Attend a session', onClick: onOpenEvents },
        ]}
      />

      {/* ── Explore ───────────────────────────────────────────────────── */}
      <LinkCluster
        hint="Explore"
        links={[
          { label: 'The Magazine', onClick: () => go('/magazine') },
          { label: 'Shop', onClick: () => go('/shop') },
          { label: 'Our Spaces', onClick: () => go('/spaces') },
        ]}
      />

      {/* ── For your space (B2B outreach) ─────────────────────────────── */}
      <LinkCluster
        hint="For your space"
        links={[
          { label: 'Tea for hotels, studios & retreats', onClick: () => go('/for-your-space') },
        ]}
      />

      <div className="pb-[calc(44px+env(safe-area-inset-bottom,0px))] lg:pb-8" />
    </div>
  );
};
