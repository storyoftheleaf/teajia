/**
 * @color-literals. The Read section is one always-dark editorial surface.
 * Rationale, and the conditions on this exception, in read/immersive.tsx.
 */
/**
 * Shangyin Qiwu: Porcelain and Tea, N°15
 * A porcelain restorer on repair, patience, and mending what we love.
 * The only real interview in the issue. Built on the Earth, Water, Fire
 * conversation frame (split cover, standfirst, movements, photo plates,
 * fact file) so it can carry real photographs.
 *
 * PHOTO SLOTS: each <PhotoPlate> and the cover portrait hold an `src`. Drop a
 * real image URL into the marked `src=""` props below and the frame fills;
 * leave it empty and a captioned placeholder shows. No layout change either way.
 */
import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  C, F, ImmersiveRoot, ImmersiveNav, AccentSwatches, MoreFooter,
  useReveals, useReadingProgress, useImmersiveChrome, grainCss, ACCENTS,
} from './immersive';
import EditablePhoto from './EditablePhoto';
import PlateRow from './PlateRow';
import { StoryEditProvider, EditableText } from './storyEdit';
import StoryEditorBar from './StoryEditorBar';

const STORY_SLUG = 'porcelain-and-tea';

const moreLinks = [
  { to: '/read/earth-water-fire', kicker: 'Conversation · N°03', title: 'Earth, Water, Fire', blurb: 'A Jingdezhen potter on the vessels that hold the tea.' },
  { to: '/read/craft', kicker: 'The Craft · N°14', title: 'The Pot That Remembers', blurb: 'Yixing purple clay, and pots that age with you.' },
  { to: '/read/rock-remembers', kicker: 'Conversation · N°02', title: 'The Rock Remembers', blurb: 'A Wuyi roaster on fire, patience and lineage.' },
];

const pBody: React.CSSProperties = { fontFamily: F.body, fontSize: 'clamp(16px,2vw,18px)', lineHeight: 1.8, color: C.taupe, margin: '0 0 16px' };
const cap: React.CSSProperties = { fontFamily: F.body, fontStyle: 'italic', fontSize: 13, lineHeight: 1.5, color: C.dim, marginTop: 12 };
const plateLabel: React.CSSProperties = { position: 'absolute', left: 14, bottom: 12, fontFamily: F.mono, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.gold };
const briefK: React.CSSProperties = { fontFamily: F.ui, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.dim };
const briefV: React.CSSProperties = { fontFamily: F.body, fontSize: 15, color: C.ink, textAlign: 'right' };
const colophon: React.CSSProperties = { marginTop: 40, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 };

// ── Section block (first-person prose, numeral + label) ──────────────────────
const Movement: React.FC<{ numeral: string; label: string; children: React.ReactNode }> = ({ numeral, label, children }) => (
  <section style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px' }}>
    <div data-reveal style={{ display: 'flex', alignItems: 'center', gap: 18, margin: 'clamp(34px,5vw,56px) 0 clamp(30px,4vw,44px)' }}>
      <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 30, color: C.gold, lineHeight: 1 }}>{numeral}</span>
      <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
      <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>{label}</span>
    </div>
    <div data-reveal>{children}</div>
  </section>
);

const SubHead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p data-reveal style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 500, fontSize: 'clamp(19px,2.4vw,24px)', lineHeight: 1.34, color: C.warm, margin: 'clamp(28px,4vw,40px) 0 16px' }}>
    {children}
  </p>
);

