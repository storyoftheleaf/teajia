import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
import { LogoEmblem } from '../components/Logos/LogoEmblem';
import { useAppStore } from '../lib/store';
import { TeaDiscoveryFlow } from '../components/TeaDiscovery/TeaDiscoveryFlow';
import { DiscoveryResult } from '../components/TeaDiscovery/DiscoveryResult';
import { deriveProfile } from '../components/TeaDiscovery/questions';
import { pushTeaDiscoveryProfile } from '../lib/teaDiscoverySync';
import type { TeaDiscoveryAnswers } from '../components/TeaDiscovery/types';

type View = 'intro' | 'flow' | 'result';

export default function DiscoverPage() {
  const profile = useAppStore((s) => s.teaDiscoveryProfile);
  const setProfile = useAppStore((s) => s.setTeaDiscoveryProfile);
  const clearProfile = useAppStore((s) => s.clearTeaDiscoveryProfile);
  const [view, setView] = useState<View>(profile ? 'result' : 'intro');

  const handleComplete = (answers: TeaDiscoveryAnswers) => {
    const { level, disposition } = deriveProfile(answers);
    const profile = {
      answers,
      level,
      dispositionId: disposition.id,
      completedAt: new Date().toISOString(),
    };
    setProfile(profile);
    // Persist to the server when signed in (no-op when anonymous; picked up on
    // next login by the sync hook). Fire-and-forget.
    void pushTeaDiscoveryProfile(profile);
    setView('result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRetake = () => {
    clearProfile();
    setView('flow');
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-screen pb-nav-gap-lg">
      <Helmet>
        <title>Discover your tea — Teajia</title>
        <meta
          name="description"
          content="A few quiet questions to discover the way you drink tea — and where to begin. No right answers, just yours."
        />
      </Helmet>

      {view === 'intro' && <Intro onBegin={() => setView('flow')} />}

      {view === 'flow' && (
        <TeaDiscoveryFlow
          onComplete={handleComplete}
          onExit={() => setView('intro')}
          initialAnswers={profile?.answers}
        />
      )}

      {view === 'result' && profile && (
        <DiscoveryResult profile={profile} onRetake={handleRetake} />
      )}
    </div>
  );
}

/* ─── Intro — frames the exchange: a gift, not a form ─── */

const Intro: React.FC<{ onBegin: () => void }> = ({ onBegin }) => (
  <div className="mx-auto flex min-h-[72vh] w-full max-w-lg flex-col items-center justify-center px-2 text-center">
    <LogoEmblem size={56} color="var(--tea-gold)" className="mb-7 opacity-70" />
    <p className="font-sans text-ui-11 uppercase tracking-[1.4px] text-tea-text-dim">Tea Discovery</p>
    <h1 className={`${TYPOGRAPHY_CLASSES.h1} mt-3 text-tea-text`}>Let’s discover your tea.</h1>
    <p className="mt-4 max-w-md font-body text-ui-16 leading-relaxed text-tea-text-sec">
      Five short questions. No right answers — just yours. At the end, we’ll name the way you drink,
      and point you somewhere good.
    </p>
    <button
      type="button"
      onClick={onBegin}
      className="mt-8 rounded-xl bg-tea-gold px-8 py-3 font-sans text-ui-15 font-medium text-tea-bg transition-all hover:bg-tea-gold/90"
    >
      Begin
    </button>
    <p className="mt-4 font-body text-ui-12 tracking-[0.04em] text-tea-text-sec">
      About a minute · nothing to sign up for
    </p>
  </div>
);
