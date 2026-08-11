import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { wisdomRelationsApi, type PublicWisdomRelated, type PublicWisdomTea, type PublicWisdomWriting, type WisdomNodeIdentity } from '../../admin/components/wisdom/relationsApi';
import { AXIS_INDENT, CELL_CLASS, FACT_CLASS, GROUND, MEASURE, NAME_CLASS, ROW_RULE, RULE_SHORT, SPACE } from './frame';

const MaterialLink: React.FC<{ href: string; className: string; children: React.ReactNode }> = ({ href, className, children }) =>
  /^https?:\/\//.test(href) ? <a href={href} className={className}>{children}</a> : <Link to={href} className={className}>{children}</Link>;

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className={SPACE.head}>
    <p className="font-sans text-ui-11 font-medium uppercase tracking-[0.14em] text-tea-text-dim">{children}</p>
    <span aria-hidden="true" className={`${RULE_SHORT} mt-2`} />
  </div>
);

export const WisdomRelatedMaterialView: React.FC<PublicWisdomRelated> = ({ writings, teas }) => {
  if (writings.length === 0 && teas.length === 0) return null;
  return (
    <section className={`${SPACE.section} ${GROUND} py-6`} data-testid="wisdom-related-material">
      {writings.length > 0 && (
        <div>
          <SectionLabel>Related reading</SectionLabel>
          <ol className={`m-0 list-none p-0 ${AXIS_INDENT}`}>
            {writings.map(writing => (
              <li key={writing.id} className={`${ROW_RULE} py-4`}>
                <MaterialLink href={writing.href} className={`${NAME_CLASS} text-tea-text transition-colors hover:text-tea-gold`}>
                  {writing.title}
                </MaterialLink>
                {writing.excerpt && <p className={`${FACT_CLASS} ${MEASURE} mt-1.5 text-tea-text-sec`}>{writing.excerpt}</p>}
                {writing.author_name && <p className={`${CELL_CLASS} mt-1.5 text-tea-text-dim`}>By {writing.author_name}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {teas.length > 0 && (
        <div className={writings.length > 0 ? 'mt-10' : ''}>
          <SectionLabel>Teas that illustrate this</SectionLabel>
          <ul className={`m-0 grid list-none gap-x-8 gap-y-0 p-0 sm:grid-cols-2 ${AXIS_INDENT}`}>
            {teas.map(tea => <TeaRow key={tea.id} tea={tea} />)}
          </ul>
        </div>
      )}
    </section>
  );
};

export const WisdomRelatedMaterialError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <section className={`${SPACE.section} ${GROUND} py-6`} role="alert">
    <div className={AXIS_INDENT}>
      <p className={`${FACT_CLASS} text-tea-text-sec`}>Related material could not be loaded.</p>
      <button type="button" onClick={onRetry} className="tap-target mt-2 text-ui-12 text-tea-gold hover:text-tea-gold-lt">Try again</button>
    </div>
  </section>
);

export const WisdomHiddenEntryNotice: React.FC = () => (
  <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
    <h1 className="font-display text-ui-28 text-tea-text">This Wisdom entry is not public</h1>
    <p className="mt-3 text-ui-13 leading-relaxed text-tea-text-sec">It is being reviewed and may return to the reference later.</p>
    <Link to="/wisdom" className="tap-target mt-5 text-ui-12 text-tea-gold hover:text-tea-gold-lt">Browse Wisdom</Link>
  </main>
);

export const WisdomStateUnavailableNotice: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center" role="alert">
    <h1 className="font-display text-ui-28 text-tea-text">Wisdom entry cannot be checked</h1>
    <p className="mt-3 text-ui-13 leading-relaxed text-tea-text-sec">Its publication state is temporarily unavailable, so the entry is withheld.</p>
    <button type="button" onClick={onRetry} className="tap-target mt-5 text-ui-12 text-tea-gold hover:text-tea-gold-lt">Try again</button>
  </main>
);

type PublicRelatedState = { status: 'loading' | 'ready' | 'error'; data: PublicWisdomRelated | null; retry: number };

const useWisdomPublicRelated = (identity: WisdomNodeIdentity) => {
  const [state, setState] = useState<PublicRelatedState>({ status: 'loading', data: null, retry: 0 });
  useEffect(() => {
    let active = true;
    setState(current => ({ ...current, status: 'loading' }));
    wisdomRelationsApi.publicRelated(identity).then(
      data => { if (active) setState(current => ({ ...current, status: 'ready', data })); },
      () => { if (active) setState(current => ({ ...current, status: 'error', data: null })); },
    );
    return () => { active = false; };
  }, [identity.nodeType, identity.nodeId, state.retry]);
  return { ...state, refetch: () => setState(current => ({ ...current, retry: current.retry + 1 })) };
};

const useWisdomPublicState = (identity: WisdomNodeIdentity) => {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; publicState: 'inherit' | 'public' | 'hidden'; retry: number }>({ status: 'loading', publicState: 'inherit', retry: 0 });
  useEffect(() => {
    let active = true;
    setState(current => ({ ...current, status: 'loading' }));
    wisdomRelationsApi.publicState(identity).then(
      data => { if (active) setState(current => ({ ...current, status: 'ready', publicState: data.public_state })); },
      () => { if (active) setState(current => ({ ...current, status: 'error' })); },
    );
    return () => { active = false; };
  }, [identity.nodeType, identity.nodeId, state.retry]);
  return { ...state, refetch: () => setState(current => ({ ...current, retry: current.retry + 1 })) };
};

export const WisdomPublicStateGate: React.FC<{ identity: WisdomNodeIdentity; children: React.ReactNode }> = ({ identity, children }) => {
  const query = useWisdomPublicState(identity);
  if (typeof window === 'undefined') return <>{children}</>;
  if (query.status === 'loading') {
    return <main className="mx-auto min-h-[60vh] max-w-3xl px-6 py-16" aria-label="Wisdom entry loading"><div className="h-40 animate-pulse rounded-md bg-tea-accent-sub" /></main>;
  }
  if (query.status === 'error') return <WisdomStateUnavailableNotice onRetry={query.refetch} />;
  if (query.publicState === 'hidden') return <WisdomHiddenEntryNotice />;
  return <>{children}</>;
};

const TeaRow: React.FC<{ tea: PublicWisdomTea }> = ({ tea }) => (
  <li className={`${ROW_RULE} flex min-w-0 items-center gap-3 py-4`}>
    {tea.image_url && <img src={tea.image_url} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-md object-cover" />}
    <div className="min-w-0">
      {tea.href ? (
        <MaterialLink href={tea.href} className={`${NAME_CLASS} text-tea-text transition-colors hover:text-tea-gold`}>
          {tea.name}
        </MaterialLink>
      ) : <p className={`${NAME_CLASS} text-tea-text`}>{tea.name}</p>}
      {tea.detail && <p className={`${CELL_CLASS} mt-1 text-tea-text-dim`}>{tea.detail}</p>}
    </div>
  </li>
);

export const WisdomRelatedMaterial: React.FC<{ identity: WisdomNodeIdentity }> = ({ identity }) => {
  const query = useWisdomPublicRelated(identity);
  if (query.status === 'loading') return <section className={`${SPACE.section} ${GROUND} py-6`} aria-label="Related material loading"><div className={`${AXIS_INDENT} h-16 animate-pulse rounded-md bg-tea-accent-sub`} /></section>;
  if (query.status === 'error') return <WisdomRelatedMaterialError onRetry={query.refetch} />;
  if (!query.data || query.data.public_state === 'hidden') return null;
  return <WisdomRelatedMaterialView writings={query.data.writings} teas={query.data.teas} />;
};

export type { PublicWisdomRelated, PublicWisdomTea, PublicWisdomWriting };
