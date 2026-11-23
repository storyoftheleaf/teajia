import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../shared/Button';
import { InlineField } from './InlineField';
import { VendorFace } from './VendorFace';
import { VendorFacePhotoButton } from './VendorFacePhotoButton';
import { vendorFacePhoto } from './vendorFaces';
import { useVendorSave } from './useVendorSave';
import type { ContactChannel, ContactEntry, Customer } from '../../admin/types';

/**
 * The top of a vendor's page: their face, and every detail Adrian keeps on
 * them, each one editable where it sits (tap, change, save).
 *
 * Contacts are the vendor's `contacts` list, the record every picker and the
 * invoice composer read. The old single email, phone and WhatsApp columns are
 * kept in step with the first contact of each kind.
 */

export type VendorRecord = Customer & { chinese_name?: string | null };

export const CONTACT_CHANNELS: Array<{ channel: ContactChannel; label: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'] }> = [
  { channel: 'wechat', label: 'WeChat' },
  { channel: 'whatsapp', label: 'WhatsApp', inputMode: 'tel' },
  { channel: 'phone', label: 'Phone', inputMode: 'tel' },
  { channel: 'email', label: 'Email', inputMode: 'email' },
  { channel: 'line', label: 'Line' },
  { channel: 'instagram', label: 'Instagram' },
  { channel: 'telegram', label: 'Telegram' },
  { channel: 'website', label: 'Website', inputMode: 'url' },
  { channel: 'other', label: 'Other' },
];
const channelLabel = (channel: string) => CONTACT_CHANNELS.find(c => c.channel === channel)?.label ?? channel;

/** The vendor's contacts, with the old flat columns folded in when the list has none of that kind. */
export function vendorContacts(vendor: Pick<Customer, 'contacts' | 'email' | 'phone' | 'whatsapp'>): ContactEntry[] {
  const list = Array.isArray(vendor.contacts) ? vendor.contacts.filter(c => c && c.handle) : [];
  const legacy: ContactEntry[] = [];
  const has = (channel: ContactChannel) => list.some(c => c.channel === channel);
  if (vendor.whatsapp && !has('whatsapp')) legacy.push({ channel: 'whatsapp', handle: vendor.whatsapp });
  if (vendor.phone && !has('phone')) legacy.push({ channel: 'phone', handle: vendor.phone });
  if (vendor.email && !has('email')) legacy.push({ channel: 'email', handle: vendor.email });
  return [...list, ...legacy];
}

/** The save for a new contacts list: the list itself, and the flat columns kept in step. */
export function contactsPatch(contacts: ContactEntry[]): Record<string, unknown> {
  const first = (channel: ContactChannel) => contacts.find(c => c.channel === channel)?.handle || null;
  return { contacts, email: first('email'), phone: first('phone'), whatsapp: first('whatsapp') };
}

