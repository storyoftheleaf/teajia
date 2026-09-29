/**
 * Draws a conversation piece from its spec (see spec.ts). Every interview on
 * /read uses this one component, so a fix here reaches all of them and a new
 * conversation is a new spec file, not a copy of an old article.
 *
 * The aim is a printed interview, not a web page: a cover that gives the
 * portrait the screen, parts that open as spreads, speakers named in the
 * margin, and an end mark where the piece is meant to end.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  ImmersiveRoot, ImmersiveNav, MoreFooter, ChapterHead, partWord, revealFrom,
  useReveals, useReadingProgress, useImmersiveChrome, grainCss, ACCENTS,
} from '../immersive';
import EditablePhoto from '../EditablePhoto';
import { StoryEditProvider, EditableText } from '../storyEdit';
import StoryEditorBar from '../StoryEditorBar';
import { Rich } from './RichText';
import {
  type Block, type ConversationSpec, type LineSize, type Part, type Shot,
  photoCount, readingMinutes, turnStarts,
} from './spec';
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

// ── Speakers ─────────────────────────────────────────────────────────────────
type Speakers = { author: string; subject: string; starts: Set<string> };
const SpeakerCtx = createContext<Speakers>({ author: '', subject: '', starts: new Set() });

/** A speaker's name, hung in the margin on a wide screen and set above the turn on a phone. */
const Who: React.FC<{ name: string }> = ({ name }) => (
  <span className="tj-conv-who">{name}<span className="tj-sr-only">: </span></span>
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

/** Words inside a column, a side or a glyph block. Each turn carries its speaker's name. */
const Words: React.FC<{ blocks: Block[] }> = ({ blocks }) => {
  const { author, subject, starts } = useContext(SpeakerCtx);
  return (
    <>
      {blocks.map((b, i) => {
        if (b.kind === 'q') {
          return (
            <div key={b.id} className="tj-conv-turn tj-conv-q">
              <Who name={author} />
              <Rich field={b.id} text={b.text} className="tj-conv-q-text" />
            </div>
          );
        }
        if (b.kind === 'a') {
          return starts.has(b.id)
            ? <div key={b.id} className="tj-conv-turn"><Who name={subject} /><Rich field={b.id} text={b.text} className="tj-conv-a" /></div>
            : <Rich key={b.id} field={b.id} text={b.text} className="tj-conv-a" />;
        }
        if (b.kind === 'line') return <Line key={b.id} id={b.id} text={b.text} size={b.size} />;
        return <React.Fragment key={i} />;
      })}
    </>
  );
};

const BlockView: React.FC<{ spec: ConversationSpec; block: Block | Block[] }> = ({ spec, block }) => {
  if (Array.isArray(block)) {
    return <section data-reveal="text" className="tj-conv-col"><Words blocks={block} /></section>;
  }
  const b = block;
  switch (b.kind) {
    case 'line':
      return <div data-reveal="text" className="tj-conv-spine"><Line id={b.id} text={b.text} size={b.size} follow={b.follow} /></div>;
    case 'side':
      return (
        <section className="tj-conv-side" data-flip={b.flip ? '' : undefined} data-bleed={b.bleed ? '' : undefined}>
          <div data-reveal="text" className="tj-conv-side-words"><Words blocks={b.blocks} /></div>
          <div data-reveal="photo" className="tj-conv-side-photo"><Photo spec={spec} shot={b.shot} /></div>
        </section>
      );
    case 'photos':
      return (
        <figure data-reveal="photo" className="tj-conv-figure" data-narrow={b.narrow ? '' : undefined}>
          <div className="tj-conv-photos" data-stagger={b.stagger ? '' : undefined}>
            {b.shots.map((s) => <div key={s.slot}><Photo spec={spec} shot={s} aspect={b.aspect} /></div>)}
          </div>
          {b.caption && <Rich field={b.caption.id} text={b.caption.text} as="figcaption" className="tj-conv-caption" />}
        </figure>
      );
    case 'wide':
      return (
        <figure data-reveal="photo" className="tj-conv-figure" data-narrow={b.narrow ? '' : undefined} data-offset={b.offset}>
          <Photo spec={spec} shot={b.shot} aspect={b.aspect ?? '3/2'} />
        </figure>
      );
    case 'bleed':
      return <figure data-reveal="photo" className="tj-conv-bleed"><Photo spec={spec} shot={b.shot} fill /></figure>;
    case 'on-photo':
      return (
        <figure data-reveal="photo" className="tj-conv-onphoto">
          <div className="tj-conv-onphoto-frame" style={{ aspectRatio: b.aspect }}>
            <Photo spec={spec} shot={b.shot} fill />
            <Rich field={b.id} text={b.text} className="tj-conv-onphoto-words" style={{ color: b.ink, ['--tj-gold-lt' as string]: b.accent } as React.CSSProperties} />
          </div>
        </figure>
      );
    case 'glyph':
      return (
        <section data-reveal="text" className="tj-conv-col">
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

// ── Part openings ────────────────────────────────────────────────────────────
/** A part opens as a spread: the photograph on one side, the part and its title on the other. */
const PartOpening: React.FC<{ spec: ConversationSpec; part: Part; n: number }> = ({ spec, part, n }) => {
  if (!part.opener) return <ChapterHead part={n} id={`part-${n}`} title={part.title} />;
  return (
    <section id={`part-${n}`} className="tj-conv-spread" data-flip={n % 2 === 0 ? '' : undefined} aria-labelledby={`part-${n}-title`}>
      <div data-reveal="photo" className="tj-conv-spread-photo"><Photo spec={spec} shot={part.opener} fill /></div>
      <header data-reveal="text" className="tj-conv-spread-head">
        <span className="tj-conv-spread-part">Part {partWord(n)}</span>
        <h2 id={`part-${n}-title`} className="tj-conv-spread-title">{part.title}</h2>
        <span aria-hidden="true" className="tj-conv-spread-rule" />
      </header>
    </section>
  );
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

/**
 * While the reader moves down through the piece, the site's own menus step
 * back: the left rail fades nearly away and the phone's bottom bar slides out.
 * Any scroll up brings both back at once, and so does reaching the end, so the
 * menus are always one small gesture away. Only these pages do this; the
 * attribute is removed when the reader leaves.
 */
function useQuietChrome() {
  useEffect(() => {
    const root = document.documentElement;
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const nearEnd = y + window.innerHeight > document.documentElement.scrollHeight - window.innerHeight * 1.2;
      if (y < 400 || nearEnd || y < lastY - 6) delete root.dataset.tjReading;
      else if (y > lastY + 6) root.dataset.tjReading = 'quiet';
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      delete root.dataset.tjReading;
    };
  }, []);
}

// ── Cover and masthead ───────────────────────────────────────────────────────
const Cover: React.FC<{ spec: ConversationSpec }> = ({ spec }) => (
  <header className="tj-cover-dissolve tj-conv-cover">
    <div className="tj-cover-photo tj-conv-cover-photo" style={{ background: 'linear-gradient(155deg,var(--tj-read-empty-from) 0%,var(--tj-read-bg) 80%)' }}>
      <EditablePhoto
        slot={spec.portrait.slot}
        alt={spec.portrait.alt}
        fill
        defaultPhoto={{ url: spec.images + spec.portrait.file, x: spec.portrait.x, y: spec.portrait.y }}
        placeholder={<div aria-hidden="true" style={{ ...grainCss('0.8', 150), opacity: 0.08 }} />}
      />
    </div>
    <div className="tj-cover-text tj-conv-cover-text">
      <h1 className="tj-conv-title">
        <EditableText field="title-1" as="span">{spec.title[0]}</EditableText>{' '}<br />
        <span className="tj-conv-title-2"><EditableText field="title-2" as="span">{spec.title[1]}</EditableText></span>
      </h1>
      <p className="tj-conv-dek">
        <EditableText field="dek-2" as="span" multiline>{spec.dek}</EditableText>
      </p>
    </div>
  </header>
);

/** The credits, as one quiet line under the cover, the way a magazine sets its masthead. */
const Masthead: React.FC<{ spec: ConversationSpec }> = ({ spec }) => (
  <dl className="tj-conv-masthead">
    <div>
      <dt>With</dt>
      <dd>
        {spec.subject.href ? <Link to={spec.subject.href}>{spec.subject.name}</Link> : spec.subject.name}
        {spec.subject.nameCn && <span lang="zh-Hans" className="tj-conv-cn"> {spec.subject.nameCn}</span>}
        <span className="tj-conv-masthead-soft">, {spec.subject.role.toLowerCase()}</span>
      </dd>
    </div>
    <div>
      <dt>By</dt>
      <dd>
        {spec.author.name}
        <span className="tj-conv-masthead-links">
          {spec.author.links.map((l) => (l.href.startsWith('/')
            ? <Link key={l.href} to={l.href}>{l.label}</Link>
            : <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a>))}
        </span>
      </dd>
    </div>
    {spec.facts.map(([k, v]) => (
      <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
    ))}
    <div><dt>Read</dt><dd>About {readingMinutes(spec)} minutes, {photoCount(spec)} photographs</dd></div>
  </dl>
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
  useQuietChrome();
  const speakers = useMemo<Speakers>(() => ({ ...spec.speakers, starts: turnStarts(spec) }), [spec]);

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
      <SpeakerCtx.Provider value={speakers}>
        <ImmersiveRoot rootRef={rootRef}>
          <Helmet><title>{spec.pageTitle}</title></Helmet>
          <ImmersiveNav progress={progress} current={current ? spec.parts[current - 1].title : undefined} />

          <article className="tj-conv" style={{ position: 'relative', zIndex: 1 }}>
            <Cover spec={spec} />
            <Masthead spec={spec} />

            <section data-reveal="text" className="tj-conv-col tj-conv-intro">
              <EditableText field="intro" as="p" multiline className="tj-conv-intro-text">
                {spec.intro}
              </EditableText>
              <Contents spec={spec} />
            </section>

            {groupRuns(spec.opening).map((b, i) => <BlockView key={`o${i}`} spec={spec} block={b} />)}

            {spec.parts.map((p, pi) => (
              <React.Fragment key={p.title}>
                <PartOpening spec={spec} part={p} n={pi + 1} />
                {groupRuns(p.blocks).map((b, i) => <BlockView key={`p${pi}-${i}`} spec={spec} block={b} />)}
              </React.Fragment>
            ))}

            {/* The close: the last exchange, his saying, the end mark, the whole photograph, the colophon. */}
            {groupRuns(spec.ending.blocks).map((b, i) => <BlockView key={`e${i}`} spec={spec} block={b} />)}
            <section data-reveal="text" className="tj-conv-saying">
              <Line id={spec.ending.saying.id} text={spec.ending.saying.text} size="l" />
              <span aria-hidden="true" lang="zh-Hans" className="tj-conv-endmark">家</span>
            </section>
            <figure data-reveal="photo" className="tj-conv-close">
              <Photo spec={spec} shot={spec.ending.shot} aspect={spec.ending.aspect} />
            </figure>
            <footer className="tj-conv-credit">
              {spec.credit.map((line) => <p key={line}>{line}</p>)}
            </footer>

            <MoreFooter links={spec.next} />
          </article>
        </ImmersiveRoot>
      </SpeakerCtx.Provider>
      <StoryEditorBar />
    </StoryEditProvider>
  );
};

export default ConversationArticle;
