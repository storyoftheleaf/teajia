import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ENTRIES } from '../../scripts/manage-archive/data';
import { BrowseCard } from '../../src/components/TeaCompass/BrowseCard';
import { CompassEntryDetailPanel } from '../../src/components/TeaCompass/CompassEntryDetailPanel';
import type { TeaCompassEntry } from '../../src/components/TeaCompass/types';
import { BottomSheet } from '../../src/components/shared/BottomSheet';
import { TastingSession } from '../../src/components/tasting/TastingSession';
import { toCamelCase } from '../../src/lib/teaCompassSync';
import type { TastingData } from '../../src/types';
import { TYPOGRAPHY_CLASSES as T } from '../../src/designTokens';
import '../../src/styles/tailwind.css';
import '../../src/styles/card-utilities.css';
import './style.css';

const cards = ENTRIES.slice(0, 3).map(toCamelCase);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function TeaUiReference() {
  const [light, setLight] = useState(false);
  const [detail, setDetail] = useState<TeaCompassEntry>();
  const [tasting, setTasting] = useState<TeaCompassEntry>();
  const [savedTastings, setSavedTastings] = useState<Record<string, TastingData>>({});

  function toggleTheme() {
    document.documentElement.classList.toggle('light', !light);
    document.documentElement.classList.toggle('dark', light);
    setLight(!light);
  }

  return (
    <>
      <main className="tea-ui-reference">
        <header>
          <h1 className={T.h2}>Tea UI reference</h1>
          <button type="button" className="tap-target text-ui-13 text-tea-text-sec" onClick={toggleTheme}>{light ? 'Dark mode' : 'Light mode'}</button>
        </header>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button type="button" className="cta-solid min-h-11 rounded-md px-4 text-ui-13" onClick={() => setTasting(cards[0])}>Open full tasting</button>
          <span className="text-ui-12 text-tea-text-sec">Preview saves stay on this page.</span>
        </div>
        <section aria-labelledby="reference-library">
          <h2 id="reference-library" className={T.h3}>Curate Library tea cards</h2>
          <p className="text-ui-13 text-tea-text-sec">Sample teas on the cards from Curate → Library. Tap a cup to taste that tea.</p>
          <div className="library-card-layout mt-3"><div className="library-card-grid">
            {cards.map(entry => <BrowseCard
              key={entry.id}
              entry={entry}
              readOnly
              onEdit={() => setDetail(entry)}
              onOpenTasting={() => setTasting(entry)}
              tastingRecorded={!!savedTastings[entry.id]}
              pricePreference={{ currency: 'source', basis: 'gram' }}
            />)}
          </div></div>
        </section>
      </main>
      <BottomSheet open={!!detail} onOpenChange={open => { if (!open) setDetail(undefined); }} title="Tea details" large className="library-details-sheet">
        {detail && <fieldset disabled>
          <CompassEntryDetailPanel embedded entryId={detail.id} previewEntry={detail} onClose={() => setDetail(undefined)} />
        </fieldset>}
      </BottomSheet>
      {tasting && <TastingSession
        previewOnly
        item={{ id: tasting.id, name: tasting.name, type: tasting.type, sourceType: 'compass' }}
        initialData={savedTastings[tasting.id]}
        onAfterSave={data => setSavedTastings(previous => ({ ...previous, [tasting.id]: data }))}
        onClose={() => setTasting(undefined)}
      />}
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <TeaUiReference />
    </QueryClientProvider>
  </BrowserRouter>,
);
