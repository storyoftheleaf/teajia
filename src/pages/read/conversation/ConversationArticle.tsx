/**
 * Draws a conversation piece from its spec (see spec.ts). Every interview on
 * /read uses this one component, so a fix here reaches all of them and a new
 * conversation is a new spec file, not a copy of an old article.
 */
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  C, F, ImmersiveRoot, ImmersiveNav, MoreFooter, ChapterHead, partWord, revealFrom,
  useReveals, useReadingProgress, useImmersiveChrome, grainCss, ACCENTS,
} from '../immersive';
import EditablePhoto from '../EditablePhoto';
import { StoryEditProvider, EditableText } from '../storyEdit';
import StoryEditorBar from '../StoryEditorBar';
import { Rich } from './RichText';
import { type Block, type ConversationSpec, type LineSize, type Shot, photoCount, readingMinutes } from './spec';
import './conversation.css';

// ── Photographs ──────────────────────────────────────────────────────────────
const Photo: React.FC<{ spec: ConversationSpec; shot: Shot; aspect?: string; fill?: boolean }> = ({ spec, shot, aspect = '4/5', fill }) => (
  <EditablePhoto
    slot={shot.slot}
    alt={shot.alt}
    aspect={aspect}
    fill={fill}
    bare
    defaultPhoto={{ url: spec.images + shot.file, x: shot.x, y: shot.y }}
  />
);

// ── Blocks ───────────────────────────────────────────────────────────────────
/** Consecutive questions and answers share one reading column. */
function groupRuns(blocks: Block[]): (Block | Block[])[] {
  const out: (Block | Block[])[] = [];
  blocks.forEach((b) => {
    const last = out[out.length - 1];
    if (b.kind === 'q' || b.kind === 'a') {
      if (Array.isArray(last)) last.push(b);
      else out.push([b]);
    } else out.push(b);
  });
  return out;
}

/** A sentence of his set large. */
const Line: React.FC<{ id: string; text: string; size: LineSize; follow?: { id: string; text: string } }> = ({ id, text, size, follow }) => (
  <div data-size={size}>
    <Rich field={id} text={text} className="tj-conv-line" />
    {follow && <Rich field={follow.id} text={follow.text} className="tj-conv-a tj-conv-follow" />}
  </div>
);

/** Words inside a column, a side or a glyph block. Questions carry a spoken label;
 *  a sighted reader tells them apart by their face. */
const Words: React.FC<{ blocks: Block[] }> = ({ blocks }) => (
  <>
    {blocks.map((b, i) => {
      if (b.kind === 'q') {
        return (
          <div key={b.id} className="tj-conv-q">
            <span className="tj-sr-only">Adrian asks: </span>
            <Rich field={b.id} text={b.text} as="span" />
          </div>
        );
      }
      if (b.kind === 'a') return <Rich key={b.id} field={b.id} text={b.text} className="tj-conv-a" />;
      if (b.kind === 'line') return <Line key={b.id} id={b.id} text={b.text} size={b.size} />;
      return <React.Fragment key={i} />;
    })}
  </>
);

const BlockView: React.FC<{ spec: ConversationSpec; block: Block | Block[] }> = ({ spec, block }) => {
  if (Array.isArray(block)) {
    return <section data-reveal className="tj-conv-col"><Words blocks={block} /></section>;
  }
  const b = block;
  switch (b.kind) {
    case 'line':
      return <div data-reveal className="tj-conv-spine"><Line id={b.id} text={b.text} size={b.size} follow={b.follow} /></div>;
    case 'side':
      return (
        <section data-reveal className="tj-conv-side" data-flip={b.flip ? '' : undefined}>
          <div className="tj-conv-side-words"><Words blocks={b.blocks} /></div>
          <div><Photo spec={spec} shot={b.shot} /></div>
        </section>
      );
    case 'photos':
      return (
        <figure data-reveal className="tj-conv-figure" data-narrow={b.narrow ? '' : undefined}>
          <div className="tj-conv-photos" data-stagger={b.stagger ? '' : undefined}>
            {b.shots.map((s) => <div key={s.slot}><Photo spec={spec} shot={s} aspect={b.aspect} /></div>)}
          </div>
          {b.caption && <Rich field={b.caption.id} text={b.caption.text} as="figcaption" className="tj-conv-caption" />}
        </figure>
      );
    case 'wide':
      return (
        <figure data-reveal className="tj-conv-figure" data-narrow={b.narrow ? '' : undefined}>
          <Photo spec={spec} shot={b.shot} aspect={b.aspect ?? '3/2'} />
        </figure>
      );
    case 'bleed':
      return <figure data-reveal className="tj-conv-bleed"><Photo spec={spec} shot={b.shot} fill /></figure>;
    case 'on-photo':
      return (
        <figure data-reveal className="tj-conv-onphoto">
          <div className="tj-conv-onphoto-frame" style={{ aspectRatio: b.aspect }}>
            <Photo spec={spec} shot={b.shot} fill />
            <Rich field={b.id} text={b.text} className="tj-conv-onphoto-words" style={{ color: b.ink, ['--tj-gold-lt' as string]: b.accent } as React.CSSProperties} />
          </div>
        </figure>
      );
    case 'glyph':
      return (
        <section data-reveal className="tj-conv-col">
          <div className="tj-conv-glyph">
            <div aria-hidden="true" className="tj-conv-glyph-mark">{b.glyph}</div>
            <div><Words blocks={b.blocks} /></div>
          </div>
        </section>
      );
    default:
      return null;
  }
};

