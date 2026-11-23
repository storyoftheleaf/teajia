import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CELL, FACT, LABEL, NAME_CLASS, QUIET_LINK, RULE_FULL } from '../../../pages/wisdom/wisdomShared';
import { BASE, guidePath, KINDS, potPath, type Board, type Kind } from './data';

const labels: Record<Kind, string> = { clay: 'Clay names', color: 'Fired colors', shape: 'Shapes' };

export function Guide({ board }: { board: Board }) {
  const { search, hash } = useLocation();
  const anchor = hash.slice(1);
  const { reference } = board;
  const params = new URLSearchParams(search);
  const pot = board.pots.find(p => p.id === params.get('pot'));
  const fromListing = params.get('from') === 'listing';
  const kind = reference.entries.find(e => e.id === anchor)?.kind
    ?? KINDS.find(k => 'yixing-' + k === anchor) ?? 'clay';
  const entries = reference.entries.filter(e => e.kind === kind);
  const back = pot
    ? <Link className={QUIET_LINK} to={potPath(pot.id) + (fromListing ? '/listing' : '')}>← Back to {pot.name}</Link>
    : <Link className={QUIET_LINK} to={BASE}>Review my teapots</Link>;
  useEffect(() => {
    if (!anchor) return;
    const frame = requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start', behavior: 'instant' }));
    return () => cancelAnimationFrame(frame);
  }, [anchor, reference]);
  return <>
    <div className="mb-3">{back}</div>
    <h1 className="type-page-title font-display">{reference.title}</h1>
    <nav aria-label="Yixing reference categories" id={'yixing-' + kind} className="my-4 flex flex-wrap gap-2">
      {KINDS.map(k => <Link className="btn-tab" aria-current={kind === k ? 'page' : undefined} key={k} to={guidePath(pot, 'yixing-' + k, fromListing)}>{labels[k]}</Link>)}
    </nav>
    <div className={CELL + ' mb-4 flex flex-wrap gap-x-4 gap-y-2'}>{entries.map(e =>
      <Link className={QUIET_LINK} key={e.id} to={guidePath(pot, e.id, fromListing)}>{e.name}</Link>)}</div>
    <p className={FACT + ' mb-4'}>{reference.scope}</p>
    {entries.map(e => <section key={e.id} id={e.id} className={RULE_FULL + ' scroll-mt-1 py-4 ' + (e.id === anchor ? 'bg-tea-accent-sub px-3' : '')}>
      <h2 className={NAME_CLASS}>{e.name} {e.chinese && <span lang="zh" className="text-tea-text-sec">{e.chinese}</span>}</h2>
      <p className={LABEL + ' mt-1'}>{e.status}</p><p className={FACT + ' mt-2'}>{e.summary}</p>
      {!!e.cues?.length && <div className="mt-3"><p className={LABEL}>What to look for</p>
        <ul className={FACT + ' list-disc ps-5'}>{e.cues.map(cue => <li key={cue}>{cue}</li>)}</ul></div>}
      <ul aria-label={'Sources for ' + e.name} className={CELL + ' mt-3 space-y-1'}>{e.sources.map(s =>
        <li key={s.url + s.locator}><a href={s.url} rel="noreferrer" target="_blank" className={QUIET_LINK}>{s.title} ↗</a>{s.locator && ' · ' + s.locator}</li>)}</ul>
      {anchor === e.id && pot && <div className="mt-3">{back}</div>}
    </section>)}
  </>;
}
