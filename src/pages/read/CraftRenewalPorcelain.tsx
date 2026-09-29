/**
 * @color-literals. The Read section is one always-dark editorial surface.
 * Rationale, and the conditions on this exception, in read/immersive.tsx.
 * The two literals below (PALE_INK, PALE_GOLD) are measured against one
 * photograph, the pale wall behind the gold-mended bowl, and do not change
 * with the theme any more than the photograph does.
 */
/**
 * Shangyin Qiwu: Porcelain and Tea
 *
 * Rebuilt 2026-09-28 from the full interview transcript (Adrian's Obsidian
 * source note, SRC - Ceramicist (Porcelain Restoration)). Every answer is his,
 * lightly trimmed; every question is Adrian's own. Nothing here is invented:
 * the earlier text carried lines that were never said (the cup that "breathes
 * differently", the broken-lid opening), and those are gone.
 *
 * Photographs ship with the site under /read/porcelain-and-tea/ and fill each
 * frame by default. The owner can still drop a different photo onto any frame
 * through the story editor; removing it brings the designed photo back.
 *
 * Layout rules Adrian set on this piece: words sit on a photograph only where
 * the photograph has empty space (the pale wall), never over the work; a
 * sentence is never broken across a paragraph and a display line; no drop caps.
 */
import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  C, F, ImmersiveRoot, ImmersiveNav, AccentSwatches, MoreFooter,
  useReveals, useReadingProgress, useImmersiveChrome, grainCss, ACCENTS,
} from './immersive';
import EditablePhoto from './EditablePhoto';
import { StoryEditProvider, EditableText } from './storyEdit';
import StoryEditorBar from './StoryEditorBar';

const STORY_SLUG = 'porcelain-and-tea';
const IMG = '/read/porcelain-and-tea/';
const PALE_INK = '#1c1712';
const PALE_GOLD = '#5a4318';

const moreLinks = [
  { to: '/read/earth-water-fire', kicker: 'Conversation', title: 'Earth, Water, Fire', blurb: 'A Jingdezhen potter on the vessels that hold the tea.' },
  { to: '/read/craft', kicker: 'The Craft', title: 'The Pot That Remembers', blurb: 'Yixing purple clay, and pots that age with you.' },
  { to: '/read/rock-remembers', kicker: 'Conversation', title: 'The Rock Remembers', blurb: 'A Wuyi roaster on fire, patience and lineage.' },
];

// ── Type ─────────────────────────────────────────────────────────────────────
const pBody: React.CSSProperties = { fontFamily: F.body, fontSize: 'clamp(16px,2vw,18px)', lineHeight: 1.8, color: C.taupe, margin: '0 0 16px' };
const em: React.CSSProperties = { fontStyle: 'italic', color: C.warm };
const cn: React.CSSProperties = { fontFamily: F.cn, color: C.gold };
const briefK: React.CSSProperties = { fontFamily: F.ui, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.dim };
const briefV: React.CSSProperties = { fontFamily: F.body, fontSize: 15, color: C.ink, textAlign: 'right' };
const creditLabel: React.CSSProperties = { fontFamily: F.ui, fontSize: 10.5, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold, paddingTop: 6 };
const bylineLink: React.CSSProperties = { fontFamily: F.ui, fontSize: 12, letterSpacing: '0.06em', color: C.goldLt, textDecoration: 'none', borderBottom: '1px solid rgb(var(--tj-read-gold-rgb) / 0.4)', paddingBottom: 1 };
const lineSize = { xl: 'clamp(40px,7vw,92px)', l: 'clamp(32px,5vw,62px)', m: 'clamp(26px,3.4vw,40px)' } as const;

const gap = 'clamp(10px,1.6vw,18px)';
const block = (max: number): React.CSSProperties => ({ maxWidth: max, margin: 'clamp(34px,5vw,56px) auto', padding: '0 24px' });

// ── Building blocks ──────────────────────────────────────────────────────────
const Col: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section data-reveal style={{ maxWidth: 640, margin: '0 auto', padding: '0 24px' }}>{children}</section>
);

/** Adrian's question: italic, set off by a short bronze rule. */
const Q: React.FC<{ children: React.ReactNode; first?: boolean }> = ({ children, first }) => (
  <p style={{ ...pBody, position: 'relative', paddingLeft: 22, fontStyle: 'italic', color: C.warm, marginTop: first ? 0 : 'clamp(30px,4vw,44px)' }}>
    <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: '0.9em', width: 12, height: 1, background: C.gold }} />
    {children}
  </p>
);

