import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  WisdomIndexVisibilityNotice,
  buildWisdomCollectionData,
  filterPublicWisdomEntries,
  type PublicWisdomNodeState,
} from './publicIndexVisibility';

const states: PublicWisdomNodeState[] = [
  { node_type: 'cultivar', node_id: 'hidden', public_state: 'hidden', is_public: false },
  { node_type: 'cultivar', node_id: 'withheld', public_state: 'inherit', is_public: false },
  { node_type: 'cultivar', node_id: 'shown', public_state: 'public', is_public: true },
  // Node ids are typed. Hiding a mark named "shared" must not hide a cultivar
  // with the same id.
  { node_type: 'mark', node_id: 'shared', public_state: 'hidden', is_public: false },
];

describe('public Wisdom index visibility', () => {
  it('removes only withheld nodes of the requested type', () => {
    const entries = [
      { id: 'hidden', name: 'Hidden plant' },
      { id: 'withheld', name: 'Withheld plant' },
      { id: 'shown', name: 'Shown plant' },
      { id: 'shared', name: 'Shared id plant' },
      { id: 'unlisted', name: 'Inherited plant' },
    ];

    expect(filterPublicWisdomEntries('cultivar', entries, states).map(entry => entry.id)).toEqual([
      'shown',
      'shared',
      'unlisted',
    ]);
  });

  it('builds JSON-LD only from the filtered entries with contiguous positions', () => {
    const entries = [
      { id: 'shown', name: 'Shown plant' },
      { id: 'unlisted', name: 'Inherited plant' },
    ];
    const data = buildWisdomCollectionData({
      name: 'The Tea Plants',
      description: 'Public plants.',
      entries,
      pathFor: entry => `/wisdom/cultivar/${entry.id}`,
    });

    expect(data.mainEntity.numberOfItems).toBe(2);
    expect(data.mainEntity.itemListElement).toEqual([
      expect.objectContaining({ position: 1, name: 'Shown plant', url: '/wisdom/cultivar/shown' }),
      expect.objectContaining({ position: 2, name: 'Inherited plant', url: '/wisdom/cultivar/unlisted' }),
    ]);
  });

  it('withholds the index while checking and offers a retry after an error', () => {
    const retry = vi.fn();
    expect(renderToString(<WisdomIndexVisibilityNotice status="loading" onRetry={retry} />)).toContain(
      'aria-label="Wisdom index loading"',
    );
    const error = renderToString(<WisdomIndexVisibilityNotice status="error" onRetry={retry} />);
    expect(error).toContain('Wisdom index cannot be checked');
    expect(error).toContain('Try again');
  });
});
