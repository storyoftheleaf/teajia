import React, { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { SiteNotFound } from '../components/SiteNotFound';
import { EmblemLoader } from '../components/shared/EmblemLoader';
import AtlasHomePage from './pages/AtlasHomePage';
import AtlasIssuePage from './pages/AtlasIssuePage';
import AtlasReaderPage from './pages/AtlasReaderPage';
import AtlasSearchPage from './pages/AtlasSearchPage';
import AtlasSourcePage from './pages/AtlasSourcePage';
import AtlasTopicPage from './pages/AtlasTopicPage';

// The Tea Atlas reader, loaded only after the server has said this person may
// read it (AtlasGate). Routes are relative to /atlas (old /tea-atlas links forward); docs/TEA_ATLAS.md.
// "Add a source" is its own chunk (it carries pdf.js), fetched only by the
// person who opens it; the server decides whether that person may use it.
const AtlasAddSourcePage = lazy(() => import('./pages/AtlasAddSourcePage'));
export default function AtlasApp() {
  return (
    <Routes>
      <Route index element={<AtlasHomePage />} />
      <Route path="source/:sourceId" element={<AtlasSourcePage />} />
      <Route path="issue/:issueId" element={<AtlasIssuePage />} />
      <Route path="read/:articleId" element={<AtlasReaderPage />} />
      <Route path="topic/:topicId" element={<AtlasTopicPage />} />
      <Route path="search" element={<AtlasSearchPage />} />
      <Route path="add" element={<Suspense fallback={<EmblemLoader />}><AtlasAddSourcePage /></Suspense>} />
      <Route path="*" element={<SiteNotFound />} />
    </Routes>
  );
}
