import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { LogoEmblem } from '../Logos/LogoEmblem';
import { useAppStore } from '../../lib/store';
import { DISPOSITIONS } from './dispositions';
import { QUESTIONS, optionLabel } from './questions';
import { recommend } from './recommendations';
import type { TeaDiscoveryProfile } from './types';

interface DiscoveryResultProps {
  profile: TeaDiscoveryProfile;
  onRetake: () => void;
}

/** Short, editorial key for each question on the summary list. */
const SUMMARY_KEYS: Record<string, string> = {
  experience: 'Where you are',
  brew: 'How you brew',
  flavor: 'Flavor',
  temperament: 'How you take it',
  motivation: 'Tea gives you',
};

export const DiscoveryResult: React.FC<DiscoveryResultProps> = ({ profile, onRetake }) => {
  const authUser = useAppStore((s) => s.authUser);
  const disposition = DISPOSITIONS[profile.dispositionId] ?? DISPOSITIONS.curiousBeginner;
  const recommendations = recommend(profile);

  const summary = QUESTIONS.map((q) => {
    const a = profile.answers[q.id];
    const ids = Array.isArray(a) ? a : a ? [a] : [];
    const labels = ids.map((id) => optionLabel(q.id, id)).filter(Boolean) as string[];
    return { key: SUMMARY_KEYS[q.id] ?? q.prompt, labels };
  }).filter((row) => row.labels.length > 0);

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* Hero — the mirror */}
      <div className="flex flex-col items-center pt-8 pb-2 text-center">
        <LogoEmblem size={44} color="var(--tea-gold)" className="mb-6 opacity-70" />
        <p className="font-sans text-ui-11 uppercase tracking-[1.4px] text-tea-text-dim">
          Your tea disposition
        </p>
        <h1 className={`${TYPOGRAPHY_CLASSES.h1} mt-3 text-tea-text`}>{disposition.name}</h1>
        <p className="mt-4 max-w-md font-body text-ui-16 leading-relaxed text-tea-text-sec">
          {disposition.description}
        </p>
      </div>

      {/* Answer summary */}
      <dl className="mt-9 divide-y divide-tea-border rounded-xl border border-tea-border bg-tea-surface">
        {summary.map((row) => (
          <div key={row.key} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4">
            <dt className="font-sans text-ui-11 uppercase tracking-[1.2px] text-tea-text-dim sm:w-36 sm:shrink-0 sm:pt-0.5">
              {row.key}
            </dt>
            <dd className="font-body text-ui-14 leading-snug text-tea-text">
              {row.labels.join(' · ')}
            </dd>
          </div>
        ))}
      </dl>

      {/* Evolution seed — deepens with practice, not points */}
      <div className="mt-7 rounded-xl border border-tea-border bg-tea-elevated px-5 py-4">
        <p className="font-body text-ui-14 leading-relaxed text-tea-text-sec">
          This is a beginning, not a label. Your disposition deepens as your practice does — every tea
          you sit with teaches it a little more.{' '}
          <Link
            to="/account/journal"
            className="text-tea-text underline decoration-tea-gold/40 underline-offset-2 hover:decoration-tea-gold"
          >
            Start a tasting journal
          </Link>{' '}
          and watch it grow.
        </p>
      </div>

      {/* Recommendations — tailored to level, flavor leaning, and how they brew */}
      <div className="mt-8">
        <p className="font-sans text-ui-11 uppercase tracking-[1.4px] text-tea-text-dim mb-3">
          Where to begin
        </p>
        <div className="flex flex-col gap-2.5">
          {recommendations.map((rec) => (
            <Link
              key={rec.kind}
              to={rec.to}
              className="group flex items-start justify-between gap-3 rounded-xl border border-tea-border bg-tea-surface px-4 py-3.5 transition-colors hover:border-tea-gold/40 hover:bg-tea-elevated"
            >
              <span className="min-w-0">
                <span className="block font-body text-ui-15 text-tea-text">{rec.title}</span>
                <span className="mt-0.5 block font-body text-ui-13 leading-snug text-tea-text-sec">
                  {rec.rationale}
                </span>
              </span>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-tea-text-sec transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </div>

      {/* Sign-in nudge (signed-out only) — keep your profile across devices */}
      {!authUser && (
        <p className="mt-7 text-center font-body text-ui-13 leading-relaxed text-tea-text-sec">
          Your profile is saved on this device.{' '}
          <Link
            to="/signin"
            className="text-tea-text underline decoration-tea-gold/40 underline-offset-2 hover:decoration-tea-gold"
          >
            Sign in to keep it
          </Link>{' '}
          — so the right tea, and the right words, can find you.
        </p>
      )}

      {/* Retake */}
      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={onRetake}
          className="tap-target inline-flex items-center gap-1.5 font-sans text-ui-13 text-tea-text-sec transition-colors hover:text-tea-text"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Not quite you? Start over
        </button>
      </div>
    </div>
  );
};
