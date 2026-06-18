/**
 * Earth, Water, Fire — Conversations over Tea, N°03
 * A Jingdezhen porcelain potter on the vessels that hold the tea.
 * Ported pixel-faithfully from the tea-article-redesign mockup.
 */
import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  C, F, ImmersiveRoot, ImmersiveNav, AccentSwatches, MoreFooter,
  useReveals, useReadingProgress, useImmersiveChrome, grainCss, ACCENTS,
} from './immersive';

const moreLinks = [
  { to: '/read/rock-remembers', kicker: 'Conversation · N°02', title: 'The Rock Remembers', blurb: 'A Wuyi rock-tea roaster on fire, patience & lineage.' },
  { to: '/read/before-the-mist', kicker: 'Field Notes · N°04', title: 'Before the Mist Burns Away', blurb: 'A photo-essay from a Yunnan spring harvest.' },
  { to: '/read/leaf-to-liquor', kicker: 'The Art of Tea · N°01', title: 'From Leaf to Liquor', blurb: 'How a single leaf becomes the six colours of tea.' },
];

const pBody: React.CSSProperties = { fontFamily: F.body, fontSize: 'clamp(16px,2vw,18px)', lineHeight: 1.8, color: C.taupe, margin: '0 0 16px' };
const qStyle: React.CSSProperties = { fontFamily: F.display, fontStyle: 'italic', fontWeight: 500, fontSize: 'clamp(21px,2.6vw,26px)', lineHeight: 1.34, color: C.warm, margin: '0 0 18px', paddingLeft: 20, borderLeft: `2px solid ${C.gold}` };

const qa = (q: string, body: React.ReactNode) => ({ q, body });

const movementI = [
  qa('This clay — where does it come from?', (
    <>
      <p style={pBody}>The same hills that have fed these kilns for a thousand years. Gaoling — the white earth. Foreigners took the word and called it kaolin. The mountain is lower now than when my grandmother dug it; we have been borrowing from it for forty generations.</p>
      <p style={{ ...pBody, margin: 0 }}>I think about that every time I open a bag.</p>
    </>
  )),
  qa('Does the material have a will of its own?', (
    <p style={{ ...pBody, margin: 0 }}>Always. Clay remembers how it was handled. Rush it, and it will crack in the fire to spite you. Centre it patiently, and it gives you everything. People think the potter shapes the clay. Mostly the clay is teaching the potter what it is willing to become.</p>
  )),
  qa('You could buy clay ready-mixed.', (
    <p style={{ ...pBody, margin: 0 }}>I could. But then the bowl would be anyone’s. I want the bowl to be from here — this water, this earth, this pair of hands. A vessel should carry its origin the way a tea carries its mountain.</p>
  )),
];

const movementII = [
  qa('The glaze on your cups — that pale blue-green — is famous. What is it?', (
    <>
      <p style={pBody}>Qingbai. “Blue-white.” It is mostly an accident we have spent a thousand years perfecting. The colour is not painted on; it is what the iron in the glaze does when the fire starves it of oxygen.</p>
      <p style={{ ...pBody, margin: 0 }}>We do not make the colour. We make the conditions, and the fire decides.</p>
    </>
  )),
  qa('That sounds like a loss of control.', (
    <p style={{ ...pBody, margin: 0 }}>It is. The kiln is the last and most important member of the workshop, and it does not take instruction. I load three hundred pieces and I lose some every firing. You learn to give the fire its share without resentment — what survives is better for the danger.</p>
  )),
  qa('Do you remember your first good piece?', (
    <p style={{ ...pBody, margin: 0 }}>I remember my first hundred bad ones. The good piece only came because of them. There is no shortcut through the bad bowls — every one is teaching your hands a sentence they will need later.</p>
  )),
  qa('How long until a potter is truly skilled?', (
    <p style={{ ...pBody, margin: 0 }}><span style={{ color: C.dim, fontStyle: 'italic' }}>(she smiles)</span> Ask me when I get there. My grandmother worked sixty years and called herself a student. I am only forty-three. I have barely been introduced to the clay.</p>
  )),
];

