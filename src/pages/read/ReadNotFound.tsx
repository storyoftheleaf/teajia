/**
 * @color-literals. The Read section is one always-dark editorial surface.
 * Rationale, and the conditions on this exception, in read/immersive.tsx.
 */
/**
 * ReadNotFound: what a visitor sees at a draft article's own URL.
 *
 * The site's `*` route shows a plain not-found page on parchment; that page
 * cannot be reused here, it is inline JSX in App.tsx built for the light
 * BROWSE surface and it calls back into App.tsx's own navigation state. This
 * is the same message, styled for the Read section's dark surface instead, so
 * the page still looks like the article shell around it rather than a broken
 * flash of daylight. Same words: not found, may have moved, a way back.
 *
 * Rendered by `ArticleGate` in App.tsx whenever a route's `publishGate.ts`
 * entry says the visitor may not see it yet.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  C, F, ImmersiveRoot, ImmersiveNav, useImmersiveChrome, ACCENTS,
} from './immersive';

const ReadNotFound: React.FC = () => {
  useImmersiveChrome(ACCENTS[0]);

  return (
    <ImmersiveRoot>
      <Helmet><title>Not found · Teajia</title></Helmet>
      <ImmersiveNav eyebrow="The Art of Tea" progress={0} />
      <div
        style={{
          minHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 24px',
        }}
      >
        <p style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.gold, marginBottom: 18 }}>
          Not found
        </p>
        <h1 style={{ fontFamily: F.display, fontWeight: 400, fontSize: 'clamp(32px,5vw,52px)', color: C.cream, margin: '0 0 16px' }}>
          Page not found
        </h1>
        <p style={{ fontFamily: F.body, fontStyle: 'italic', fontSize: 16, lineHeight: 1.6, color: C.taupe, maxWidth: 420, margin: '0 0 28px' }}>
          The page you are looking for does not exist or may have been moved.
        </p>
        <Link
          to="/read"
          style={{
            fontFamily: F.ui,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: C.gold,
            textDecoration: 'none',
            borderBottom: `1px solid ${C.gold}`,
            paddingBottom: 2,
          }}
        >
          Back to the reading room
        </Link>
      </div>
    </ImmersiveRoot>
  );
};

export default ReadNotFound;