const CraftRenewalPorcelain: React.FC = () => {
  const [accent, setAccent] = useState<string>(ACCENTS[0]);
  useImmersiveChrome(accent);
  const rootRef = useReveals([]);
  const progress = useReadingProgress();

  return (
    <StoryEditProvider slug={STORY_SLUG}>
      <ImmersiveRoot rootRef={rootRef}>
        <Helmet><title>Shangyin Qiwu · Porcelain and Tea · Teajia</title></Helmet>
        <ImmersiveNav eyebrow="Conversations · N°15" progress={progress} />
        <AccentSwatches accent={accent} setAccent={setAccent} />

        <article style={{ position: 'relative', zIndex: 1 }}>
          {/* COVER, split portrait + title */}
          <header style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,360px),1fr))', alignItems: 'stretch', borderBottom: '1px solid rgba(168,135,77,0.14)', minHeight: '90vh' }}>
            <div style={{ position: 'relative', order: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(36px,6vw,84px) clamp(24px,5vw,72px)' }}>
              <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.34em', textTransform: 'uppercase', color: C.gold, marginBottom: 28 }}>Conversations over Tea</div>
              <h1 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(44px,6.6vw,88px)', lineHeight: 1.0, letterSpacing: '-0.015em', color: C.cream, margin: 0 }}>
                <EditableText field="title-1" as="span">Porcelain</EditableText><br /><span style={{ fontStyle: 'italic', color: C.gold }}><EditableText field="title-2" as="span">and Tea</EditableText></span>
              </h1>
              <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(16px,2vw,20px)', lineHeight: 1.5, color: C.taupe, margin: '26px 0 0', maxWidth: 440 }}>
                <EditableText field="dek" as="span" multiline>He was holding a broken porcelain lid, studying its crack as if it were a map. A conversation about tea that became a meditation on how we mend what we love.</EditableText>
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 'clamp(30px,5vw,46px)', paddingTop: 24, borderTop: '1px solid rgba(168,135,77,0.16)' }}>
                <div>
                  <div style={{ fontFamily: F.display, fontSize: 24, color: C.ink, lineHeight: 1 }}><EditableText field="subject-name" as="span">Shangyin Qiwu</EditableText> <span style={{ fontFamily: F.cn, color: C.taupe, fontSize: 20 }}>尚隐器物</span></div>
                  <div style={{ fontFamily: F.ui, fontSize: 10.5, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim, marginTop: 8 }}><EditableText field="subject-role" as="span">Porcelain restorer · China</EditableText></div>
                </div>
              </div>
            </div>
            {/* COVER PORTRAIT, drag a real photo in (owner), pan/zoom, save */}
            <div style={{ position: 'relative', order: 1, overflow: 'hidden', minHeight: '48vh', background: 'linear-gradient(155deg,#23252a 0%,#14100b 80%)' }}>
              <EditablePhoto
                slot="portrait"
                alt="Shangyin Qiwu at his repair table"
                fill
                placeholder={
                  <>
                    <div aria-hidden="true" style={{ ...grainCss('0.8', 150), opacity: 0.08 }} />
                    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 32%, rgba(150,180,180,0.12), transparent 64%)' }} />
                    <div aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontFamily: F.cn, fontWeight: 200, fontSize: 'min(38vw,300px)', lineHeight: 1, color: 'rgba(168,135,77,0.07)' }}>缘</div>
                  </>
                }
              />
              <div style={{ position: 'absolute', left: 'clamp(18px,3vw,28px)', bottom: 'clamp(18px,3vw,26px)', fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim, pointerEvents: 'none' }}>Portrait, at the repair table</div>
            </div>
          </header>

          {/* STANDFIRST */}
          <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(56px,9vw,116px) 24px clamp(20px,4vw,44px)' }}>
            <p style={{ fontFamily: F.body, fontSize: 'clamp(18px,2.2vw,22px)', lineHeight: 1.74, color: C.ink, margin: 0 }}>
              <span style={{ float: 'left', fontFamily: F.display, fontWeight: 600, fontSize: '5em', lineHeight: 0.78, color: C.gold, margin: '8px 16px -4px 0' }}>W</span>
              <EditableText field="standfirst" as="span" multiline>hen I first met Shangyin Qiwu, he was holding a broken porcelain lid, studying its crack as if it were a map. He spoke softly, more about time than repair, more about patience than porcelain. This story began as a conversation about tea, but it became a meditation on how we mend what we love.</EditableText>
            </p>
          </section>

          {/* MOVEMENT I: Collecting & repair */}
          <Movement numeral="I" label="What Brought Me Here">
            <EditableText field="m1-p1" as="p" style={pBody} multiline>I like collecting things. Because of tea, I collect utensils. Many old utensils have some damage. Nine out of ten old things are incomplete, but those marks are history.</EditableText>
            <EditableText field="m1-p2" as="p" style={pBody} multiline>When I repair them, they can return to our lives again. Some are a hundred years old, some a thousand. It is wonderful that they can meet you after so long and continue to live on our tea tables today.</EditableText>

            <SubHead><EditableText field="sub-why" as="span">Why I repair</EditableText></SubHead>
            <EditableText field="m1-p3" as="p" style={pBody} multiline>It is not about inspiration. My love for these utensils naturally makes me find ways for them to be better passed on and used. Whether someone likes old or new, coffee or tea, everyone has different preferences.</EditableText>
            <EditableText field="m1-p4" as="p" style={pBody} multiline>We can only do what we love in the present, and through that meet friends who feel the same. Old utensils carry history and culture. By touching them, I can sense the state of the people who created them.</EditableText>

            <SubHead><EditableText field="sub-line" as="span">The line of repair</EditableText></SubHead>
            <p style={pBody}>This feeling is subtle. It is probably fate. <span style={{ fontFamily: F.cn, color: C.gold }}>缘分</span> First I mastered this repair technique, and then I came to love ancient ceramics.</p>
            <p style={{ ...pBody, margin: 0 }}>Repair has existed for thousands of years. In the past, people cherished things more. Many utensils that were damaged still show traces of repair. It was a common skill. Now life is easy. People can buy anything quickly, and this knowledge has almost disappeared.</p>
          </Movement>

          {/* PULL QUOTE */}
          <section data-reveal style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(50px,8vw,104px) 24px', textAlign: 'center' }}>
            <blockquote style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(28px,4.8vw,54px)', lineHeight: 1.18, color: C.cream, margin: '0 auto', maxWidth: 840 }}>
              <EditableText field="quote-1" as="span">"When we repair objects, we are also repairing ourselves."</EditableText>
            </blockquote>
            <div aria-hidden="true" style={{ width: 40, height: 1, background: C.gold, opacity: 0.5, margin: '34px auto 0' }} />
          </section>

          {/* PHOTO ESSAY, plates the owner can reorder, add to, or remove */}
          <PlateRow
            initial={[
              { slot: 'plate-1', alt: 'A broken piece before repair', label: 'Plate I', caption: 'Nine out of ten old things are incomplete. But those marks are history.', captionField: 'cap-plate-1' },
              { slot: 'plate-2', alt: 'Hands at the repair, the seam of gold', label: 'Plate II', caption: 'The line of repair, drawn slowly by hand.', captionField: 'cap-plate-2' },
              { slot: 'plate-3', alt: 'The mended piece back on the tea table', label: 'Plate III', caption: 'Repaired and displayed: oh, it can still be used, and it is beautiful.', captionField: 'cap-plate-3' },
            ]}
          />

          {/* MOVEMENT II: Slowness & taste */}
          <Movement numeral="II" label="Clay, Fire, and Patience">
            <p style={pBody}>I bring my repaired pieces to exhibitions and markets so that more people can understand the connection between ancient objects and modern life. I also share them on platforms such as Douyin and Xiaohongshu. When people see something damaged, they do not know what it can be used for. After I repair it and display it, they discover, <span style={{ fontStyle: 'italic', color: C.warm }}>Oh, it can still be used, and it is beautiful.</span></p>

            <SubHead><EditableText field="sub-clay" as="span">Clay, fire, and patience</EditableText></SubHead>
            <EditableText field="m2-p1" as="p" style={pBody} multiline>For teacups and teapots from older times, the clay was often better. They were fired with wood. The temperature and transformation of wood firing create layers and richness that electric firing cannot. Perhaps that kind of clay no longer exists.</EditableText>
            <EditableText field="m2-p2" as="p" style={pBody} multiline>People today move fast. They want things finished quickly. I slow it down. Restoration cannot be rushed. It takes time to polish, time to feel, time to make something good. It is about slowing down a bit and devoting more energy to the thing itself. Whether it is a utensil or a type of tea, it needs more time to express itself better.</EditableText>

            <SubHead><EditableText field="sub-taste" as="span">Old teaware and taste</EditableText></SubHead>
            <p style={{ ...pBody, margin: 0 }}>For old utensils, the clay and firing affect how tea tastes. The body of the cup breathes differently, and the texture of the surface softens the water. That is why many people pursue old utensils and old cups. They make the tea feel rounder, calmer, and they carry the quiet of time.</p>
          </Movement>

          {/* PULL QUOTE + FACT FILE */}
          <section data-reveal style={{ maxWidth: 1040, margin: '0 auto', padding: 'clamp(30px,5vw,56px) 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 'clamp(28px,5vw,56px)', alignItems: 'center' }}>
              <blockquote style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(26px,3.6vw,42px)', lineHeight: 1.2, color: C.cream, margin: 0 }}>
                <EditableText field="quote-2" as="span">"We all have shortcomings. We identify, adjust, and solve them, just like restoration."</EditableText>
              </blockquote>
              <div style={{ border: '1px solid rgba(168,135,77,0.2)', borderRadius: 4, background: 'linear-gradient(160deg,#1d1810,#15110b)', padding: 'clamp(24px,3vw,34px)' }}>
                <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold, marginBottom: 20 }}>In Brief</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                  {[['Subject', 'Shangyin Qiwu'], ['Craft', 'Porcelain restoration · lacquer'], ['Place', 'China']].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, paddingBottom: 13, borderBottom: '1px solid rgba(168,135,77,0.1)' }}>
                      <span style={briefK}>{k}</span><span style={briefV}>{v}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                    <span style={briefK}>Carries</span><span style={briefV}>History &amp; continuity</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* MOVEMENT III: Repair, tea, and the future */}
          <Movement numeral="III" label="Repair and Life">
            <p style={pBody}>Focusing on one utensil, one matter, has made my life steadier and more relaxed. I no longer chase speed, which used to make me impetuous. Friends who use these restored objects say they feel calm when holding them. They begin to think, <span style={{ fontStyle: 'italic', color: C.warm }}>I should spend more time on the things in front of me.</span></p>
            <EditableText field="m3-p1" as="p" style={pBody} multiline>A broken object is like life. Life cannot be perfect, and neither can objects. When we repair objects, we are also repairing ourselves. Life is not afraid of difficulties. When we face them, we find ways to repair and then embrace a new state of being.</EditableText>

            <SubHead><EditableText field="sub-tea" as="span">Tea and spirit</EditableText></SubHead>
            <EditableText field="m3-p2" as="p" style={pBody} multiline>Tea is an indispensable spiritual food. Like a craft, it helps me focus on the present moment. Tea is like an invisible language. We can sit together because of it, even from different countries. Maybe we talk about tea, maybe not, but it connects us.</EditableText>
            <EditableText field="m3-p3" as="p" style={pBody} multiline>This leaf absorbs the essence of heaven and earth. It embodies the five elements and the eight trigrams. It gathers the energy of the East in China. Such energy concentrated in one leaf and radiating outward is extraordinary. Tea shows harmony between nature and heart. For me, tea is both a spiritual practice and a way of living.</EditableText>

            <SubHead><EditableText field="sub-future" as="span">Work and future</EditableText></SubHead>
            <EditableText field="m3-p4" as="p" style={pBody} multiline>My company is called Shangyin Qiwu. What I do is related to lacquer. The name is simply a nickname. The challenge for an artist is bridging ideals and reality. We cannot talk about ideals apart from life, nor can we just focus on life without mentioning ideals. The bridge between the two is the economic base.</EditableText>
            <p style={{ ...pBody, margin: 0 }}>Now I try to balance both. I do what I love while allowing the work to sustain itself. I plan to turn these skills into courses so that more people can learn and help this craft endure. We must first set our lives in order. With a better life, we have better energy to share something truly meaningful.</p>
          </Movement>

          {/* CLOSING */}
          <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(40px,6vw,72px) 24px' }}>
            <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(17px,2.1vw,20px)', lineHeight: 1.72, color: C.taupe, margin: 0 }}>
              <EditableText field="closing" as="span" multiline>When we finished tea, he said simply, "The world is tattered, but we are still mending it." I left his studio thinking about the quiet work of hands. Not to fix, but to understand.</EditableText>
            </p>
            <div style={colophon}>Interview by Adrian Rasmussen &nbsp;·&nbsp; Conversations over Tea &nbsp;·&nbsp; N°15</div>
          </section>

          <MoreFooter links={moreLinks} />
        </article>
      </ImmersiveRoot>
      <StoryEditorBar />
    </StoryEditProvider>
  );
};

export default CraftRenewalPorcelain;
