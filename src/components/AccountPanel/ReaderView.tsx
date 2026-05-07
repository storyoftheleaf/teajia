import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Compass, Building2 } from 'lucide-react';

interface ReaderViewProps {
  onClose: () => void;
  onOpenSignIn: () => void;
  onOpenSignUp: () => void;
  onOpenEvents: () => void;
}

const ICON_PROPS = { size: 14, strokeWidth: 1.5 } as const;

// Small text-link cluster, matches the footer pattern used in
// MemberView/OperatorView — no chevrons, no row grammar.
const LinkCluster: React.FC<{
  hint: string;
  icon?: React.ReactNode;
  links: { label: string; onClick: () => void }[];
}> = ({ hint, icon, links }) => (
  <div className="px-6 py-6 border-t border-tea-border">
    <div className="flex items-center gap-2 text-ui-12 uppercase tracking-[0.22em] text-tea-text font-medium">
      {icon && <span className="text-tea-gold/70 shrink-0 flex items-center" aria-hidden="true">{icon}</span>}
      <span>{hint}</span>
    </div>
    <div className="w-8 h-px bg-tea-gold/40 mt-2 mb-3.5 ml-[22px]" aria-hidden="true" />
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-ui-14 text-tea-text-sec tracking-[0.01em]">
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
        <p className="text-ui-11 uppercase tracking-[0.28em] text-tea-text-sec font-medium mb-3">Teajia</p>
        <h2
          className="text-[30px] font-normal text-tea-text leading-[1.05] tracking-[-0.5px]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Gather <em className="text-tea-gold italic">around tea.</em>
        </h2>
        <p
          className="italic text-ui-15 text-tea-text-sec mt-3 leading-relaxed"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          A home for practitioners, readers, and those just beginning.
        </p>
      </div>

      {/* ── Primary + secondary CTA ─────────────────────────────────── */}
      <div className="px-6 pb-6">
        <button
          onClick={onOpenSignIn}
          className="w-full py-3.5 bg-tea-gold text-tea-bg text-ui-12 uppercase tracking-[0.22em] font-semibold rounded-sm hover:bg-tea-gold-lt transition-colors"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          Sign In
        </button>
        <button
          onClick={onOpenSignUp}
          className="w-full mt-2 py-3 text-ui-12 uppercase tracking-[0.18em] text-tea-text-sec hover:text-tea-text transition-colors"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          Create an account
        </button>
      </div>

      {/* ── What's inside — text-link cluster, not rows ─────────────── */}
      <LinkCluster
        hint="What's inside"
        icon={<Sparkles {...ICON_PROPS} />}
        links={[
          { label: 'Journal your sessions', onClick: onOpenSignUp },
          { label: 'Find teas for your taste', onClick: () => go('/compass') },
          { label: 'Attend a session', onClick: onOpenEvents },
        ]}
      />

      {/* ── Explore ───────────────────────────────────────────────────── */}
      <LinkCluster
        hint="Explore"
        icon={<Compass {...ICON_PROPS} />}
        links={[
          { label: 'The Magazine', onClick: () => go('/magazine') },
          { label: 'Shop', onClick: () => go('/shop') },
          { label: 'Our Spaces', onClick: () => go('/spaces') },
        ]}
      />

      {/* ── For your space (B2B outreach) ─────────────────────────────── */}
      <LinkCluster
        hint="For your space"
        icon={<Building2 {...ICON_PROPS} />}
        links={[
          { label: 'Tea for hotels, studios & retreats', onClick: () => go('/for-your-space') },
        ]}
      />

      <div className="pb-[calc(52px+env(safe-area-inset-bottom,0px))] lg:pb-8" />
    </div>
  );
};