const movementIII = [
  qa('Does the cup really change the tea?', (
    <p style={{ ...pBody, margin: 0 }}>Of course. A thick cup holds heat and rounds a tea; a thin one lets it sing and fade quickly. Porcelain is honest — it adds nothing, hides nothing. That is why it suits green and oolong. The vessel is not a container. It is part of the brewing.</p>
  )),
  qa('What do you want someone to feel, holding your gaiwan?', (
    <p style={{ ...pBody, margin: 0 }}>That it was made by a person, for a person. The slight unevenness of the rim where my thumb passed. The weight that settles into the palm. A cup should disappear in use, and only be noticed in gratitude. If they forget it is mine, I have done well.</p>
  )),
  qa('After a thousand years, what is left to discover?', (
    <p style={{ ...pBody, margin: 0 }}>Everything. The clay is the same; I am not. Each generation meets the same earth with new hands and finds something the last one missed. That is not a burden — that is the gift. The mountain keeps its secrets long enough for all of us to have a turn.</p>
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

const cap: React.CSSProperties = { fontFamily: F.body, fontStyle: 'italic', fontSize: 13, lineHeight: 1.5, color: C.dim, marginTop: 12 };
const plateLabel: React.CSSProperties = { position: 'absolute', left: 14, bottom: 12, fontFamily: F.mono, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.gold };
const briefK: React.CSSProperties = { fontFamily: F.ui, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.dim };
const briefV: React.CSSProperties = { fontFamily: F.body, fontSize: 15, color: C.ink, textAlign: 'right' };
const colophon: React.CSSProperties = { marginTop: 40, fontFamily: F.mono, fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim, lineHeight: 2 };

const EarthWaterFire: React.FC = () => {
  const [accent, setAccent] = useState<string>(ACCENTS[0]);
  useImmersiveChrome(accent);
  const rootRef = useReveals([]);
  const progress = useReadingProgress();

  return (
    <ImmersiveRoot rootRef={rootRef}>
      <Helmet><title>Earth, Water, Fire · Teajia</title></Helmet>
      <ImmersiveNav eyebrow="Conversations · N°03" progress={progress} />
      <AccentSwatches accent={accent} setAccent={setAccent} />

      <article style={{ position: 'relative', zIndex: 1 }}>
        {/* COVER */}
        <header style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,360px),1fr))', alignItems: 'stretch', borderBottom: '1px solid rgba(168,135,77,0.14)', minHeight: '90vh' }}>
          <div style={{ position: 'relative', order: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(36px,6vw,84px) clamp(24px,5vw,72px)' }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.34em', textTransform: 'uppercase', color: C.gold, marginBottom: 28 }}>Conversations over Tea</div>
            <h1 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(44px,6.6vw,88px)', lineHeight: 1.0, letterSpacing: '-0.015em', color: C.cream, margin: 0 }}>
              Earth, Water,<br /><span style={{ fontStyle: 'italic', color: C.gold }}>Fire</span>
            </h1>
            <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(16px,2vw,20px)', lineHeight: 1.5, color: C.taupe, margin: '26px 0 0', maxWidth: 440 }}>
              In a thousand-year-old porcelain town, a potter throws the vessels that tea is poured from — and lets the kiln have the final word.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 'clamp(30px,5vw,46px)', paddingTop: 24, borderTop: '1px solid rgba(168,135,77,0.16)' }}>
              <div>
                <div style={{ fontFamily: F.display, fontSize: 24, color: C.ink, lineHeight: 1 }}>Lín Yùzhēn <span style={{ fontFamily: F.cn, color: C.taupe, fontSize: 20 }}>林玉珍</span></div>
                <div style={{ fontFamily: F.ui, fontSize: 10.5, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim, marginTop: 8 }}>Porcelain potter · Jingdezhen, Jiangxi</div>
              </div>
            </div>
          </div>
          <div style={{ position: 'relative', order: 1, overflow: 'hidden', minHeight: '48vh', background: 'linear-gradient(155deg,#23252a 0%,#14100b 80%)' }}>
            <div aria-hidden="true" style={{ ...grainCss('0.8', 150), opacity: 0.08 }} />
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 32%, rgba(150,180,180,0.12), transparent 64%)' }} />
            <div aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontFamily: F.cn, fontWeight: 200, fontSize: 'min(38vw,300px)', lineHeight: 1, color: 'rgba(168,135,77,0.07)' }}>林</div>
            <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <g fill="none" stroke="rgba(168,135,77,0.32)" strokeWidth="1.1">
                <ellipse cx="200" cy="244" rx="92" ry="20" />
                <path d="M108 244 C108 196, 132 168, 200 166 C268 168, 292 196, 292 244" />
                <path d="M126 200 C150 188, 250 188, 274 200" stroke="rgba(168,135,77,0.2)" />
                <ellipse cx="200" cy="168" rx="68" ry="14" stroke="rgba(168,135,77,0.22)" />
              </g>
              <g stroke="rgba(150,180,180,0.18)" strokeWidth="1" fill="none">
                <ellipse cx="200" cy="244" rx="68" ry="14" />
                <ellipse cx="200" cy="244" rx="44" ry="9" />
              </g>
            </svg>
            <div style={{ position: 'absolute', left: 'clamp(18px,3vw,28px)', bottom: 'clamp(18px,3vw,26px)', fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim }}>Portrait — at the wheel</div>
          </div>
        </header>

        {/* STANDFIRST */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(56px,9vw,116px) 24px clamp(20px,4vw,44px)' }}>
          <p style={{ fontFamily: F.body, fontSize: 'clamp(18px,2.2vw,22px)', lineHeight: 1.74, color: C.ink, margin: 0 }}>
            <span style={{ float: 'left', fontFamily: F.display, fontWeight: 600, fontSize: '5em', lineHeight: 0.78, color: C.gold, margin: '8px 16px -4px 0' }}>J</span>
            ingdezhen has made porcelain for a thousand years; the kilns here have never truly gone cold. In a workshop off a lane stacked with drying bowls, Lín Yùzhēn sits at a wheel her grandmother used, opening a lump of grey clay into the beginnings of a gaiwan. She is forty-three. Her hands are pale with slip. She does not look up as we sit down.
          </p>
        </section>

        <Movement numeral="I" label="The Clay" items={movementI} />

        {/* PULL QUOTE */}
        <section data-reveal style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(50px,8vw,104px) 24px', textAlign: 'center' }}>
          <blockquote style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(28px,4.8vw,54px)', lineHeight: 1.18, color: C.cream, margin: '0 auto', maxWidth: 840 }}>
            “We do not make the colour. We make the conditions, and the fire decides.”
          </blockquote>
          <div aria-hidden="true" style={{ width: 40, height: 1, background: C.gold, opacity: 0.5, margin: '34px auto 0' }} />
        </section>

        {/* PHOTO ESSAY */}
        <section data-reveal style={{ padding: 'clamp(20px,4vw,40px) clamp(20px,5vw,56px) clamp(40px,6vw,72px)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))', gap: 'clamp(14px,2.4vw,26px)', maxWidth: 1180, margin: '0 auto' }}>
            {/* Plate I — wheel */}
            <figure style={{ margin: 0 }}>
              <div style={{ position: 'relative', aspectRatio: '4/5', border: '1px solid rgba(168,135,77,0.2)', borderRadius: 3, overflow: 'hidden', background: 'linear-gradient(160deg,#23252a,#120e09)' }}>
                <div aria-hidden="true" style={grainCss('0.8', 120)} />
                <svg viewBox="0 0 240 300" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  <g fill="none" stroke="rgba(150,180,180,0.3)" strokeWidth="1">
                    <circle cx="120" cy="170" r="70" /><circle cx="120" cy="170" r="48" /><circle cx="120" cy="170" r="26" />
                    <circle cx="120" cy="170" r="6" fill="rgba(168,135,77,0.5)" />
                  </g>
                </svg>
                <div style={plateLabel}>Plate I</div>
              </div>
              <figcaption style={cap}>The wheel, mid-turn — the gaiwan opening under her thumbs.</figcaption>
            </figure>
            {/* Plate II — drying bowls */}
            <figure style={{ margin: 0 }}>
              <div style={{ position: 'relative', aspectRatio: '4/5', border: '1px solid rgba(168,135,77,0.2)', borderRadius: 3, overflow: 'hidden', background: 'radial-gradient(ellipse 60% 50% at 50% 64%, rgba(120,150,150,0.2), transparent 65%), #1a1610' }}>
                <div aria-hidden="true" style={grainCss('0.85', 120)} />
                <svg viewBox="0 0 240 300" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  <g fill="none" stroke="rgba(168,135,77,0.3)" strokeWidth="1">
                    <path d="M70 150h100M80 150 C82 200, 96 220, 120 222 C144 220, 158 200, 160 150" />
                    <ellipse cx="120" cy="150" rx="50" ry="9" />
                  </g>
                </svg>
                <div style={plateLabel}>Plate II</div>
              </div>
              <figcaption style={cap}>Bowls drying in rows, waiting for the glaze and the fire.</figcaption>
            </figure>
            {/* Plate III — kiln mouth */}
            <figure style={{ margin: 0 }}>
              <div style={{ position: 'relative', aspectRatio: '4/5', border: '1px solid rgba(168,135,77,0.2)', borderRadius: 3, overflow: 'hidden', background: 'linear-gradient(160deg,#2a1c12,#120e09), radial-gradient(ellipse 70% 40% at 50% 80%, rgba(200,110,40,0.25), transparent 60%)' }}>
                <div aria-hidden="true" style={grainCss('0.8', 120)} />
                <div aria-hidden="true" style={{ position: 'absolute', left: '50%', bottom: '18%', transform: 'translateX(-50%)', width: '46%', aspectRatio: '1/1', borderRadius: '50%', background: 'radial-gradient(circle, rgba(220,130,50,0.5), transparent 68%)' }} />
                <div style={plateLabel}>Plate III</div>
              </div>
              <figcaption style={cap}>The kiln mouth at temperature — the moment colour is decided.</figcaption>
            </figure>
          </div>
        </section>

        <Movement numeral="II" label="The Fire" items={movementII} />

        {/* PULL QUOTE + FACT FILE */}
        <section data-reveal style={{ maxWidth: 1040, margin: '0 auto', padding: 'clamp(30px,5vw,56px) 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 'clamp(28px,5vw,56px)', alignItems: 'center' }}>
            <blockquote style={{ fontFamily: F.display, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(26px,3.6vw,42px)', lineHeight: 1.2, color: C.cream, margin: 0 }}>
              “A cup should disappear in use, and only be noticed in gratitude.”
            </blockquote>
            <div style={{ border: '1px solid rgba(168,135,77,0.2)', borderRadius: 4, background: 'linear-gradient(160deg,#1d1810,#15110b)', padding: 'clamp(24px,3vw,34px)' }}>
              <div style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: C.gold, marginBottom: 20 }}>In Brief</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                {[['Region', 'Jingdezhen, Jiangxi'], ['Craft', 'Porcelain · qingbai glaze'], ['Material', 'Gaoling (kaolin)']].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, paddingBottom: 13, borderBottom: '1px solid rgba(168,135,77,0.1)' }}>
                    <span style={briefK}>{k}</span><span style={briefV}>{v}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <span style={briefK}>Signature</span><span style={briefV}>Thin-walled gaiwan</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Movement numeral="III" label="The Vessel & the Tea" items={movementIII} />

        {/* THEIR VESSEL */}
        <section data-reveal style={{ maxWidth: 1040, margin: '0 auto', padding: 'clamp(30px,5vw,56px) 24px' }}>
          <div style={{ border: '1px solid rgba(168,135,77,0.18)', borderRadius: 4, background: 'linear-gradient(160deg,#1d1810,#15110b)', padding: 'clamp(24px,4vw,44px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 20, borderBottom: '1px solid rgba(168,135,77,0.12)', marginBottom: 28, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gold }}>The vessel she handed us</span>
              <span style={{ fontFamily: F.ui, fontSize: 10, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim }}>Qingbai gaiwan · 110ml</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: 'clamp(28px,5vw,56px)', alignItems: 'center' }}>
              <div style={{ position: 'relative', aspectRatio: '1/1', border: '1px solid rgba(168,135,77,0.16)', borderRadius: 3, overflow: 'hidden', background: 'radial-gradient(ellipse 70% 60% at 50% 38%, rgba(150,180,180,0.14), transparent 64%), linear-gradient(160deg,#20231f,#14100b)' }}>
                <svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  <g fill="none" stroke="rgba(150,180,180,0.4)" strokeWidth="1.2">
                    <ellipse cx="150" cy="120" rx="74" ry="16" />
                    <path d="M76 120 C80 182, 110 210, 150 212 C190 210, 220 182, 224 120" />
                    <ellipse cx="150" cy="96" rx="58" ry="13" stroke="rgba(168,135,77,0.4)" />
                    <path d="M104 250 C120 238, 180 238, 196 250" stroke="rgba(168,135,77,0.3)" />
                  </g>
                </svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[['Walls', 'Eggshell-thin, translucent'], ['Glaze', 'Qingbai, pooled pale blue'], ['In the hand', 'Light, balanced, warm']].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '13px 0', borderBottom: '1px solid rgba(168,135,77,0.1)' }}>
                    <span style={{ fontFamily: F.ui, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.dim }}>{k}</span>
                    <span style={{ fontFamily: F.body, fontSize: 15, color: C.ink }}>{v}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '13px 0' }}>
                  <span style={{ fontFamily: F.ui, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.dim }}>Best for</span>
                  <span style={{ fontFamily: F.body, fontSize: 15, color: C.ink }}>Green &amp; light oolong</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CLOSING */}
        <section data-reveal style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(40px,6vw,72px) 24px' }}>
          <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 'clamp(17px,2.1vw,20px)', lineHeight: 1.72, color: C.taupe, margin: 0 }}>
            She fires next week — three hundred pieces, and the quiet violence of the kiln. Some will not survive. Lín Yùzhēn has made her peace with that. The fire, she says, has better taste than she does; she has only learned to trust it.
          </p>
          <div style={colophon}>Interview by Teajia &nbsp;·&nbsp; Conversations over Tea &nbsp;·&nbsp; N°03</div>
        </section>

        <MoreFooter links={moreLinks} />
      </article>
    </ImmersiveRoot>
  );
};

export default EarthWaterFire;
