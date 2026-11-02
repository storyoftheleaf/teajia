import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TeaCompassEntry } from './types';
import { LibraryInlineValue } from './LibraryInlineValue';

/** The same encounter keeps its chosen name before and after inventory handoff. */
export function LibraryGivenName({ entry, onSave, readOnly = false, emptyLabel = 'Name of the tea', className = 'text-ui-12 text-tea-text-sec' }: {
  entry: Pick<TeaCompassEntry, 'givenName' | 'draftProductId'> & { name?: string };
  onSave: (value: string) => Promise<void>;
  readOnly?: boolean;
  /** What an unnamed tea shows; Curate v2's rows say "add" like every other blank. */
  emptyLabel?: string;
  className?: string;
}) {
  const queryClient = useQueryClient();
  if (readOnly && !entry.givenName) return null;
  return <LibraryInlineValue
    value={entry.givenName ?? ''}
    display={!readOnly && entry.givenName?.trim() && entry.givenName.trim() === entry.name?.trim() ? emptyLabel : entry.givenName || emptyLabel}
    label="Given name"
    className={`library-given-name ${className}`}
    readOnly={readOnly}
    onSave={async value => {
      await onSave(value);
      // The product may carry the backlink before this entry has a forward ID.
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    }}
  />;
}
