/**
 * Shangyin Qiwu — Porcelain and Tea, N°15
 * A porcelain restorer on repair, patience, and mending what we love.
 * First-person, built to match the immersive Read story pages.
 */
import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  C, F, ImmersiveRoot, ImmersiveNav, AccentSwatches, MoreFooter,
  useReveals, useReadingProgress, useImmersiveChrome, ACCENTS,
} from './immersive';

const moreLinks = [
  { to: '/read/earth-water-fire', kicker: 'Conversation · N°03', title: 'Earth, Water, Fire', blurb: 'A Jingdezhen potter on the vessels that hold the tea.' },
  { to: '/read/craft', kicker: 'The Craft · N°14', title: 'The Pot That Remembers', blurb: 'Yixing purple clay, and pots that age with you.' },
  { to: '/read/rock-remembers', kicker: 'Conversation · N°02', title: 'The Rock Remembers', blurb: 'A Wuyi roaster on fire, patience and lineage.' },
];

// ─── Shared sub-styles ───────────────────────────────────────────────────────
const pBody: React.CSSProperties = {
  fontFamily: F.body,
  fontSize: 'clamp(16px,2vw,18px)',
  lineHeight: 1.84,
  color: C.taupe,
  margin: '0 0 22px',
};

// ─── Section divider (Chinese numeral + label) ───────────────────────────────
const SectionDivider: React.FC<{ numeral: string; label: string; marginTop?: string }> = ({
  numeral,
  label,
  marginTop = 'clamp(40px,6vw,72px)',
}) => (
  <div
    data-reveal
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      margin: `${marginTop} 0 clamp(28px,4vw,40px)`,
    }}
  >
    <span style={{ fontFamily: F.cn, fontWeight: 400, fontSize: 26, color: C.gold, lineHeight: 1 }}>{numeral}</span>
    <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
    <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>{label}</span>
  </div>
);

const PullQuote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section data-reveal style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(48px,8vw,100px) 24px', textAlign: 'center' }}>
    <blockquote style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(26px,4.4vw,50px)', lineHeight: 1.2, color: C.cream, margin: '0 auto', maxWidth: 820 }}>
      {children}
    </blockquote>
    <div aria-hidden="true" style={{ width: 40, height: 1, background: C.gold, opacity: 0.5, margin: '34px auto 0' }} />
  </section>
);

