import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { CONTACT_CHANNELS, readVendorStructuredPatch, type VendorAddress, type VendorContactEndpoint, type VendorContactPerson, type VendorStructuredFields } from '../../lib/curateStructuredFields';

const inputClass = 'input-field min-h-11 min-w-0 px-3 py-2 text-ui-16';
const buttonClass = 'tap-target min-h-11 px-3 py-2 text-ui-12 text-tea-text-sec hover:text-tea-text';
type Draft = { vendor_code: string; contact_people: VendorContactPerson[]; addresses: VendorAddress[]; contacts: VendorContactEndpoint[] };
const field = (label: string, value: string, set: (value: string) => void) => <label className="block min-w-0 space-y-1">
  <span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>{label}</span>
  <input className={inputClass} value={value} onChange={event => set(event.target.value)} />
</label>;
const trimOptional = <T extends Record<string, unknown>>(row: T): T => Object.fromEntries(Object.entries(row)
  .filter(([key, value]) => !['title', 'city', 'region', 'postal_code', 'country', 'label', 'person_id'].includes(key) || value !== '')
  .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])) as T;

export function vendorFieldsPayload(draft: Draft): VendorStructuredFields {
  return readVendorStructuredPatch({ contacts_mode: 'replace', vendor_code: draft.vendor_code.trim() || null,
    contact_people: draft.contact_people.map(person => { const { title, ...required } = person; return { ...required, ...(title?.trim() ? { title: title.trim() } : {}) }; }),
    addresses: draft.addresses.map(address => trimOptional(address as unknown as Record<string, unknown>)),
    contacts: draft.contacts.map(contact => trimOptional(contact as unknown as Record<string, unknown>)),
  });
}

/** The canonical vendor profile is loaded before editing, so old endpoints
 * remain present unless the operator explicitly removes them. */
