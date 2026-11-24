import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { CaptureCard as CaptureCardV2 } from '../CurateV2/CaptureCard';
import { CaptureCard } from './CaptureCard';
import type { ExtractedTeaData } from './PhotoCapture';
import { createEmptyEntry } from './types';

type PhotoActions = {
  onExtracted: (data: ExtractedTeaData) => void;
  onPhotoTaken: (url: string) => void;
  onPhotoReplaced: (before: string, after: string) => void;
};

const photoCapture = vi.hoisted(() => ({ actions: undefined as PhotoActions | undefined }));
vi.mock('./PhotoCapture', () => ({
  PhotoCapture: (actions: PhotoActions) => {
    photoCapture.actions = actions;
    return null;
  },
}));
vi.mock('../CurateV2/PhotoCapture', () => ({
  PhotoCapture: (actions: PhotoActions) => {
    photoCapture.actions = actions;
    return null;
  },
}));
vi.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));

const entryId = 'tea-with-photos';
function photoActions(Card = CaptureCard) {
  renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}>
    <Card entryId={entryId} />
  </QueryClientProvider>);
  if (!photoCapture.actions) throw new Error('Expected CaptureCard to render photo capture');
  return photoCapture.actions;
}

describe('Curate capture photo updates', () => {
  beforeEach(() => {
    photoCapture.actions = undefined;
    useTeaCompassStore.setState({ entries: [{ ...createEmptyEntry(), id: entryId, name: 'White tea', photos: ['/original.jpg'] }], pendingEntries: [] });
  });

  it('keeps both photos when two uploads finish from the same render', () => {
    const { onPhotoTaken } = photoActions();
    onPhotoTaken('/first-upload.jpg');
    onPhotoTaken('/second-upload.jpg');
    expect(useTeaCompassStore.getState().getEntry(entryId)?.photos).toEqual(['/original.jpg', '/first-upload.jpg', '/second-upload.jpg']);
  });

  it('keeps intervening uploads when an edited photo finishes saving', () => {
    const { onPhotoTaken, onPhotoReplaced } = photoActions();
    onPhotoTaken('/new-upload.jpg');
    onPhotoReplaced('/original.jpg', '/cropped.jpg');
    expect(useTeaCompassStore.getState().getEntry(entryId)?.photos).toEqual(['/cropped.jpg', '/new-upload.jpg']);
  });

  it.each([
    { version: 'legacy Curate', Card: CaptureCard, priceAmount: 120 },
    { version: 'legacy Curate', Card: CaptureCard, priceAmount: 0 },
    { version: 'Curate v2', Card: CaptureCardV2, priceAmount: 120 },
    { version: 'Curate v2', Card: CaptureCardV2, priceAmount: 0 },
  ])('preserves a price of $priceAmount and other edits during a $version scan', ({ Card, priceAmount }) => {
    useTeaCompassStore.getState().updateEntry(entryId, { name: '', notes: 'First note' });
    const { onExtracted } = photoActions(Card);
    useTeaCompassStore.getState().updateEntry(entryId, {
      name: 'Tea entered by hand',
      notes: 'Edited note',
      priceAmount,
    });

    onExtracted({
      name: 'Name from label',
      price: 65,
      grams: 40,
      extraNotes: 'Note from label',
    });

    expect(useTeaCompassStore.getState().getEntry(entryId)).toMatchObject({
      name: 'Tea entered by hand',
      notes: 'Edited note\nNote from label',
      priceAmount,
      pricePerUnitGrams: 40,
    });
  });
});
