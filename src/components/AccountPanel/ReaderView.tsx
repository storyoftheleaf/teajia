import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Compass, Building2 } from 'lucide-react';
import { READER_EXPLORE_LINKS } from './workflows';

interface ReaderViewProps {
  onClose: () => void;
  onOpenSignIn: () => void;
  onOpenSignUp: () => void;
  onOpenEvents: () => void;
}

const ICON_PROPS = { size: 14, strokeWidth: 1.5 } as const;

// Small text-link cluster, matches the footer pattern used across the
// panel views — no chevrons, no row grammar.
const LinkCluster: React.FC<{
  hint: string;
  icon?: React.ReactNode;
  links: { label: string; onClick: () => void }[];
}> = ({ hint, icon, links }) => (
  <div className="px-6 py-6 border-t border-tea-border">
    <div className="flex items-center gap-2 label-caps text-tea-text-dim">
      {icon && <span className="text-tea-text-sec shrink-0 flex items-center" aria-hidden="true">{icon}</span>}
      <span>{hint}</span>
    </div>
    <div className="w-8 h-px bg-tea-gold/40 mt-2 mb-3.5 ml-[22px]" aria-hidden="true" />
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {links.map((link, i) => (
        <React.Fragment key={link.label}>
          {i > 0 && <span className="text-tea-text-dim" aria-hidden="true">·</span>}
          <button
            onClick={link.onClick}
            className="font-display text-ui-15 text-tea-text-sec hover:text-tea-text py-1 -my-1 transition-colors"
            style={{ WebkitTapHighlightColor: 'transparent' }}
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
        <p className="label-caps text-tea-text-dim mb-3">Teajia</p>
        <h2 className="h2">
          Gather <em className="text-tea-gold italic">around tea.</em>
        </h2>
        <p className="subtitle mt-3">
          A home for practitioners, readers, and those just beginning.
        </p>
      </div>

      {/* ── Primary + secondary CTA ─────────────────────────────────── */}
      <div className="px-6 pb-6 space-y-2">
        <button
          onClick={onOpenSignIn}
          className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 active:bg-tea-gold/80 transition-colors"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          Sign in
        </button>
        <button
          onClick={onOpenSignUp}
          className="w-full px-3 py-2 rounded-md text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors text-xs"
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
          { label: 'Attend a session', onClick: onOpenEvents },
        ]}
      />

      {/* ── Explore ───────────────────────────────────────────────────── */}
      <LinkCluster
        hint="Explore"
        icon={<Compass {...ICON_PROPS} />}
        links={READER_EXPLORE_LINKS.map(link => ({
          label: link.label,
          onClick: () => go(link.route),
        }))}
      />

      {/* ── For your space (B2B outreach) ─────────────────────────────── */}
      <LinkCluster
        hint="For your space"
        icon={<Building2 {...ICON_PROPS} />}
        links={[
          { label: 'Tea for hotels, studios & retreats', onClick: () => go('/for-your-space') },
        ]}
      />

      <div className="pb-nav lg:pb-8" />
    </div>
  );
};
