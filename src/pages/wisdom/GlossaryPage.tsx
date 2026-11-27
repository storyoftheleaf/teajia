/**
 * /wisdom/glossary. The glossary of tea terms, inside the one Wisdom Base.
 *
 * It lived in Craft until Craft was removed (Adrian, 2026-11-27). The terms
 * themselves are unchanged and still come from src/data/glossary.ts through
 * TeaGlossary; only their address and frame moved. Old /craft?v=glossary
 * links land here (src/pages/CraftMoved.tsx).
 */
import React from 'react';
import { Helmet } from 'react-helmet-async';
import { ReadShelves } from '../../components/shared/ReadShelves';
import { TeaGlossary } from '../../components/TeaGlossary';
import { PAGE, PageHead, SPACE, WisdomSubNav } from './wisdomShared';

const GlossaryPage: React.FC = () => (
  <article className={PAGE}>
    <Helmet>
      <title>Glossary · The Tea Wisdom Base · Teajia</title>
      <meta name="description" content="The language of tea, one word at a time: terms, characters and their meanings." />
    </Helmet>
    <ReadShelves here="wisdom" />
    <WisdomSubNav active="glossary" />
    <div className="mt-7">
      <PageHead kind="The reference" title="Glossary" note="Terms, characters and their meanings." />
    </div>
    <div className={SPACE.section}>
      <TeaGlossary isFullView hideHeader />
    </div>
  </article>
);

export default GlossaryPage;
