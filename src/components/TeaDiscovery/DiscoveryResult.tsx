import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { LogoEmblem } from '../Logos/LogoEmblem';
import { useAppStore } from '../../lib/store';
import { api } from '../../lib/api';
import { THREADS, profileThreads } from './threads';
import { QUESTIONS, optionLabel } from './questions';
import { recommend } from './recommendations';
import { observePalate, noteRichness, suggestEvolution, type FlavorFamily } from './evolution';
import type { DiscoveryLevel, TeaDiscoveryProfile } from './types';

const DAYS = 86_400_000;
/** The dimension behaviour can't observe, re-asked, never inferred. */
const TEMPERAMENT_Q = QUESTIONS.find((q) => q.id === 'temperament')!;

/** Human label for a flavor family, matches the quiz's swatch wording. */
const FAMILY_LABEL: Record<FlavorFamily, string> = {
  light: 'lighter, fresher teas',
  roasted: 'roasted, fuller teas',
  deep: 'deep, aged teas',
};

interface DiscoveryResultProps {
  profile: TeaDiscoveryProfile;
  onRetake: () => void;
  /** Adopt a behaviour-suggested level/threads (opt-in; never automatic). */
  onAdopt: (level: DiscoveryLevel, threadIds: string[]) => void;
  /** Re-answer a single question ("still true?") and re-derive the profile. */
  onReanswer: (questionId: string, value: string | string[]) => void;
}

/** Short, editorial key for each question on the summary list. */
const SUMMARY_KEYS: Record<string, string> = {
  experience: 'Where you are',
  brew: 'How you brew',
  flavor: 'Flavor',
  temperament: 'How you take it',
  motivation: 'Tea gives you',
};

