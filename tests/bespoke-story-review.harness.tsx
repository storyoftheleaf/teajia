import React from 'react';
import { createRoot } from 'react-dom/client';
import { useAppStore } from '../src/lib/store';
import { EditableText, StoryEditProvider } from '../src/pages/read/storyEdit';
import StoryEditorBar from '../src/pages/read/StoryEditorBar';

useAppStore.getState().setDevAdmin(true);
createRoot(document.getElementById('root')!).render(
  <StoryEditProvider slug="porcelain-and-tea">
    <EditableText as="h1" field="title-1">Fixture title</EditableText>
    <StoryEditorBar />
  </StoryEditProvider>,
);