// ── The part being read, for the top bar ─────────────────────────────────────
function useCurrentPart(count: number): number {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const heads = Array.from({ length: count }, (_, i) => document.getElementById(`part-${i + 1}`)).filter(Boolean) as HTMLElement[];
    const onScroll = () => {
      const line = window.innerHeight * 0.35;
      let n = 0;
      heads.forEach((h, i) => { if (h.getBoundingClientRect().top < line) n = i + 1; });
      setCurrent(n);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [count]);
  return current;
}

// ── Cover ────────────────────────────────────────────────────────────────────
const creditLabel: React.CSSProperties = { fontFamily: F.ui, fontSize: 12, fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.gold, paddingTop: 6 };
const creditSmall: React.CSSProperties = { fontFamily: F.ui, fontSize: 13, letterSpacing: '0.02em', color: C.taupe, marginTop: 6 };
const bylineLink: React.CSSProperties = { fontFamily: F.ui, fontSize: 13, letterSpacing: '0.04em', color: C.goldLt, textDecoration: 'none', borderBottom: '1px solid rgb(var(--tj-read-gold-rgb) / 0.4)', paddingBottom: 1 };

const Cover: React.FC<{ spec: ConversationSpec }> = ({ spec }) => (
  <header className="tj-cover-dissolve" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', alignItems: 'stretch', borderBottom: '1px solid rgb(var(--tj-read-gold-rgb) / 0.14)' }}>
    <div className="tj-cover-text" style={{ order: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(36px,6vw,84px) clamp(24px,5vw,72px)' }}>
      <h1 style={{ fontFamily: F.display, fontWeight: 300, fontSize: 'clamp(52px,8vw,112px)', lineHeight: 0.94, letterSpacing: '-0.02em', color: C.cream, margin: 0 }}>
        <EditableText field="title-1" as="span">{spec.title[0]}</EditableText>{' '}<br />
        <span style={{ fontStyle: 'italic', fontWeight: 400, color: C.gold }}><EditableText field="title-2" as="span">{spec.title[1]}</EditableText></span>
      </h1>
      <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(16px,2vw,20px)', lineHeight: 1.5, color: C.taupe, margin: '28px 0 0', maxWidth: 440, textWrap: 'balance' } as React.CSSProperties}>
        <EditableText field="dek-2" as="span" multiline>{spec.dek}</EditableText>
      </p>
      <dl style={{ marginTop: 'clamp(30px,5vw,46px)', marginBottom: 0, paddingTop: 22, borderTop: '1px solid rgb(var(--tj-read-gold-rgb) / 0.16)', display: 'grid', gridTemplateColumns: '84px minmax(0,1fr)', rowGap: 18 }}>
        <dt style={creditLabel}>With</dt>
        <dd style={{ margin: 0 }}>
          <div style={{ fontFamily: F.display, fontSize: 24, color: C.ink, lineHeight: 1.1 }}>
            {spec.subject.href
              ? <Link to={spec.subject.href} style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid rgb(var(--tj-read-gold-rgb) / 0.35)' }}>{spec.subject.name}</Link>
              : spec.subject.name}
            {spec.subject.nameCn && <span lang="zh-Hans" style={{ fontFamily: F.cn, color: C.taupe, fontSize: 18, marginLeft: 8 }}>{spec.subject.nameCn}</span>}
          </div>
          <div style={creditSmall}>{spec.subject.role}</div>
        </dd>
        <dt style={creditLabel}>By</dt>
        <dd style={{ margin: 0 }}>
          <div style={{ fontFamily: F.display, fontSize: 24, color: C.ink, lineHeight: 1.1 }}>{spec.author.name}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', marginTop: 8 }}>
            {spec.author.links.map((l) => (l.href.startsWith('/')
              ? <Link key={l.href} to={l.href} style={bylineLink}>{l.label}</Link>
              : <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" style={bylineLink}>{l.label}</a>))}
          </div>
        </dd>
        {spec.facts.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt style={creditLabel}>{k}</dt>
            <dd style={{ margin: 0, ...creditSmall, fontSize: 15, marginTop: 4 }}>{v}</dd>
          </React.Fragment>
        ))}
        <dt style={creditLabel}>Read</dt>
        <dd style={{ margin: 0, ...creditSmall, fontSize: 15, marginTop: 4 }}>About {readingMinutes(spec)} minutes, {photoCount(spec)} photographs</dd>
      </dl>
    </div>
    <div className="tj-cover-photo" style={{ order: 1, position: 'relative', overflow: 'hidden', minHeight: 'min(88vh,860px)', background: 'linear-gradient(155deg,var(--tj-read-empty-from) 0%,var(--tj-read-bg) 80%)' }}>
      <EditablePhoto
        slot={spec.portrait.slot}
        alt={spec.portrait.alt}
        fill
        defaultPhoto={{ url: spec.images + spec.portrait.file, x: spec.portrait.x, y: spec.portrait.y }}
        placeholder={<div aria-hidden="true" style={{ ...grainCss('0.8', 150), opacity: 0.08 }} />}
      />
    </div>
  </header>
);

// ── Contents ─────────────────────────────────────────────────────────────────
const Contents: React.FC<{ spec: ConversationSpec }> = ({ spec }) => (
  <nav aria-label="In this conversation">
    <ol className="tj-conv-contents">
      {spec.parts.map((p, i) => (
        <li key={p.title}>
          <a
            href={`#part-${i + 1}`}
            onClick={(e) => {
              const el = document.getElementById(`part-${i + 1}`);
              if (!el) return;
              e.preventDefault();
              revealFrom(el);
              el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
              history.replaceState(null, '', `#part-${i + 1}`);
            }}
          >
            <span className="tj-conv-contents-part">Part {partWord(i + 1)}</span>
            <span className="tj-conv-contents-title">{p.title}</span>
          </a>
        </li>
      ))}
    </ol>
  </nav>
);

// ── Page ─────────────────────────────────────────────────────────────────────
const ConversationArticle: React.FC<{ spec: ConversationSpec }> = ({ spec }) => {
  useImmersiveChrome(ACCENTS[0]);
  const rootRef = useReveals([]);
  const progress = useReadingProgress();
  const current = useCurrentPart(spec.parts.length);

  // Arriving on a #part-N link shows that part at once. It waits out the app's
  // own scroll restore, which runs a frame after the route mounts and would
  // otherwise put the reader back at the top.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    const el = id ? document.getElementById(id) : null;
    if (!el) return;
    const t = window.setTimeout(() => { revealFrom(el); el.scrollIntoView({ behavior: 'instant' }); }, 250);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <StoryEditProvider slug={spec.slug}>
      <ImmersiveRoot rootRef={rootRef}>
        <Helmet><title>{spec.pageTitle}</title></Helmet>
        <ImmersiveNav progress={progress} current={current ? spec.parts[current - 1].title : undefined} />

        <article className="tj-conv" style={{ position: 'relative', zIndex: 1 }}>
          <Cover spec={spec} />

          <section data-reveal className="tj-conv-col" style={{ marginTop: 'clamp(56px,9vw,110px)' }}>
            <EditableText field="intro" as="p" multiline style={{ fontFamily: F.body, fontSize: 'clamp(19px,2.3vw,23px)', lineHeight: 1.7, color: C.ink, margin: 0 }}>
              {spec.intro}
            </EditableText>
            <Contents spec={spec} />
          </section>

          {groupRuns(spec.opening).map((b, i) => <BlockView key={`o${i}`} spec={spec} block={b} />)}

          {spec.parts.map((p, pi) => (
            <React.Fragment key={p.title}>
              <ChapterHead part={pi + 1} id={`part-${pi + 1}`} title={p.title} />
              {groupRuns(p.blocks).map((b, i) => <BlockView key={`p${pi}-${i}`} spec={spec} block={b} />)}
            </React.Fragment>
          ))}

          {/* The close: the last exchange, his saying, and the whole photograph. */}
          {groupRuns(spec.ending.blocks).map((b, i) => <BlockView key={`e${i}`} spec={spec} block={b} />)}
          <section data-reveal className="tj-conv-saying">
            <Line id={spec.ending.saying.id} text={spec.ending.saying.text} size="l" />
          </section>
          <figure data-reveal className="tj-conv-close">
            <Photo spec={spec} shot={spec.ending.shot} aspect={spec.ending.aspect} />
          </figure>
          <footer className="tj-conv-credit">
            <span aria-hidden="true" className="tj-conv-credit-rule" />
            {spec.credit.map((line) => <p key={line}>{line}</p>)}
          </footer>

          <MoreFooter links={spec.next} />
        </article>
      </ImmersiveRoot>
      <StoryEditorBar />
    </StoryEditProvider>
  );
};

export default ConversationArticle;