export const DiscoveryResult: React.FC<DiscoveryResultProps> = ({ profile, onRetake, onAdopt, onReanswer }) => {
  const authUser = useAppStore((s) => s.authUser);
  const tastingJournal = useAppStore((s) => s.tastingJournal);
  // Axis 1: the threads that draw them, strongest first. Lead thread + resonances.
  const threadIds = profileThreads(profile);
  const threads = threadIds.map((id) => THREADS[id]).filter(Boolean);

  // Group sessions attended, observed temperament signal (Route A). Members only.
  const [sessionsAttended, setSessionsAttended] = useState(0);
  useEffect(() => {
    if (!authUser) return;
    let alive = true;
    api.me.journey()
      .then((j: any) => { if (alive) setSessionsAttended(j?.sessionsAttended ?? 0); })
      .catch(() => {});
    return () => { alive = false; };
  }, [authUser]);

  // Evolution loop, observe what they actually drink/do and let it refine the
  // recommendations + suggest growth. The chosen disposition is never overwritten.
  const observed = observePalate(tastingJournal);
  const recommendations = recommend(profile, observed);
  const statedFlavor = profile.answers.flavor as string | undefined;

  // Behaviour-suggested evolution (opt-in). Depth + sessions + note richness.
  const suggestion = suggestEvolution(profile, observed, {
    sessionsAttended,
    noteRichness: noteRichness(tastingJournal),
  });
  // The thread(s) the suggestion would add on top of what they already hold.
  const addedThreadNames = suggestion
    ? suggestion.threadIds
        .filter((id) => !threadIds.includes(id))
        .map((id) => THREADS[id]?.name)
        .filter(Boolean)
        .join(' and ')
    : '';

  // Drift: their cups lean somewhere their stated answer didn't (and they had one).
  const drifted =
    !suggestion &&
    observed.hasEnoughSignal &&
    observed.flavorLean != null &&
    statedFlavor != null &&
    statedFlavor !== 'unsure' &&
    statedFlavor !== observed.flavorLean;

  // "Still true?", periodically re-ask the one thing behaviour can't observe
  // (temperament). Shown when the profile is a couple of weeks old and no
  // stronger evolution prompt is up. Answering refreshes completedAt, so it
  // settles for another fortnight.
  const profileAgeDays = (Date.now() - new Date(profile.completedAt).getTime()) / DAYS;
  const currentTemperament = profile.answers.temperament as string | undefined;
  const showReask = !suggestion && profileAgeDays >= 14;

  const summary = QUESTIONS.map((q) => {
    const a = profile.answers[q.id];
    const ids = Array.isArray(a) ? a : a ? [a] : [];
    const labels = ids.map((id) => optionLabel(q.id, id)).filter(Boolean) as string[];
    return { key: SUMMARY_KEYS[q.id] ?? q.prompt, labels };
  }).filter((row) => row.labels.length > 0);

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* Hero, the mirror. Lead thread, then the others that resonate. */}
      <div className="flex flex-col items-center pt-8 pb-2 text-center">
        <LogoEmblem size={44} color="var(--tea-gold)" className="mb-6 opacity-70" />
        <p className="font-sans text-ui-11 uppercase tracking-[1.4px] text-tea-text-dim">
          What draws you to tea
        </p>
        {threads.length > 0 && (
          <>
            <h1 className={`${TYPOGRAPHY_CLASSES.h1} mt-3 text-tea-text`}>{threads[0].name}</h1>
            <p className="mt-4 max-w-md font-body text-ui-16 leading-relaxed text-tea-text-sec">
              {threads[0].description}
            </p>
          </>
        )}
        {threads.length > 1 && (
          <div className="mt-6 w-full max-w-md border-t border-tea-border pt-5">
            <p className="font-sans text-ui-11 uppercase tracking-[1.4px] text-tea-text-dim">
              Also drawn to
            </p>
            <div className="mt-3 flex flex-col gap-4">
              {threads.slice(1).map((t) => (
                <div key={t.id}>
                  <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>{t.name}</h2>
                  <p className="mt-1.5 font-body text-ui-14 leading-relaxed text-tea-text-sec">
                    {t.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
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

      {/* Evolution, the seed becomes real once there's practice to read. */}
      {observed.hasEnoughSignal ? (
        <div className="mt-7 rounded-xl border border-tea-border bg-tea-elevated px-5 py-4">
          <p className="font-sans text-ui-11 uppercase tracking-[1.4px] text-tea-text-dim mb-2">
            Your practice so far
          </p>
          <p className="font-body text-ui-15 leading-relaxed text-tea-text">
            {observed.tastingCount} {observed.tastingCount === 1 ? 'tea' : 'teas'} logged
            {observed.topTypes.length > 0 && (
              <>, lately leaning <span className="text-tea-gold">{observed.topTypes.join(' and ')}</span></>
            )}.
          </p>
          {suggestion && (
            <div className="mt-3 border-t border-tea-border pt-3">
              <p className="font-body text-ui-14 leading-relaxed text-tea-text-sec">
                {suggestion.reason}{' '}
                {addedThreadNames
                  ? <>Your practice now also reads like <span className="font-body text-tea-text">{addedThreadNames}</span>.</>
                  : <>Your practice has grown into a steadier one.</>}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onAdopt(suggestion.level, suggestion.threadIds)}
                  className="rounded-xl cta-solid px-4 py-2 font-sans text-ui-13 font-medium transition-all"
                >
                  Adopt this
                </button>
                <Link
                  to="/discover"
                  className="tap-target font-sans text-ui-13 text-tea-text-sec underline decoration-tea-border underline-offset-[3px] transition-colors hover:text-tea-text hover:decoration-tea-gold/40"
                >
                  Retake instead
                </Link>
              </div>
            </div>
          )}
          {drifted && observed.flavorLean && (
            <p className="font-body text-ui-13 leading-relaxed text-tea-text-sec mt-2">
              That's a turn toward {FAMILY_LABEL[observed.flavorLean]} since you started.{' '}
              <Link
                to="/discover"
                className="text-tea-text underline decoration-tea-gold/40 underline-offset-2 hover:decoration-tea-gold"
              >
                Refresh your profile
              </Link>{' '}
              when it feels true.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-7 rounded-xl border border-tea-border bg-tea-elevated px-5 py-4">
          <p className="font-body text-ui-14 leading-relaxed text-tea-text-sec">
            This is a beginning, not a label. What draws you can deepen, and new threads can surface,
            as your practice does; every tea you sit with teaches it a little more.{' '}
            <Link
              to="/account/journal"
              className="text-tea-text underline decoration-tea-gold/40 underline-offset-2 hover:decoration-tea-gold"
            >
              Start a tasting journal
            </Link>{' '}
            and watch it grow.
          </p>
        </div>
      )}

      {/* "Still true?", re-ask the one dimension behaviour can't observe. */}
      {showReask && (
        <div className="mt-4 rounded-xl border border-tea-border bg-tea-surface px-5 py-4">
          <p className="font-sans text-ui-11 uppercase tracking-[1.4px] text-tea-text-dim mb-2">
            Still true?
          </p>
          <p className="font-body text-ui-15 text-tea-text mb-3">{TEMPERAMENT_Q.prompt}</p>
          <div className="flex flex-wrap gap-2">
            {TEMPERAMENT_Q.options.map((opt) => {
              const isCurrent = opt.id === currentTemperament;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onReanswer(TEMPERAMENT_Q.id, opt.id)}
                  className={`rounded-xl border px-3 py-1.5 font-body text-ui-13 transition-colors ${
                    isCurrent
                      ? 'border-tea-gold bg-tea-gold/8 text-tea-text'
                      : 'border-tea-border bg-tea-surface text-tea-text-sec hover:border-tea-gold/40 hover:text-tea-text'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommendations, tailored to level, flavor leaning, and how they brew */}
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

      {/* Sign-in nudge (signed-out only), keep your profile across devices */}
      {!authUser && (
        <p className="mt-7 text-center font-body text-ui-13 leading-relaxed text-tea-text-sec">
          Your profile is saved on this device.{' '}
          <Link
            to="/signin"
            className="text-tea-text underline decoration-tea-gold/40 underline-offset-2 hover:decoration-tea-gold"
          >
            Sign in to keep it
          </Link>{' '}
          so the right tea, and the right words, can find you.
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