// ─── Component ───────────────────────────────────────────────────────────────
const CraftRenewalPorcelain: React.FC = () => {
  const [accent, setAccent] = useState<string>(ACCENTS[0]);
  useImmersiveChrome(accent);
  const rootRef = useReveals([]);
  const progress = useReadingProgress();

  return (
    <ImmersiveRoot rootRef={rootRef}>
      <Helmet><title>Shangyin Qiwu · Porcelain and Tea · Teajia</title></Helmet>
      <ImmersiveNav eyebrow="The Craft · N°15" progress={progress} />
      <AccentSwatches accent={accent} setAccent={setAccent} />

      <article style={{ position: 'relative', zIndex: 1 }}>

        {/* ── COVER ─────────────────────────────────────────────────────── */}
        <header style={{
          position: 'relative',
          minHeight: '84vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 'clamp(40px,8vw,90px) 24px',
          overflow: 'hidden',
        }}>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 55% at 50% 32%, rgba(168,135,77,0.12), transparent 62%)' }} />
          <div aria-hidden="true" style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-54%)',
            fontFamily: F.cn,
            fontWeight: 200,
            fontSize: 'min(58vw,560px)',
            lineHeight: 1,
            color: 'rgba(168,135,77,0.05)',
            pointerEvents: 'none',
            userSelect: 'none',
          }}>缘</div>

          <div style={{ position: 'relative', maxWidth: 760 }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.42em', textTransform: 'uppercase', color: C.gold, marginBottom: 30 }}>
              The Craft &nbsp;·&nbsp; N°15
            </div>
            <h1 style={{
              fontFamily: F.display,
              fontWeight: 400,
              fontSize: 'clamp(46px,8.4vw,104px)',
              lineHeight: 0.99,
              letterSpacing: '-0.015em',
              color: C.cream,
              margin: 0,
            }}>
              Shangyin Qiwu{' '}
              <span style={{ fontStyle: 'italic', color: C.gold }}>Porcelain and Tea</span>
            </h1>
            <div aria-hidden="true" style={{ width: 54, height: 1, background: C.gold, opacity: 0.6, margin: '30px auto' }} />
            <p style={{
              fontFamily: F.body,
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 'clamp(17px,2.4vw,21px)',
              lineHeight: 1.6,
              color: C.taupe,
              maxWidth: 560,
              margin: '0 auto',
            }}>
              He was holding a broken porcelain lid, studying its crack as if it were a map. A conversation about tea that became a meditation on how we mend what we love.
            </p>
            <div style={{ marginTop: 34, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 }}>
              Interview by Adrian Rasmussen &nbsp;·&nbsp; China
            </div>
          </div>
        </header>

        {/* ── INTRODUCTION (Interviewer's Voice) ────────────────────────── */}
        <section style={{ maxWidth: 660, margin: '0 auto', padding: '0 24px' }}>
          <SectionDivider numeral="序" label="Introduction" marginTop="clamp(20px,4vw,40px)" />
          <p data-reveal style={pBody}>
            When I first met Shangyin Qiwu, he was holding a broken porcelain lid, studying its crack as if it were a map. He spoke softly, more about time than repair, more about patience than porcelain.
          </p>
          <p data-reveal style={{ ...pBody, margin: 0 }}>
            This story began as a conversation about tea, but it became a meditation on how we mend what we love.
          </p>
        </section>

        {/* ── I — What Brought Me Here ──────────────────────────────────── */}
        <section style={{ maxWidth: 660, margin: '0 auto', padding: '0 24px' }}>
          <SectionDivider numeral="一" label="What Brought Me Here" />
          <p data-reveal style={pBody}>
            I like collecting things. Because of tea, I collect utensils. Many old utensils have some damage. Nine out of ten old things are incomplete, but those marks are history.
          </p>
          <p data-reveal style={{ ...pBody, margin: 0 }}>
            When I repair them, they can return to our lives again. Some are a hundred years old, some a thousand. It is wonderful that they can meet you after so long and continue to live on our tea tables today.
          </p>
        </section>

        {/* ── II — Why I Repair ─────────────────────────────────────────── */}
        <section style={{ maxWidth: 660, margin: '0 auto', padding: '0 24px' }}>
          <SectionDivider numeral="二" label="Why I Repair" />
          <p data-reveal style={pBody}>
            It is not about inspiration. My love for these utensils naturally makes me find ways for them to be better passed on and used. Whether someone likes old or new, coffee or tea, everyone has different preferences.
          </p>
          <p data-reveal style={{ ...pBody, margin: 0 }}>
            We can only do what we love in the present, and through that meet friends who feel the same. Old utensils carry history and culture. By touching them, I can sense the state of the people who created them.
          </p>
        </section>

        {/* ── III — The Line of Repair ──────────────────────────────────── */}
        <section style={{ maxWidth: 660, margin: '0 auto', padding: '0 24px' }}>
          <SectionDivider numeral="三" label="The Line of Repair" />
          <p data-reveal style={pBody}>
            This feeling is subtle. It is probably fate. <span style={{ fontFamily: F.cn, color: C.gold }}>缘分</span> First I mastered this repair technique, and then I came to love ancient ceramics.
          </p>
          <p data-reveal style={{ ...pBody, margin: 0 }}>
            Repair has existed for thousands of years. In the past, people cherished things more. Many utensils that were damaged still show traces of repair. It was a common skill. Now life is easy. People can buy anything quickly, and this knowledge has almost disappeared.
          </p>
        </section>

        {/* ── PULL QUOTE 1 ──────────────────────────────────────────────── */}
        <PullQuote>"When we repair objects, we are also repairing ourselves."</PullQuote>

        {/* ── IV — Showing People the Value ─────────────────────────────── */}
        <section style={{ maxWidth: 660, margin: '0 auto', padding: '0 24px' }}>
          <SectionDivider numeral="四" label="Showing People the Value" />
          <p data-reveal style={pBody}>
            I bring my repaired pieces to exhibitions and markets so that more people can understand the connection between ancient objects and modern life. I also share them on platforms such as Douyin and Xiaohongshu.
          </p>
          <p data-reveal style={{ ...pBody, margin: 0 }}>
            When people see something damaged, they do not know what it can be used for. After I repair it and display it, they discover, <span style={{ fontStyle: 'italic', color: C.warm }}>Oh, it can still be used, and it is beautiful.</span>
          </p>
        </section>

        {/* ── V — Clay, Fire, and Patience ──────────────────────────────── */}
        <section style={{ maxWidth: 660, margin: '0 auto', padding: '0 24px' }}>
          <SectionDivider numeral="五" label="Clay, Fire, and Patience" />
          <p data-reveal style={pBody}>
            For teacups and teapots from older times, the clay was often better. They were fired with wood. The temperature and transformation of wood firing create layers and richness that electric firing cannot. Perhaps that kind of clay no longer exists.
          </p>
          <p data-reveal style={pBody}>
            People today move fast. They want things finished quickly. I slow it down. Restoration cannot be rushed. It takes time to polish, time to feel, time to make something good.
          </p>
          <p data-reveal style={{ ...pBody, margin: 0 }}>
            It is about slowing down a bit and devoting more energy to the thing itself. Whether it is a utensil or a type of tea, it needs more time to express itself better.
          </p>
        </section>

        {/* ── VI — Old Teaware and Taste ────────────────────────────────── */}
        <section style={{ maxWidth: 660, margin: '0 auto', padding: '0 24px' }}>
          <SectionDivider numeral="六" label="Old Teaware and Taste" />
          <p data-reveal style={{ ...pBody, margin: 0 }}>
            For old utensils, the clay and firing affect how tea tastes. The body of the cup breathes differently, and the texture of the surface softens the water. That is why many people pursue old utensils and old cups. They make the tea feel rounder, calmer, and they carry the quiet of time.
          </p>
        </section>

        {/* ── VII — What the Work Cultivates ────────────────────────────── */}
        <section style={{ maxWidth: 660, margin: '0 auto', padding: '0 24px' }}>
          <SectionDivider numeral="七" label="What the Work Cultivates" />
          <p data-reveal style={pBody}>
            Focusing on one utensil, one matter, has made my life steadier and more relaxed. I no longer chase speed, which used to make me impetuous.
          </p>
          <p data-reveal style={{ ...pBody, margin: 0 }}>
            Friends who use these restored objects say they feel calm when holding them. They begin to think, <span style={{ fontStyle: 'italic', color: C.warm }}>I should spend more time on the things in front of me.</span>
          </p>
        </section>

        {/* ── VIII — Repair and Life ────────────────────────────────────── */}
        <section style={{ maxWidth: 660, margin: '0 auto', padding: '0 24px' }}>
          <SectionDivider numeral="八" label="Repair and Life" />
          <p data-reveal style={pBody}>
            A broken object is like life. Life cannot be perfect, and neither can objects. When we repair objects, we are also repairing ourselves.
          </p>
          <p data-reveal style={{ ...pBody, margin: 0 }}>
            We all have shortcomings. We identify, adjust, and solve them, just like restoration. Life is not afraid of difficulties. When we face them, we find ways to repair and then embrace a new state of being.
          </p>
        </section>

        {/* ── PULL QUOTE 2 ──────────────────────────────────────────────── */}
        <PullQuote>"The world is tattered, but we are still mending it."</PullQuote>

        {/* ── IX — Tea and Spirit ───────────────────────────────────────── */}
        <section style={{ maxWidth: 660, margin: '0 auto', padding: '0 24px' }}>
          <SectionDivider numeral="九" label="Tea and Spirit" />
          <p data-reveal style={pBody}>
            Tea is an indispensable spiritual food. Like a craft, it helps me focus on the present moment. Tea is like an invisible language. We can sit together because of it, even from different countries. Maybe we talk about tea, maybe not, but it connects us.
          </p>
          <p data-reveal style={pBody}>
            It plays many roles. It is a beverage, a gift, and a medium of communication. We sit around a tea table and talk about many things. This leaf absorbs the essence of heaven and earth. It embodies the five elements and the eight trigrams. It gathers the energy of the East in China.
          </p>
          <p data-reveal style={{ ...pBody, margin: 0 }}>
            Such energy concentrated in one leaf and radiating outward is extraordinary. This thing called tea is interesting. It can be generous, and it can also be private. Tea shows harmony between nature and heart. For me, tea is both a spiritual practice and a way of living.
          </p>
        </section>

        {/* ── X — Work and Future ───────────────────────────────────────── */}
        <section style={{ maxWidth: 660, margin: '0 auto', padding: '0 24px' }}>
          <SectionDivider numeral="十" label="Work and Future" />
          <p data-reveal style={pBody}>
            My company is called Shangyin Qiwu. What I do is related to lacquer. The name is simply a nickname. The challenge for an artist is bridging ideals and reality. In pursuing perfection, we invest time, energy, and money, but sometimes fail to connect it with life.
          </p>
          <p data-reveal style={pBody}>
            We cannot talk about ideals apart from life, nor can we just focus on life without mentioning ideals. The bridge between the two is the economic base. Now I try to balance both. I do what I love while allowing the work to sustain itself.
          </p>
          <p data-reveal style={{ ...pBody, margin: 0 }}>
            I plan to turn these skills into courses so that more people can learn and help this craft endure. When we receive fair rewards for our effort, the work becomes meaningful and selfless. We must first set our lives in order. With a better life, we have better energy to share something truly meaningful.
          </p>
        </section>

        {/* ── CLOSING (Interviewer's Voice) ─────────────────────────────── */}
        <section data-reveal style={{ maxWidth: 660, margin: '0 auto', padding: 'clamp(40px,7vw,80px) 24px clamp(40px,6vw,72px)', textAlign: 'center' }}>
          <p style={{
            fontFamily: F.display,
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 'clamp(22px,3.4vw,32px)',
            lineHeight: 1.36,
            color: C.ink,
            margin: 0,
          }}>
            When we finished tea, he said simply, "The world is tattered, but we are still mending it." I left his studio thinking about the quiet work of hands. Not to fix, but to understand.
          </p>
          <div style={{ marginTop: 42, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 }}>
            Interview by Adrian Rasmussen &nbsp;·&nbsp; The Craft &nbsp;·&nbsp; N°15
          </div>
        </section>

        <MoreFooter links={moreLinks} />
      </article>
    </ImmersiveRoot>
  );
};

export default CraftRenewalPorcelain;