/** A complete sentence of his, set large. Never a fragment. */
const Line: React.FC<{ size: keyof typeof lineSize; children: React.ReactNode; style?: React.CSSProperties }> = ({ size, children, style }) => (
  <p style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 300, fontSize: lineSize[size], lineHeight: 1.08, letterSpacing: '-0.01em', color: C.cream, margin: 0, textWrap: 'balance', ...style } as React.CSSProperties}>
    {children}
  </p>
);
const Gold: React.FC<{ children: React.ReactNode }> = ({ children }) => <span style={{ fontWeight: 400, color: C.goldLt }}>{children}</span>;

type Shot = { slot: string; file: string; alt: string; x?: number; y?: number };
const Photo: React.FC<{ shot: Shot; aspect?: string; fill?: boolean }> = ({ shot, aspect = '4/5', fill }) => (
  <EditablePhoto
    slot={shot.slot}
    alt={shot.alt}
    aspect={aspect}
    fill={fill}
    bare
    defaultPhoto={{ url: IMG + shot.file, x: shot.x, y: shot.y }}
  />
);

const Row: React.FC<{ shots: Shot[]; aspect?: string; min?: number; stagger?: boolean; caption?: string }> = ({ shots, aspect = '4/5', min = 260, stagger, caption }) => (
  <figure data-reveal style={{ ...block(1040) }}>
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${min}px),1fr))`, gap }}>
      {shots.map((s, i) => (
        <div key={s.slot} style={stagger && i === 1 ? { marginTop: 'clamp(0px,8vw,110px)' } : undefined}>
          <Photo shot={s} aspect={aspect} />
        </div>
      ))}
    </div>
    {caption && <figcaption style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.5, color: C.dim, marginTop: 12 }}>{caption}</figcaption>}
  </figure>
);

const Wide: React.FC<{ shot: Shot; max?: number; aspect?: string }> = ({ shot, max = 1040, aspect = '3/2' }) => (
  <figure data-reveal style={block(max)}><Photo shot={shot} aspect={aspect} /></figure>
);

const FullBleed: React.FC<{ shot: Shot }> = ({ shot }) => (
  <figure data-reveal style={{ position: 'relative', margin: 'clamp(40px,6vw,80px) 0', height: 'clamp(480px,86vh,880px)' }}>
    <Photo shot={shot} fill />
  </figure>
);

/** Photo and words side by side; stacks on a phone. */
const Side: React.FC<{ shot: Shot; flip?: boolean; children: React.ReactNode }> = ({ shot, flip, children }) => (
  <section data-reveal style={{ maxWidth: 1100, margin: 'clamp(40px,6vw,80px) auto', padding: '0 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))', gap: 'clamp(28px,5vw,72px)', alignItems: 'center' }}>
    <div style={{ order: flip ? 1 : 0 }}>{children}</div>
    <div style={{ order: flip ? 0 : 1 }}><Photo shot={shot} /></div>
  </section>
);

/** Section marker: title on the left, the numeral on the far right. */
const Movement: React.FC<{ numeral: string; title: string }> = ({ numeral, title }) => (
  <div data-reveal style={{ maxWidth: 1040, margin: 'clamp(70px,10vw,130px) auto clamp(30px,4vw,48px)', padding: '0 24px' }}>
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
      <h2 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(28px,4vw,48px)', lineHeight: 1.05, color: C.cream, margin: '0 0 0.12em', textWrap: 'balance' } as React.CSSProperties}>{title}</h2>
      <span aria-hidden="true" style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 300, fontSize: 'clamp(70px,11vw,150px)', lineHeight: 0.8, color: C.gold }}>{numeral}</span>
    </div>
    <div style={{ height: 1, background: 'rgb(var(--tj-read-gold-rgb) / 0.2)', marginTop: 18 }} />
  </div>
);

// ── Photographs ──────────────────────────────────────────────────────────────
const S = {
  portrait: { slot: 'portrait', file: 'portrait.jpg', alt: 'Shangyin Qiwu seated in his studio', y: 0.4 },
  classTable: { slot: 'class-table', file: 'class-at-the-table.jpg', alt: 'Adrian at the repair table during the class, seen through the studio window', y: 0.4 },
  classCup: { slot: 'class-cup', file: 'class-at-the-cup.jpg', alt: 'Adrian bent over a cup, working the lining with a small tool' },
  goldSeam: { slot: 'gold-seam', file: 'gold-seam-bowl.jpg', alt: 'A dark bowl with a gold seam along its rim' },
  jar: { slot: 'jar', file: 'jar-in-hand.jpg', alt: 'A hand turning an old glazed jar with a repaired rim' },
  stapledBowl: { slot: 'stapled-bowl', file: 'stapled-bowl.jpg', alt: 'A bowl mended with a row of staples' },
  stapledLid: { slot: 'stapled-lid', file: 'stapled-lid.jpg', alt: 'A lid held together with metal staples', y: 0.7 },
  shelves: { slot: 'shelves', file: 'display-shelves.jpg', alt: 'Repaired cups and jars displayed on open shelves' },
  goldBowl: { slot: 'gold-bowl', file: 'gold-mended-bowl.jpg', alt: 'A dark tea bowl with gold repair lines, alone on a pale ground', y: 1 },
  kettle: { slot: 'kettle', file: 'kettle-over-charcoal.jpg', alt: 'An iron kettle steaming over a charcoal stove, calligraphy behind' },
  pouring: { slot: 'pouring', file: 'pouring.jpg', alt: 'Tea poured from a clay pot into three white cups' },
  cup: { slot: 'cup', file: 'cup-on-wood.jpg', alt: 'A single cup of tea on dark wood' },
  mendedDish: { slot: 'mended-dish', file: 'teapot-on-mended-dish.jpg', alt: 'A teapot on a mended dish beside a cup of tea' },
  liningHand: { slot: 'lining-hand', file: 'lining-in-hand.jpg', alt: 'Hands shaping the metal lining of a green cup' },
  liningClose: { slot: 'lining-close', file: 'lining-close.jpg', alt: 'A hammered metal lining held up close, its pierced centre' },
  whiteBowl: { slot: 'white-bowl', file: 'white-footed-bowl.jpg', alt: 'One white footed bowl in the dark' },
  goldDish: { slot: 'gold-dish', file: 'teapot-on-gold-dish.jpg', alt: 'A clay teapot resting on a dish mended with gold', y: 0.7 },
  courtyard: { slot: 'courtyard', file: 'courtyard-table.jpg', alt: 'Working at a table in the courtyard' },
  settingCups: { slot: 'setting-cups', file: 'setting-cups.jpg', alt: 'Hands setting out cups at the tea table' },
  listening: { slot: 'listening', file: 'listening.jpg', alt: 'Listening at the tea table, hand at his chin' },
  stream: { slot: 'stream', file: 'by-the-stream.jpg', alt: 'Sitting on the rocks beside a stream' },
  studio: { slot: 'studio', file: 'studio-table.jpg', alt: 'The studio table by candlelight, cups, bowls and pots laid out' },
  classBench: { slot: 'class-bench', file: 'class-at-the-bench.jpg', alt: 'Adrian at the workbench, working a cup' },
  classPieces: { slot: 'class-pieces', file: 'class-cup-and-dish.jpg', alt: 'A green cup and a shallow dish, both lined with hammered metal, on the workbench' },
  lastBowl: { slot: 'last-bowl', file: 'stapled-bowl-grasses.jpg', alt: 'A stapled tea bowl on a dark shelf, dry grasses lit behind it', y: 0.62 },
} satisfies Record<string, Shot>;

// ── Page ─────────────────────────────────────────────────────────────────────
const CraftRenewalPorcelain: React.FC = () => {
  const [accent, setAccent] = useState<string>(ACCENTS[0]);
  useImmersiveChrome(accent);
  const rootRef = useReveals([]);
  const progress = useReadingProgress();

  return (
    <StoryEditProvider slug={STORY_SLUG}>
      <ImmersiveRoot rootRef={rootRef}>
        <Helmet><title>Shangyin Qiwu · Porcelain and Tea · Teajia</title></Helmet>
        <ImmersiveNav progress={progress} />
        <AccentSwatches accent={accent} setAccent={setAccent} />

        <article style={{ position: 'relative', zIndex: 1 }}>
          {/* COVER: portrait left, title right; on a phone the title comes first */}
          <header className="tj-cover-dissolve" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', alignItems: 'stretch', borderBottom: '1px solid rgb(var(--tj-read-gold-rgb) / 0.14)' }}>
            <div className="tj-cover-text" style={{ order: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(36px,6vw,84px) clamp(24px,5vw,72px)' }}>
              <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.34em', textTransform: 'uppercase', color: C.gold, marginBottom: 28 }}>Conversations over Tea</div>
              <h1 style={{ fontFamily: F.display, fontWeight: 300, fontSize: 'clamp(52px,8vw,112px)', lineHeight: 0.94, letterSpacing: '-0.02em', color: C.cream, margin: 0 }}>
                <EditableText field="title-1" as="span">Porcelain</EditableText><br />
                <span style={{ fontStyle: 'italic', fontWeight: 400, color: C.gold }}><EditableText field="title-2" as="span">and Tea</EditableText></span>
              </h1>
              <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(16px,2vw,20px)', lineHeight: 1.5, color: C.taupe, margin: '28px 0 0', maxWidth: 440 }}>
                <EditableText field="dek-2" as="span" multiline>A conversation with a porcelain restorer in Wuyi.</EditableText>
              </p>
              <div style={{ marginTop: 'clamp(30px,5vw,46px)', paddingTop: 22, borderTop: '1px solid rgb(var(--tj-read-gold-rgb) / 0.16)', display: 'grid', gridTemplateColumns: '52px minmax(0,1fr)', rowGap: 20 }}>
                <div style={creditLabel}>With</div>
                <div>
                  <div style={{ fontFamily: F.display, fontSize: 24, color: C.ink, lineHeight: 1.1 }}>
                    <Link to="/people/shangyin-qiwu" style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px solid rgb(var(--tj-read-gold-rgb) / 0.35)' }}>Shangyin Qiwu</Link>
                    <span style={{ fontFamily: F.cn, color: C.taupe, fontSize: 18, marginLeft: 8 }}>上隐器物</span>
                  </div>
                  <div style={{ fontFamily: F.ui, fontSize: 12, letterSpacing: '0.04em', color: C.taupe, marginTop: 6 }}>Porcelain restorer, Wuyi, China</div>
                </div>
                <div style={creditLabel}>By</div>
                <div>
                  <div style={{ fontFamily: F.display, fontSize: 24, color: C.ink, lineHeight: 1.1 }}>Adrian Rasmussen</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', marginTop: 6 }}>
                    <Link to="/people/adrian-rasmussen" style={bylineLink}>Teajia page</Link>
                    <a href="https://www.instagram.com/technicianofthesacred/" target="_blank" rel="noopener noreferrer" style={bylineLink}>Instagram</a>
                    <a href="https://adrianrasmussen.com" target="_blank" rel="noopener noreferrer" style={bylineLink}>Portfolio</a>
                  </div>
                </div>
              </div>
            </div>
            <div className="tj-cover-photo" style={{ order: 1, position: 'relative', overflow: 'hidden', minHeight: 'min(88vh,860px)', background: 'linear-gradient(155deg,var(--tj-read-empty-from) 0%,var(--tj-read-bg) 80%)' }}>
              <EditablePhoto
                slot="portrait"
                alt={S.portrait.alt}
                fill
                defaultPhoto={{ url: IMG + S.portrait.file, y: S.portrait.y }}
                placeholder={<div aria-hidden="true" style={{ ...grainCss('0.8', 150), opacity: 0.08 }} />}
              />
            </div>
          </header>

          {/* INTRO, in Adrian's voice */}
          <section data-reveal style={{ maxWidth: 640, margin: '0 auto', padding: 'clamp(56px,9vw,110px) 24px 0' }}>
            <EditableText field="intro" as="p" multiline style={{ fontFamily: F.body, fontSize: 'clamp(19px,2.3vw,23px)', lineHeight: 1.7, color: C.ink, margin: 0 }}>
              I learned restoration from Shangyin Qiwu. I took his class in Wuyi, and I was so interested that I wanted to come back and learn about his dedication to this craft, and his perspective.
            </EditableText>
          </section>
          <Row shots={[S.classTable, S.classCup]} />

          {/* I */}
          <Movement numeral="I" title="What brought me here" />
          <Col>
            <Q first>When did you decide that you felt inspired to work with porcelain restoration?</Q>
            <p style={pBody}>First of all, I quite like collecting things. Because of tea, I like to collect tea utensils. Many old utensils have some damage here and there. As the saying goes, nine out of ten old things are damaged. But I think these are all marks of history.</p>
          </Col>
          <Side shot={S.goldSeam}>
            <Line size="xl">Nine out of ten old things are damaged. <Gold>But these are all marks of history.</Gold></Line>
          </Side>
          <Col>
            <p style={pBody}>Before the repair, they couldn’t be used. After repair, they can return to our lives. Some utensils may be a hundred years old, and some may be a thousand. Just think about it: it’s a very wonderful thing that they can meet you after thousands of years, and continue to be with us now, on our tea tables or in our lives.</p>
            <p style={pBody}>So I don’t think it’s about inspiration. My love for these utensils naturally makes me find ways for them to be better passed on and better used.</p>
            <Q>Not everyone likes to use old utensils. Many people are happy using a gaiwan or some new cups. What is your connection to the past?</Q>
            <p style={pBody}>Whether one likes old things or new things, everyone has different preferences. Some people like coffee, others like tea. We can only do what we like in the present, and through this, attract like-minded friends. We sit down because of these utensils or a cup of tea, and we have plenty of topics to talk about.</p>
          </Col>
          <Side shot={S.jar} flip>
            <Line size="m">I can feel the state of the people who created them.</Line>
            <p style={{ ...pBody, marginTop: 22 }}>Old utensils carry a lot of history and culture. I like them because they have a more natural sense of historical vicissitudes. Moreover, I can feel the state of the people who created them at that time, through touching these utensils.</p>
          </Side>

          <Col>
            <Q first>Some people talk about karma, how old things carry a weight with them. By bringing these old things back to life, do you feel you are honoring the past?</Q>
          </Col>
          <section data-reveal style={{ maxWidth: 900, margin: '28px auto 0', padding: '0 24px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'clamp(20px,5vw,60px)', alignItems: 'start' }}>
            <div aria-hidden="true" style={{ writingMode: 'vertical-rl', fontFamily: F.cn, fontWeight: 200, fontSize: 'clamp(64px,12vw,150px)', lineHeight: 1, color: C.gold, opacity: 0.85, letterSpacing: '0.08em' }}>缘分</div>
            <div>
              <Line size="m" style={{ marginBottom: 22 }}>This feeling is very subtle, and I can’t quite put it into words.</Line>
              <p style={pBody}>It’s probably a kind of fate, <span style={cn}>缘分</span>. First I mastered this repair technique, and then I came to love these ancient ceramics. It’s probably some kind of fate.</p>
            </div>
          </section>

          <Col>
            <Q>How long ago were these repair techniques developed? Maybe a thousand years ago, people would just make a new cup.</Q>
            <p style={pBody}>Repair techniques have existed for thousands of years. In the past, people cherished utensils more. Many utensils from daily life that got damaged still show traces of repair. It was quite common in ancient times. In our society now it’s not as popular, because we can easily buy new things.</p>
          </Col>
          <Row shots={[S.stapledBowl, S.stapledLid]} caption="The repair of cracked porcelain using staples can be traced back to the Song Dynasty, more than 1,000 years ago." />

          <Col>
            <Q first>What do people who aren’t into old things not understand about teaware?</Q>
            <p style={pBody}>I take many of my pieces to exhibitions and markets, so more people can understand the connection between these ancient artifacts and modern life. I also share on Douyin and Xiaohongshu. When these things are damaged, people don’t know what they can be used for. But when I repair them, people discover, <span style={em}>“Oh, this thing can be used like this. It’s quite interesting.”</span></p>
          </Col>
          <Wide shot={S.shelves} max={688} aspect="4/5" />

          {/* The one line set on a photograph: the pale wall above the bowl */}
          <figure data-reveal style={{ position: 'relative', maxWidth: 820, margin: 'clamp(40px,6vw,80px) auto', padding: '0 24px' }}>
            <div style={{ position: 'relative', aspectRatio: '4/5' }}>
              <Photo shot={S.goldBowl} fill />
              <p style={{ position: 'absolute', zIndex: 2, left: 0, top: 'clamp(36px,8%,90px)', padding: '0 clamp(48px,9vw,96px)', maxWidth: '15ch', boxSizing: 'content-box', fontFamily: F.display, fontStyle: 'italic', fontWeight: 300, fontSize: lineSize.l, lineHeight: 1.08, color: PALE_INK, margin: 0, pointerEvents: 'none' }}>
                When we repair objects, we are also <span style={{ fontWeight: 400, color: PALE_GOLD }}>repairing ourselves.</span>
              </p>
            </div>
          </figure>

          {/* II */}
          <Movement numeral="II" title="Clay, fire, and patience" />
          <Side shot={S.kettle}>
            <Q first>Do these old techniques and tools change the actual taste of tea?</Q>
            <p style={pBody}>For old utensils, especially teacups and teapots, the clay of that era was likely superior to today’s. Ancient utensils were mainly fired with wood, and the temperature and transformation from wood firing are more layered and rich than modern electric firing. That’s a big reason so many people pursue old utensils and old cups.</p>
          </Side>
          <Col>
            <Q first>Does that clay no longer exist?</Q>
            <p style={pBody}>Clay is a large part of the reason, and it’s possible that such clay no longer exists today. Another reason is that people now pursue speed and convenience, so they no longer calm down as they did before. Most are chasing a fast rhythm and quick gains.</p>
            <Q>Can you feel the state of the person who made the cup? Someone making it for money, versus someone focused on mastering the craft?</Q>
            <p style={pBody}>Of course. You get what you pay for. It’s not that no one today focuses deeply, but there are many choices. You can buy a stove for 50 yuan, 500 yuan, or 5,000 yuan, and the same goes for cups. Price isn’t the only standard, but it’s an important factor in judging a utensil.</p>
          </Col>
          <Row shots={[S.pouring, S.cup, S.mendedDish]} aspect="3/4" min={200} />
          <Col>
            <Q first>Is there anything you would like this generation to value again, that the generations these antiques come from valued more?</Q>
            <p style={pBody}>The state of being dedicated to excelling at something. The ancients focused more on pursuing form, spirit, and inner expression. Nowadays this is somewhat lacking. It’s about slowing down, and devoting more energy to the thing itself.</p>
          </Col>
          <section data-reveal style={{ maxWidth: 1040, margin: 'clamp(50px,8vw,100px) auto', padding: '0 24px' }}>
            <Line size="xl">Restoration can’t be rushed.</Line>
            <p style={{ ...pBody, marginTop: 18, maxWidth: 640 }}>It requires time to polish slowly to produce a good result.</p>
          </section>
          <Row shots={[S.liningHand, S.liningClose]} />
          <Side shot={S.whiteBowl}>
            <Q first>When you take that time, polishing slowly, what do you feel it is cultivating in your life?</Q>
            <p style={pBody}>I think the main thing is being able to calm oneself down, slow down, and truly focus one’s energy on <span style={em}>a single utensil or a single matter.</span> It has made my life more steady and relaxed.</p>
            <Q>When someone brings these objects into their life, can they feel what you put into them?</Q>
            <p style={pBody}>Yes. Many friends, after getting these restored objects, first feel they are meaningful and interesting. Then they realize it helps them calm down and focus more on the present moment.</p>
          </Side>
          <Row shots={[S.goldDish, S.courtyard]} />

          {/* III */}
          <Movement numeral="III" title="Tea, and the work ahead" />
          <Col>
            <Q first>Tell me what tea is for you, since all these objects are around the ritual of tea.</Q>
            <p style={pBody}>Tea is an indispensable spiritual food in my life. Like a craft, it allows me to focus on the present moment, which is of great significance to me.</p>
            <Q>And with communities, with other people?</Q>
          </Col>
          <section data-reveal style={{ maxWidth: 1040, margin: 'clamp(30px,5vw,60px) auto', padding: '0 24px' }}>
            <Line size="xl">Tea is like an <Gold>invisible language.</Gold></Line>
          </section>
          <Col>
            <p style={pBody}>Just like us, from different countries, but we can sit together because of tea. Maybe the topic isn’t tea, but it brings us together. For me personally, tea is a spiritual practice and a way of life.</p>
          </Col>
          <Row shots={[S.settingCups, S.listening]} stagger />
          <Col>
            <Q first>What role does tea play in your city, and in China?</Q>
            <p style={pBody}>Tea plays many roles. It is a beverage, a gift, and a medium of communication. We sit around a tea table and talk about many things. It can be generous or selfish. This leaf absorbs the essence of heaven and earth, embodying the five elements and eight trigrams. It gathers the energy of the East in China. It’s remarkable that such energy can be concentrated in a single leaf and radiated outward.</p>
          </Col>
          <FullBleed shot={S.stream} />
          <Col>
            <Q first>What is your business name, and what does it mean?</Q>
            <p style={pBody}>My company’s name is Shangyin Qiwu, <span style={cn}>上隐器物</span>. What I do is related to lacquer, so I named it Shangyin Qiwu. It doesn’t have too many specific meanings. It’s just like a nickname.</p>
          </Col>
          <Wide shot={S.studio} />
          <Col>
            <Q first>What are your biggest challenges right now, and what are you inspired to learn?</Q>
            <p style={pBody}>My biggest challenge has been bridging reality and ideals. As artists, we invest time and energy for perfection, but sometimes fail to connect it to real life, which leads to financial problems. I’m gradually changing that, doing what I love while also creating economic benefits. My plan is to turn my skills into paid courses, so more people can learn and help preserve this craft.</p>
          </Col>
          <Side shot={S.classBench} flip>
            <Q first>One thing I realized a long time ago: if I hide my skills or my ways of doing things, it will end with me. So I have to have a way to give them, and inspire other people to feel connected to what I do, so it carries on past my life.</Q>
          </Side>
          <Col>
            <p style={pBody}>Yes. I think the economic base determines the superstructure. We can’t talk about ideals apart from life, nor focus on life without ideals. The bridge between the two is the economic base. As long as we obtain due rewards within our capabilities, we can make this work more meaningful and selfless. But we must first get our own lives in order. Then we can have better energy to spread meaningful things.</p>
          </Col>
          <Wide shot={S.classPieces} max={688} aspect="4/5" />

          {/* Pull line + In Brief */}
          <section data-reveal style={{ maxWidth: 1100, margin: 'clamp(40px,6vw,80px) auto', padding: '0 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 'clamp(28px,5vw,64px)', alignItems: 'center' }}>
            <Line size="m">“The ancients focused more on pursuing form, spirit, and inner expression.”</Line>
            <div style={{ border: '1px solid rgb(var(--tj-read-gold-rgb) / 0.2)', borderRadius: 4, background: 'linear-gradient(160deg,var(--tj-read-card-from),var(--tj-read-card-to))', padding: 'clamp(22px,3vw,32px)' }}>
              <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold, marginBottom: 18 }}>In Brief</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {[['Subject', 'Shangyin Qiwu · 上隐器物'], ['Craft', 'Porcelain restoration · lacquer'], ['Place', 'Wuyi, China'], ['Oldest method', 'Staple repair · Song Dynasty']].map(([k, v], i, all) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, paddingBottom: 11, borderBottom: i < all.length - 1 ? '1px solid rgb(var(--tj-read-gold-rgb) / 0.1)' : 'none' }}>
                    <span style={briefK}>{k}</span><span style={briefV}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* The last exchange, ending on his saying */}
          <Col>
            <Q first>By dedicating yourself so deeply to this one thing, what is the most impactful thing it has inspired in your life?</Q>
            <p style={pBody}>A broken object is like life. Life can’t be perfect, and neither can objects. When we repair objects, we are also repairing ourselves. We all have shortcomings. We identify problems, adjust them, and solve them. It’s the same with objects. Life is not afraid of difficulties. When facing them, find ways to solve them and embrace a new state of life. The saying I like is:</p>
          </Col>
          <section data-reveal style={{ maxWidth: 1040, margin: 'clamp(40px,6vw,72px) auto 0', padding: '0 24px', textAlign: 'center' }}>
            <Line size="l" style={{ maxWidth: '18ch', margin: '0 auto' }}>“The world is tattered, but we are still <Gold>mending it.</Gold>”</Line>
          </section>
          <FullBleed shot={S.lastBowl} />

          <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2, padding: '8px 24px 80px', textAlign: 'center' }}>
            Interview by Adrian Rasmussen &nbsp;·&nbsp; Wuyi &nbsp;·&nbsp; Conversations over Tea
          </div>

          <MoreFooter links={moreLinks} />
        </article>
      </ImmersiveRoot>
      <StoryEditorBar />
    </StoryEditProvider>
  );
};

export default CraftRenewalPorcelain;
