import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TeaCompassEntry } from './types';
import { LibraryInlineValue } from './LibraryInlineValue';

/** The same encounter keeps its chosen name before and after inventory handoff. */
export function LibraryGivenName({ entry, onSave, readOnly = false }: {
  entry: Pick<TeaCompassEntry, 'givenName' | 'draftProductId'> & { name?: string };
  onSave: (value: string) => Promise<void>;
  readOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  if (readOnly && !entry.givenName) return null;
  return <LibraryInlineValue
    value={entry.givenName ?? ''}
    display={!readOnly && entry.givenName?.trim() && entry.givenName.trim() === entry.name?.trim() ? 'Name of the tea' : entry.givenName || 'Name of the tea'}
    label="Given name"
    className="library-given-name text-ui-12 text-tea-text-sec"
    readOnly={readOnly}
    onSave={async value => {
      await onSave(value);
      // The product may carry the backlink before this entry has a forward ID.
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    }}
  />;
}