export const VendorDetailsCard: React.FC<{ vendor: VendorRecord; vendorId: string }> = ({ vendor, vendorId }) => {
  const save = useVendorSave(vendorId);
  const contacts = vendorContacts(vendor);
  const [adding, setAdding] = useState(false);
  const [newChannel, setNewChannel] = useState<ContactChannel>('wechat');
  const [newHandle, setNewHandle] = useState('');
  const [contactError, setContactError] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  const saveContacts = async (next: ContactEntry[]) => save(contactsPatch(next));
  const addContact = async () => {
    const handle = newHandle.trim();
    if (!handle) { setContactError('Type the handle or number first.'); return; }
    setSavingContact(true);
    setContactError('');
    try {
      await saveContacts([...contacts, { channel: newChannel, handle }]);
      setNewHandle('');
      setAdding(false);
    } catch {
      setContactError("That didn't save. Try again.");
    } finally {
      setSavingContact(false);
    }
  };
  const removeContact = async (index: number) => {
    setContactError('');
    try { await saveContacts(contacts.filter((_, i) => i !== index)); }
    catch { setContactError("That didn't save. Try again."); }
  };

  return (
    <section className="bg-tea-surface border border-tea-border rounded-xl p-4 sm:p-5 space-y-5" data-testid="vendor-details">
      <div className="flex items-start gap-4">
        <div className="w-24 sm:w-28 shrink-0">
          <VendorFace name={vendor.name} photo={vendorFacePhoto(vendor)} shape="tile" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <h2 className="h3 break-words">{vendor.name}</h2>
          {(vendor.company || vendor.city || vendor.country) && (
            <p className="text-ui-13 text-tea-text-sec break-words">
              {[vendor.company, [vendor.city, vendor.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
            </p>
          )}
          <VendorFacePhotoButton vendorId={vendorId} vendorName={vendor.name} hasFace={!!vendor.face_photo} />
        </div>
      </div>

      <div>
        <h3 className="type-label text-tea-text-sec mb-1">Details</h3>
        <div className="divide-y divide-tea-border">
          <InlineField label="Name" required value={vendor.name}
            onSave={name => save({ name, expected_old_name: vendor.name })} />
          <InlineField label="Chinese name" value={vendor.chinese_name} onSave={v => save({ chinese_name: v || null })} />
          <InlineField label="Shop" value={vendor.company} onSave={v => save({ company: v || null })} />
          <InlineField label="Address" value={vendor.address} onSave={v => save({ address: v || null })} />
          <InlineField label="City" value={vendor.city} onSave={v => save({ city: v || null })} />
          <InlineField label="Country" value={vendor.country} onSave={v => save({ country: v || null })} />
        </div>
      </div>

      <div>
        <h3 className="type-label text-tea-text-sec mb-1">Contacts</h3>
        <ul className="divide-y divide-tea-border">
          {contacts.map((contact, index) => {
            const meta = CONTACT_CHANNELS.find(c => c.channel === contact.channel);
            return (
              <li key={`${contact.channel}:${index}`} className="flex items-start gap-1">
                <div className="min-w-0 flex-1">
                  <InlineField
                    label={contact.label ? `${channelLabel(contact.channel)} (${contact.label})` : channelLabel(contact.channel)}
                    value={contact.handle}
                    required
                    inputMode={meta?.inputMode}
                    onSave={handle => saveContacts(contacts.map((c, i) => i === index ? { ...c, handle } : c))}
                  />
                </div>
                <Button
                  type="button"
                  variant="icon"
                  onClick={() => void removeContact(index)}
                  aria-label={`Remove ${channelLabel(contact.channel)} ${contact.handle}`}
                  className="tap-target mt-1 shrink-0"
                  icon={<X size={14} strokeWidth={1.5} aria-hidden="true" />}
                />
              </li>
            );
          })}
        </ul>
        {contacts.length === 0 && !adding && <p className="py-2 text-ui-13 text-tea-text-sec">No contacts yet.</p>}
        {adding ? (
          <div className="pt-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              <select
                value={newChannel}
                onChange={e => setNewChannel(e.target.value as ContactChannel)}
                aria-label="Contact type"
                className="input-field min-h-tap px-3 py-2 text-ui-16"
              >
                {CONTACT_CHANNELS.map(c => <option key={c.channel} value={c.channel}>{c.label}</option>)}
              </select>
              <input
                value={newHandle}
                onChange={e => setNewHandle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); void addContact(); }
                  if (e.key === 'Escape') { setAdding(false); setNewHandle(''); }
                }}
                aria-label="Handle or number"
                placeholder="Handle or number"
                inputMode={CONTACT_CHANNELS.find(c => c.channel === newChannel)?.inputMode}
                autoComplete="off"
                autoFocus
                className="input-field min-h-tap min-w-0 flex-1 basis-48 px-3 py-2 text-ui-16"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="quiet" size="sm" onClick={() => { setAdding(false); setNewHandle(''); setContactError(''); }}>Cancel</Button>
              <Button type="button" variant="primary" size="sm" loading={savingContact} onClick={() => void addContact()}>Add</Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="quiet" size="sm" className="mt-2" icon={<Plus size={14} strokeWidth={1.5} aria-hidden="true" />} onClick={() => setAdding(true)}>
            Add contact
          </Button>
        )}
        {contactError && <p role="alert" className="mt-1 text-ui-12 text-tea-error">{contactError}</p>}
      </div>
    </section>
  );
};
