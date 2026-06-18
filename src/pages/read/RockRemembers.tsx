/**
 * The Rock Remembers — Conversations over Tea, N°02
 * A Wuyi rock-tea roaster on fire, patience and lineage.
 * Ported pixel-faithfully from the tea-article-redesign mockup.
 */
import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  C, F, ImmersiveRoot, ImmersiveNav, AccentSwatches, MoreFooter,
  useReveals, useReadingProgress, useImmersiveChrome, grainCss, ACCENTS,
} from './immersive';

const moreLinks = [
  { to: '/read/earth-water-fire', kicker: 'Conversation · N°03', title: 'Earth, Water, Fire', blurb: 'A Jingdezhen potter on the vessels that hold the tea.' },
  { to: '/read/before-the-mist', kicker: 'Field Notes · N°04', title: 'Before the Mist Burns Away', blurb: 'A photo-essay from a Yunnan spring harvest.' },
  { to: '/read/leaf-to-liquor', kicker: 'The Art of Tea · N°01', title: 'From Leaf to Liquor', blurb: 'How a single leaf becomes the six colours of tea.' },
];

const qa = (q: string, body: React.ReactNode) => ({ q, body });

const pBody: React.CSSProperties = { fontFamily: F.body, fontSize: 'clamp(16px,2vw,18px)', lineHeight: 1.8, color: C.taupe, margin: '0 0 16px' };
const qStyle: React.CSSProperties = { fontFamily: F.display, fontStyle: 'italic', fontWeight: 500, fontSize: 'clamp(21px,2.6vw,26px)', lineHeight: 1.34, color: C.warm, margin: '0 0 18px', paddingLeft: 20, borderLeft: `2px solid ${C.gold}` };

const movementI = [
  qa('People speak of “rock rhyme” — yán yùn — as if it were something mystical. What is it, really?', (
    <>
      <p style={pBody}>It is not mystical. It is the mountain, tasted. The bushes here grow from cracks in the cliff, in soil that is more stone than earth. The root works for everything it gets — and you drink that work. A coolness at the back of the throat, like wet rock after rain.</p>
      <p style={{ ...pBody, margin: 0 }}>If a tea has it, you do not need to be told. Your body knows before your mind does.</p>
    </>
  )),
  qa('For someone who has never climbed Wuyi — describe it.', (
    <p style={{ ...pBody, margin: 0 }}>Narrow gorges. Red cliffs. Mist that does not lift until midday. Tea bushes growing where no sensible plant would dare. It is beautiful, but it is not gentle — and the best teas never come from gentle places.</p>
  )),
  qa('Does the place make the tea, or the maker?', (
    <p style={{ ...pBody, margin: 0 }}><span style={{ color: C.dim, fontStyle: 'italic' }}>(he laughs)</span> That is like asking whether the river or the bank makes the water move. The mountain gives. My work is only to not waste what it gives.</p>
  )),
];

const movementII = [
  qa('Your roasting is famous — and slow. Why charcoal, when machines are easier?', (
    <>
      <p style={pBody}>Because the fire must breathe. Charcoal gives a living heat; it rises and falls, and I rise and fall with it. A machine holds one temperature, and the tea learns nothing.</p>
      <p style={{ ...pBody, margin: 0 }}>Over charcoal, the leaf is persuaded. Some of my roasts take three passes across many weeks.</p>
    </>
  )),
  qa('Weeks?', (
    <p style={{ ...pBody, margin: 0 }}>Tea is in no hurry. Why should I be? I roast, then I let the tea rest and remember. Then I taste, and roast again only if it asks. The hardest skill is knowing when to stop — and then stopping.</p>
  )),
  qa('How do you know when it is right?', (
    <p style={{ ...pBody, margin: 0 }}>When the smoke and the flower meet, and neither one is louder. You cannot measure it. You can only sit with enough tea, for enough years, until the leaf will tell you itself.</p>
  )),
  qa('Does anything still surprise you about the fire?', (
    <p style={{ ...pBody, margin: 0 }}>Every year. The same charcoal, the same leaf — and still the tea finds a way to teach me something. The day it stops surprising me is the day I should put down the basket.</p>
  )),
];

const movementIII = [
  qa('Who taught you?', (
    <p style={{ ...pBody, margin: 0 }}>My father, and his silence. He rarely explained. He would hand me a cup and watch my face. If I frowned, he would only say, “Again.” I hated it. Now I teach my daughter the same way.</p>
  )),
  qa('Will she stay?', (
    <p style={{ ...pBody, margin: 0 }}>That is not for me to decide. I can only give her the mountain and the fire, and hope they keep her the way they kept me. The rock remembers longer than we do. Whatever I get wrong, the mountain will correct in the next generation.</p>
  )),
];

