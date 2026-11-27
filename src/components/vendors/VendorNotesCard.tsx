import React, { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '../shared/Button';
import { InlineField } from './InlineField';
import { contactsInNotes, structureVendorNotes, type NoteContact } from './vendorNotes';
import { useVendorSave } from './useVendorSave';
import { contactsPatch } from './VendorDetailsCard';
import type { ContactEntry } from '../../admin/types';

/**
 * Notes on a vendor, one thought per line with any label set apart, and
 * editable as plain text. The text is stored exactly as typed.
 *
 * A note often holds a handle that belongs in contacts (Huang Wei's
 * "WeChat Weeee36" was written into his note when he was added, and his
 * contacts stayed empty). Each such handle gets one tap to add it to
 * contacts; the note itself is left as it is.
 */
export const VendorNotesCard: React.FC<{ vendorId: string; notes?: string | null; contacts?: ContactEntry[] }> = ({ vendorId, notes, contacts = [] }) => {
  const save = useVendorSave(vendorId);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [addError, setAddError] = useState('');
  const lines = structureVendorNotes(notes);
  const offers = contactsInNotes(notes, contacts);
  const addContact = async (offer: NoteContact) => {
    setAdding(offer.channel);
    setAddError('');
    try { await save(contactsPatch([...contacts, { channel: offer.channel, handle: offer.handle }])); }
    catch { setAddError("That didn't save. Try again."); }
    finally { setAdding(null); }
  };

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
      {!editing && offers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" data-testid="vendor-note-contacts">
          {offers.map(offer => (
            <Button key={offer.channel} type="button" variant="secondary" size="sm" loading={adding === offer.channel}
              onClick={() => void addContact(offer)}
              icon={<Plus size={14} strokeWidth={1.5} aria-hidden="true" />}>
              Add {offer.label} {offer.handle} to contacts
            </Button>
          ))}
        </div>
      )}
      {addError && <p role="alert" className="mt-1 text-ui-12 text-tea-error">{addError}</p>}
    </section>
  );
};
