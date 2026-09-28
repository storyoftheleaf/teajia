import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { SiteNotFound } from '../components/SiteNotFound';
import AtlasHomePage from './pages/AtlasHomePage';
import AtlasIssuePage from './pages/AtlasIssuePage';
import AtlasReaderPage from './pages/AtlasReaderPage';
import AtlasSearchPage from './pages/AtlasSearchPage';
import AtlasSourcePage from './pages/AtlasSourcePage';
import AtlasTopicPage from './pages/AtlasTopicPage';

// The Tea Atlas reader, loaded only after the server has said this person may
// read it (AtlasGate). Routes are relative to /tea-atlas; docs/TEA_ATLAS.md.
export default function AtlasApp() {
  return (
    <Routes>
      <Route index element={<AtlasHomePage />} />
      <Route path="source/:sourceId" element={<AtlasSourcePage />} />
      <Route path="issue/:issueId" element={<AtlasIssuePage />} />
      <Route path="read/:articleId" element={<AtlasReaderPage />} />
      <Route path="topic/:topicId" element={<AtlasTopicPage />} />
      <Route path="search" element={<AtlasSearchPage />} />
      <Route path="*" element={<SiteNotFound />} />
    </Routes>
  );
}
