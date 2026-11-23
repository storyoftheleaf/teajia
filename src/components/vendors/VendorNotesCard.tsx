import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '../shared/Button';
import { InlineField } from './InlineField';
import { structureVendorNotes } from './vendorNotes';
import { useVendorSave } from './useVendorSave';

/**
 * Notes on a vendor, one thought per line with any label set apart, and
 * editable as plain text. The text is stored exactly as typed.
 */
export const VendorNotesCard: React.FC<{ vendorId: string; notes?: string | null }> = ({ vendorId, notes }) => {
  const save = useVendorSave(vendorId);
  const [editing, setEditing] = useState(false);
  const lines = structureVendorNotes(notes);

  return (
    <section className="bg-tea-surface border border-tea-border rounded-xl p-4 sm:p-5" data-testid="vendor-notes">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="h3">Notes</h3>
        {!editing && (
          <Button type="button" variant="quiet" size="sm" onClick={() => setEditing(true)}
            icon={<Pencil size={14} strokeWidth={1.5} aria-hidden="true" />}>
            {lines.length ? 'Edit' : 'Add notes'}
          </Button>
        )}
      </div>
      {editing ? (
        <InlineField
          label="Notes"
          multiline
          startEditing
          hideLabel
          onClose={() => setEditing(false)}
          value={notes}
          placeholder="One thought per line"
          onSave={next => save({ notes: next || null })}
        />
      ) : lines.length === 0 ? (
        <p className="text-ui-13 text-tea-text-sec">No notes yet.</p>
      ) : (
        <ul className="divide-y divide-tea-border">
          {lines.map((line, i) => (
            <li key={i} className="py-2 flex flex-wrap gap-x-3 gap-y-0.5 text-ui-14 leading-relaxed">
              {line.label && <span className="w-24 shrink-0 text-ui-12 pt-0.5 text-tea-text-sec">{line.label}</span>}
              <span className="min-w-0 flex-1 basis-48 break-words text-tea-text">{line.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