export function CurateVendorFields({ vendorId }: { vendorId: string }) {
  const account = useAppStore(state => state.activeAccountId);
  const request = useRef(0);
  const savingRef = useRef(false);
  const editRevision = useRef(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const generation = ++request.current;
    setDraft(null); setError(''); setSaved(false); setSaving(false);
    api.curateWorkspace.vendor(vendorId).then(profile => {
      if (generation !== request.current || useAppStore.getState().activeAccountId !== account) return;
      setDraft({ vendor_code: profile.vendor_code ?? '', contact_people: profile.contact_people ?? [], addresses: profile.addresses ?? [], contacts: profile.contacts ?? [] });
    }).catch(() => { if (generation === request.current) setError('Vendor details could not be loaded. Retry before editing.'); });
    return () => { ++request.current; };
  }, [vendorId, account, retry]);
  const change = (patch: Partial<Draft>) => { ++editRevision.current; setDraft(current => current ? { ...current, ...patch } : current); setSaved(false); };
  const save = async () => {
    if (!draft || savingRef.current || useAppStore.getState().activeAccountId !== account) return;
    savingRef.current = true;
    const generation = request.current;
    const sentEditRevision = editRevision.current;
    setError(''); setSaving(true);
    try {
      const patch = vendorFieldsPayload(draft);
      await api.curateWorkspace.saveVendor(vendorId, { ...patch });
      if (generation === request.current && useAppStore.getState().activeAccountId === account) setSaved(editRevision.current === sentEditRevision);
    } catch {
      if (generation === request.current) setError('Could not confirm the save. Check each person’s name, address and contact value, then retry to confirm.');
    } finally { savingRef.current = false; if (generation === request.current) setSaving(false); }
  };
  return <details className="border-t border-tea-border pt-3" data-testid="curate-vendor-fields">
    <summary className={`${TYPOGRAPHY_CLASSES.label} cursor-pointer min-h-11 text-tea-text-sec`}>Vendor people &amp; addresses</summary>
    {error && <p role="alert" className="text-ui-12 text-tea-text-sec">{error}</p>}
    {!draft && error && <button type="button" className={buttonClass} onClick={() => setRetry(value => value + 1)}>Retry vendor details</button>}
    {!draft ? <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text-sec`}>Loading vendor details</p> : <div className="space-y-5 pb-3">
      {field('Vendor code', draft.vendor_code, value => change({ vendor_code: value }))}
      <div className="space-y-3">
        <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Contact people</p>
        {draft.contact_people.map((person, index) => <div className="space-y-2 border-b border-tea-border pb-3" key={person.id}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {field(`Person ${index + 1} name`, person.name, name => change({ contact_people: draft.contact_people.map(row => row.id === person.id ? { ...row, name } : row) }))}
            {field(`Person ${index + 1} title`, person.title ?? '', title => change({ contact_people: draft.contact_people.map(row => row.id === person.id ? { ...row, title } : row) }))}
          </div>
          <button type="button" className={buttonClass} onClick={() => change({ contact_people: draft.contact_people.filter(row => row.id !== person.id), contacts: draft.contacts.map(contact => contact.person_id === person.id ? { ...contact, person_id: undefined } : contact) })}>Remove person {index + 1}</button>
        </div>)}
        <button type="button" className={buttonClass} onClick={() => change({ contact_people: [...draft.contact_people, { id: crypto.randomUUID(), name: '' }] })}>Add contact person</button>
      </div>
      <div className="space-y-3">
        <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Contact channels</p>
        {draft.contacts.map((contact, index) => {
          const update = (patch: Partial<VendorContactEndpoint>) => change({ contacts: draft.contacts.map((row, position) => position === index ? { ...row, ...patch } : row) });
          return <div key={contact.id ?? index} className="space-y-2 border-b border-tea-border pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block space-y-1"><span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Contact {index + 1} channel</span>
                <select className={inputClass} aria-label={`Contact ${index + 1} channel`} value={contact.channel} onChange={event => update({ channel: event.target.value })}>
                  <option value="">Choose</option>{CONTACT_CHANNELS.map(channel => <option value={channel} key={channel}>{channel}</option>)}
                </select>
              </label>
              {field(`Contact ${index + 1} value`, contact.handle, handle => update({ handle }))}
              {field(`Contact ${index + 1} label`, contact.label ?? '', label => update({ label }))}
              <label className="block space-y-1"><span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Contact {index + 1} person</span>
                <select className={inputClass} aria-label={`Contact ${index + 1} person`} value={contact.person_id ?? ''} onChange={event => update({ person_id: event.target.value })}>
                  <option value="">Company contact</option>{draft.contact_people.map(person => <option value={person.id} key={person.id}>{person.name || 'Unnamed person'}</option>)}
                </select>
              </label>
            </div>
            <button type="button" className={buttonClass} onClick={() => change({ contacts: draft.contacts.filter((_, position) => position !== index) })}>Remove contact {index + 1}</button>
          </div>;
        })}
        <button type="button" className={buttonClass} onClick={() => change({ contacts: [...draft.contacts, { id: crypto.randomUUID(), channel: '', handle: '' }] })}>Add contact channel</button>
      </div>
      <div className="space-y-3">
        <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Addresses</p>
        {draft.addresses.map((address, index) => {
          const update = (patch: Partial<VendorAddress>) => change({ addresses: draft.addresses.map(row => row.id === address.id ? { ...row, ...patch } : row) });
          return <div key={address.id} className="space-y-2 border-b border-tea-border pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {field(`Address ${index + 1} label`, address.label, label => update({ label }))}
              {field(`Address ${index + 1} address`, address.address, value => update({ address: value }))}
              {field(`Address ${index + 1} city`, address.city ?? '', city => update({ city }))}
              {field(`Address ${index + 1} region`, address.region ?? '', region => update({ region }))}
              {field(`Address ${index + 1} postal code`, address.postal_code ?? '', postal_code => update({ postal_code }))}
              {field(`Address ${index + 1} country`, address.country ?? '', country => update({ country }))}
            </div>
            <button type="button" className={buttonClass} onClick={() => change({ addresses: draft.addresses.filter(row => row.id !== address.id) })}>Remove address {index + 1}</button>
          </div>;
        })}
        <button type="button" className={buttonClass} onClick={() => change({ addresses: [...draft.addresses, { id: crypto.randomUUID(), label: '', address: '' }] })}>Add address</button>
      </div>
      {saved && <p role="status" className="text-ui-12 text-tea-text-sec">Vendor details saved</p>}
      <button type="button" className={`${buttonClass} text-tea-gold`} disabled={saving} onClick={() => { void save(); }}>{saving ? 'Saving vendor details' : 'Save vendor details'}</button>
    </div>}
  </details>;
}