const Movement: React.FC<{ numeral: string; label: string; items: { q: string; body: React.ReactNode }[] }> = ({ numeral, label, items }) => (
  <section style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px' }}>
    <div data-reveal style={{ display: 'flex', alignItems: 'center', gap: 18, margin: 'clamp(34px,5vw,56px) 0 clamp(30px,4vw,44px)' }}>
      <span style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 30, color: C.gold, lineHeight: 1 }}>{numeral}</span>
      <span style={{ flex: 1, height: 1, background: 'rgba(168,135,77,0.22)' }} />
      <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>{label}</span>
    </div>
    {items.map((it, i) => (
      <div key={i} data-reveal style={{ marginBottom: 'clamp(32px,5vw,50px)' }}>
        <p style={qStyle}>{it.q}</p>
        {it.body}
      </div>
    ))}
  </section>
);

const RockRemembers: React.FC = () => {
  const [accent, setAccent] = useState<string>(ACCENTS[0]);
  useImmersiveChrome(accent);
  const rootRef = useReveals([]);
  const progress = useReadingProgress();

  return (
    <ImmersiveRoot rootRef={rootRef}>
      <Helmet><title>The Rock Remembers · Teajia</title></Helmet>
      <ImmersiveNav eyebrow="Conversations · N°02" progress={progress} />
      <AccentSwatches accent={accent} setAccent={setAccent} />

      <article style={{ position: 'relative', zIndex: 1 }}>
        {/* COVER */}
        <header style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,360px),1fr))', alignItems: 'stretch', borderBottom: '1px solid rgba(168,135,77,0.14)', minHeight: '90vh' }}>
          <div style={{ position: 'relative', order: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(36px,6vw,84px) clamp(24px,5vw,72px)' }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.34em', textTransform: 'uppercase', color: C.gold, marginBottom: 28 }}>Conversations over Tea</div>
            <h1 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(46px,7vw,92px)', lineHeight: 0.98, letterSpacing: '-0.015em', color: C.cream, margin: 0 }}>
              The Rock<br /><span style={{ fontStyle: 'italic', color: C.gold }}>Remembers</span>
            </h1>
            <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(16px,2vw,20px)', lineHeight: 1.5, color: C.taupe, margin: '26px 0 0', maxWidth: 440 }}>
              High in the Wuyi cliffs, a fourth-generation roaster tends a fire that never quite goes out — and listens for the moment his tea is ready to speak.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 'clamp(30px,5vw,46px)', paddingTop: 24, borderTop: '1px solid rgba(168,135,77,0.16)' }}>
              <div>
                <div style={{ fontFamily: F.display, fontSize: 24, color: C.ink, lineHeight: 1 }}>Chén Wǔ <span style={{ fontFamily: F.cn, color: C.taupe, fontSize: 20 }}>陈武</span></div>
                <div style={{ fontFamily: F.ui, fontSize: 10.5, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim, marginTop: 8 }}>Rock-tea roaster · Wuyishan, Fujian</div>
              </div>
            </div>
          </div>
          <div style={{ position: 'relative', order: 1, overflow: 'hidden', minHeight: '48vh', background: 'linear-gradient(155deg,#2a2117 0%,#14100b 80%)' }}>
            <div aria-hidden="true" style={{ ...grainCss('0.8', 150), opacity: 0.08 }} />
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 28%, rgba(168,135,77,0.16), transparent 64%)' }} />
            <div aria-hidden="true" style={{ position: 'absolute', top: '52%', left: '50%', transform: 'translate(-50%,-50%)', fontFamily: F.cn, fontWeight: 200, fontSize: 'min(38vw,300px)', lineHeight: 1, color: 'rgba(168,135,77,0.07)' }}>陈</div>
            <div aria-hidden="true" style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '46%', aspectRatio: '3/4', borderRadius: '50% 50% 0 0 / 64% 64% 0 0', border: '1px solid rgba(168,135,77,0.34)', borderBottom: 'none', background: 'linear-gradient(180deg, rgba(168,135,77,0.07), transparent 70%)' }} />
            <div aria-hidden="true" style={{ position: 'absolute', bottom: '14%', left: '50%', transform: 'translate(-50%,0)', width: '20%', aspectRatio: '1/1', borderRadius: '50%', border: '1px solid rgba(168,135,77,0.4)', background: 'radial-gradient(circle, rgba(168,135,77,0.12), transparent 70%)' }} />
            <div style={{ position: 'absolute', left: 'clamp(18px,3vw,28px)', bottom: 'clamp(18px,3vw,26px)', fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim }}>Portrait — in his roasting room</div>
          </div>
        </header>

        {/* STANDFIRST */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(56px,9vw,116px) 24px clamp(20px,4vw,44px)' }}>
          <p style={{ fontFamily: F.body, fontSize: 'clamp(18px,2.2vw,22px)', lineHeight: 1.74, color: C.ink, margin: 0 }}>
            <span style={{ float: 'left', fontFamily: F.display, fontWeight: 600, fontSize: '5em', lineHeight: 0.78, color: C.gold, margin: '8px 16px -4px 0' }}>T</span>
            o reach Chén Wǔ you climb. Past the last teahouse, past the tour groups, up a path slick with morning mist, to a low stone room where a century of charcoal has soaked into the walls. He is sixty-one, narrow as a bamboo cane, and he does not stop tending the fire as we speak. Below us, the Wuyi cliffs fall away into cloud. This is where rock tea is made — and, he insists, where it must be made.
          </p>
        </section>

        <Movement numeral="I" label="The Mountain" items={movementI} />

        {/* PULL QUOTE */}
        <section data-reveal style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(50px,8vw,104px) 24px', textAlign: 'center' }}>
          <blockquote style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(30px,5.2vw,58px)', lineHeight: 1.16, color: C.cream, margin: '0 auto', maxWidth: 820 }}>
            “The leaf is persuaded,<br />not forced.”
          </blockquote>
          <div aria-hidden="true" style={{ width: 40, height: 1, background: C.gold, opacity: 0.5, margin: '34px auto 0' }} />
        </section>

        {/* PHOTO ESSAY */}
        <section data-reveal style={{ padding: 'clamp(20px,4vw,40px) clamp(20px,5vw,56px) clamp(40px,6vw,72px)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))', gap: 'clamp(14px,2.4vw,26px)', maxWidth: 1180, margin: '0 auto' }}>
            {/* Plate I — cliffs */}
            <figure style={{ margin: 0 }}>
              <div style={{ position: 'relative', aspectRatio: '4/5', border: '1px solid rgba(168,135,77,0.2)', borderRadius: 3, overflow: 'hidden', background: 'linear-gradient(160deg,#241d14,#120e09)' }}>
                <div aria-hidden="true" style={grainCss('0.8', 120)} />
                <svg viewBox="0 0 240 300" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  <g fill="none" stroke="rgba(168,135,77,0.3)" strokeWidth="1">
                    <path d="M0 230 L60 120 L110 200 L160 90 L240 210 L240 300 L0 300 Z" fill="rgba(168,135,77,0.05)" />
                    <path d="M0 250 L70 160 L130 220 L190 140 L240 230" />
                  </g>
                </svg>
                <div style={plateLabel}>Plate I</div>
              </div>
              <figcaption style={cap}>The red cliffs above Zhengyan, where the oldest bushes grow.</figcaption>
            </figure>
            {/* Plate II — charcoal glow */}
            <figure style={{ margin: 0 }}>
              <div style={{ position: 'relative', aspectRatio: '4/5', border: '1px solid rgba(168,135,77,0.2)', borderRadius: 3, overflow: 'hidden', background: 'radial-gradient(ellipse 60% 50% at 50% 70%, rgba(180,90,40,0.18), transparent 65%), #1a1610' }}>
                <div aria-hidden="true" style={grainCss('0.85', 120)} />
                <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: '54%', aspectRatio: '1/1', borderRadius: '50%', border: '1px solid rgba(168,135,77,0.32)' }} />
                <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '58%', transform: 'translate(-50%,-50%)', width: '30%', aspectRatio: '1/1', borderRadius: '50%', background: 'radial-gradient(circle, rgba(200,110,40,0.4), transparent 70%)' }} />
                <div style={plateLabel}>Plate II</div>
              </div>
              <figcaption style={cap}>Charcoal baskets, mid-roast. The fire is never left alone.</figcaption>
            </figure>
            {/* Plate III — hands */}
            <figure style={{ margin: 0 }}>
              <div style={{ position: 'relative', aspectRatio: '4/5', border: '1px solid rgba(168,135,77,0.2)', borderRadius: 3, overflow: 'hidden', background: 'linear-gradient(160deg,#241d14,#120e09)' }}>
                <div aria-hidden="true" style={grainCss('0.8', 120)} />
                <svg viewBox="0 0 240 300" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  <g fill="none" stroke="rgba(168,135,77,0.34)" strokeWidth="1.1">
                    <path d="M80 120 C70 160, 75 210, 100 235 C120 215, 130 200, 132 175" />
                    <path d="M132 150 C150 150, 168 165, 170 195 C150 205, 138 200, 130 188" />
                    <path d="M100 235 C110 250, 130 252, 150 244" />
                  </g>
                </svg>
                <div style={plateLabel}>Plate III</div>
              </div>
              <figcaption style={cap}>His hands — fifty years at the fire.</figcaption>
            </figure>
          </div>
        </section>

        <Movement numeral="II" label="The Fire" items={movementII} />

        {/* FACT FILE + PULL QUOTE */}
        <section data-reveal style={{ maxWidth: 1040, margin: '0 auto', padding: 'clamp(30px,5vw,56px) 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 'clamp(28px,5vw,56px)', alignItems: 'center' }}>
            <blockquote style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(26px,3.6vw,42px)', lineHeight: 1.2, color: C.cream, margin: 0 }}>
              “The hardest skill is knowing when to stop — and then stopping.”
            </blockquote>
            <div style={{ border: '1px solid rgba(168,135,77,0.2)', borderRadius: 4, background: 'linear-gradient(160deg,#1d1810,#15110b)', padding: 'clamp(24px,3vw,34px)' }}>
              <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold, marginBottom: 20 }}>In Brief</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                {[['Region', 'Wuyishan, Fujian'], ['Craft', 'Yánchá · charcoal roast'], ['Generations', 'Four']].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, paddingBottom: 13, borderBottom: '1px solid rgba(168,135,77,0.1)' }}>
                    <span style={briefK}>{k}</span><span style={briefV}>{v}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <span style={briefK}>Signature</span><span style={briefV}>Rou Gui 肉桂</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Movement numeral="III" label="The Lineage" items={movementIII} />

        {/* THEIR TEA */}
        <section data-reveal style={{ maxWidth: 1040, margin: '0 auto', padding: 'clamp(30px,5vw,56px) 24px' }}>
          <div style={{ border: '1px solid rgba(168,135,77,0.18)', borderRadius: 4, background: 'linear-gradient(160deg,#1d1810,#15110b)', padding: 'clamp(24px,4vw,44px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 20, borderBottom: '1px solid rgba(168,135,77,0.12)', marginBottom: 28, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold }}>The tea he poured us</span>
              <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim }}>~50% oxidised · medium roast</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))', gap: 'clamp(28px,5vw,56px)' }}>
              <div>
                <div style={{ fontFamily: F.cn, fontSize: 24, color: C.taupe, marginBottom: 6 }}>肉桂</div>
                <h3 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 30, color: C.cream, margin: '0 0 14px' }}>Rou Gui</h3>
                <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 15, lineHeight: 1.6, color: C.taupe, margin: 0 }}>
                  Roast cinnamon and orchid over warm stone, with the long mineral finish the Wuyi cliffs call <em style={{ color: C.gold }}>yán yùn</em> — rock rhyme.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'center' }}>
                <Meter label="Body" value="Full" pct={84} />
                <Meter label="Roast" value="Medium" pct={56} />
                <Meter label="Finish" value="Very long" pct={92} />
              </div>
            </div>
          </div>
        </section>

        {/* CLOSING */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(40px,6vw,72px) 24px' }}>
          <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(17px,2.1vw,20px)', lineHeight: 1.72, color: C.taupe, margin: 0 }}>
            By the time we leave, the mist has burned away and the cliffs stand clear and red against the sky. Chén Wǔ does not see us out; he is bent over the baskets, listening to the fire. The tea, he says, is almost ready to tell him something.
          </p>
          <div style={colophon}>Interview by Teajia &nbsp;·&nbsp; Conversations over Tea &nbsp;·&nbsp; N°02</div>
        </section>

        <MoreFooter links={moreLinks} />
      </article>
    </ImmersiveRoot>
  );
};

// shared sub-styles
const plateLabel: React.CSSProperties = { position: 'absolute', left: 14, bottom: 12, fontFamily: F.mono, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.gold };
const cap: React.CSSProperties = { fontFamily: F.body, fontStyle: 'italic', fontSize: 13, lineHeight: 1.5, color: C.dim, marginTop: 12 };
const briefK: React.CSSProperties = { fontFamily: F.ui, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.dim };
const briefV: React.CSSProperties = { fontFamily: F.body, fontSize: 15, color: C.ink, textAlign: 'right' };
const colophon: React.CSSProperties = { marginTop: 40, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 };

const Meter: React.FC<{ label: string; value: string; pct: number }> = ({ label, value, pct }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.taupe, marginBottom: 7 }}>
      <span>{label}</span><span style={{ color: C.dim }}>{value}</span>
    </div>
    <div style={{ height: 3, background: 'rgba(168,135,77,0.12)', borderRadius: 2 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: C.gold, borderRadius: 2 }} />
    </div>
  </div>
);

export default RockRemembers;
