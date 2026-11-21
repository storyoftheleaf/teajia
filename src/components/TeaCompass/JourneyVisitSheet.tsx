import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { CurateJourney, CurateVisit } from './types';
import { BottomSheet } from '../shared/BottomSheet';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { Button } from '../shared/Button';

interface Props {
  open: boolean;
  inline?: boolean;
  defaultVendorId?: string;
  journeyId?: string | null;
  visitId?: string | null;
  onOpenChange: (open: boolean) => void;
  onApply: (journeyId: string | null, visitId: string | null) => void;
  onLoaded?: (journeys: CurateJourney[], visits: CurateVisit[]) => void;
}

type Editor = { kind: 'journey'; item?: CurateJourney } | { kind: 'visit'; item?: CurateVisit } | null;
const inputClass = 'min-h-tap w-full rounded-md border border-tea-border bg-tea-surface px-3 text-ui-14 text-tea-text focus:border-tea-gold focus:outline-none';

export function normalizeCustomerTags(tags: unknown): string[] {
  let value = tags;
  if (typeof tags === 'string') {
    try { value = JSON.parse(tags); } catch { return []; }
  }
  if (!Array.isArray(value)) return [];
  return value.filter((tag): tag is string => typeof tag === 'string');
}

export const JourneyVisitSheet: React.FC<Props> = ({ open, journeyId, visitId, onOpenChange, onApply, onLoaded, inline = false, defaultVendorId }) => {
  const [journeys, setJourneys] = useState<CurateJourney[]>([]);
  const [visits, setVisits] = useState<CurateVisit[]>([]);
  const [vendors, setVendors] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedJourney, setSelectedJourney] = useState<string | null>(journeyId ?? null);
  const [selectedVisit, setSelectedVisit] = useState<string | null>(visitId ?? null);
  const [editor, setEditor] = useState<Editor>(null);
  const [name, setName] = useState('');
  const [season, setSeason] = useState('');
  const [year, setYear] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [place, setPlace] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const publish = (nextJourneys: CurateJourney[], nextVisits: CurateVisit[]) => {
    setJourneys(nextJourneys); setVisits(nextVisits); onLoaded?.(nextJourneys, nextVisits);
  };
  useEffect(() => {
    if (!open) return;
    setSelectedJourney(journeyId ?? null); setSelectedVisit(visitId ?? null); setEditor(null);
    setLoading(true); setError(null);
    let active = true;
    Promise.all([api.curateContext.listJourneys(), api.curateContext.listVisits(), api.customers.list()])
      .then(([j, v, customers]) => {
        if (!active) return;
        publish(j.journeys, v.visits);
        const rows = Array.isArray(customers) ? customers : customers.customers ?? [];
        setVendors(rows.filter((row: any) => normalizeCustomerTags(row.tags).includes('vendor')).map((row: any) => ({ id: row.id, name: row.name })));
        setLoading(false);
      }).catch(() => { if (active) { setLoading(false); setError('Could not load context. Check the connection and retry.'); } });
    return () => { active = false; };
  }, [open, journeyId, visitId, reloadToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const openJourneyEditor = (item?: CurateJourney) => {
    setEditor({ kind: 'journey', item }); setName(item?.name ?? ''); setSeason(item?.season ?? ''); setYear(item?.year ? String(item.year) : '');
  };
  const openVisitEditor = (item?: CurateVisit) => {
    setEditor({ kind: 'visit', item }); setVendorId(item?.vendor_id ?? defaultVendorId ?? ''); setPlace(item?.place ?? '');
    if (item) setSelectedJourney(item.journey_id ?? null);
  };
  const saveJourney = async () => {
    if (!name.trim() || pendingAction) return;
    setPendingAction(true); setError(null);
    const payload = { name: name.trim(), season: season.trim() || null, year: year ? Number(year) : null };
    try { const saved = editor?.kind === 'journey' && editor.item ? await api.curateContext.updateJourney(editor.item.id, payload) : await api.curateContext.createJourney(payload);
      const next = editor?.kind === 'journey' && editor.item ? journeys.map(j => j.id === saved.id ? saved : j) : [...journeys, saved]; publish(next, visits); setSelectedJourney(saved.id); setEditor(null);
    } catch { setError('Could not save the trip. Your form is preserved; retry when ready.'); } finally { setPendingAction(false); }
  };
  const saveVisit = async () => {
    if (pendingAction) return;
    setPendingAction(true); setError(null);
    const payload = { journey_id: selectedJourney, vendor_id: vendorId || null, place: place.trim() || null };
    try { const saved = editor?.kind === 'visit' && editor.item ? await api.curateContext.updateVisit(editor.item.id, payload) : await api.curateContext.createVisit(payload);
      const next = editor?.kind === 'visit' && editor.item ? visits.map(v => v.id === saved.id ? saved : v) : [...visits, saved]; publish(journeys, next); setSelectedVisit(saved.id); setSelectedJourney(saved.journey_id ?? null); setEditor(null);
    } catch { setError('Could not save the visit. Your form is preserved; retry when ready.'); } finally { setPendingAction(false); }
  };
  const deleteJourney = async (item: CurateJourney) => {
    if (pendingAction) return; setPendingAction(true); setError(null);
    try { await api.curateContext.deleteJourney(item.id);
    useTeaCompassStore.getState().clearJourneyReferences(item.id);
    const nextVisits = visits.map(v => v.journey_id === item.id ? { ...v, journey_id: null } : v);
    publish(journeys.filter(j => j.id !== item.id), nextVisits);
    if (selectedJourney === item.id) setSelectedJourney(null);
    } catch { setError('Could not delete the trip. Nothing was removed; retry when ready.'); } finally { setPendingAction(false); }
  };
  const deleteVisit = async (item: CurateVisit) => {
    if (pendingAction) return; setPendingAction(true); setError(null);
    try { await api.curateContext.deleteVisit(item.id); useTeaCompassStore.getState().clearVisitReferences(item.id); publish(journeys, visits.filter(v => v.id !== item.id)); if (selectedVisit === item.id) setSelectedVisit(null);
    } catch { setError('Could not delete the visit. Nothing was removed; retry when ready.'); } finally { setPendingAction(false); }
  };
  const visibleVisits = useMemo(() => visits.filter(v => !selectedJourney || !v.journey_id || v.journey_id === selectedJourney), [visits, selectedJourney]);

  const content = <section aria-label="Optional sourcing context" className="space-y-3 border-t border-tea-border px-1 pt-3">
      <div className="px-3"><h3 className="text-ui-14 font-medium text-tea-text">Sourcing context</h3>
        <p className="text-ui-12 text-tea-text-sec">Optional groupings for where you found this tea.</p></div>
      {loading && <p role="status" className="px-3 py-3 text-ui-13 text-tea-text-sec">Loading context…</p>}
      {error && <div role="alert" className="mx-3 rounded-md border border-tea-border bg-tea-accent-sub p-3 text-ui-13 text-tea-text"><p>{error}</p>{!editor && <button className="tap-target mt-2 text-tea-gold" onClick={() => setReloadToken(value => value + 1)}>Retry</button>}</div>}
      {editor?.kind === 'journey' && <div className="space-y-3 rounded-md border border-tea-border bg-tea-surface p-3">
        <input aria-label="Trip name" className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="Trip name" />
        <div className="grid grid-cols-2 gap-2"><input aria-label="Trip season" className={inputClass} value={season} onChange={e => setSeason(e.target.value)} placeholder="Season" /><input aria-label="Trip year" inputMode="numeric" className={inputClass} value={year} onChange={e => setYear(e.target.value)} placeholder="Year" /></div>
        <div className="flex justify-between"><button className="tap-target text-ui-14 text-tea-text-sec" onClick={() => setEditor(null)}>Cancel</button><button disabled={pendingAction} className="btn-primary btn-sm" onClick={saveJourney}>{pendingAction ? 'Saving…' : 'Save trip'}</button></div>
      </div>}
      {editor?.kind === 'visit' && <div className="space-y-3 rounded-md border border-tea-border bg-tea-surface p-3">
        <select aria-label="Visit vendor" className={inputClass} value={vendorId} onChange={e => setVendorId(e.target.value)}><option value="">No vendor</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
        <input aria-label="Visit place" className={inputClass} value={place} onChange={e => setPlace(e.target.value)} placeholder="Place" />
        <div className="flex justify-between"><button className="tap-target text-ui-14 text-tea-text-sec" onClick={() => setEditor(null)}>Cancel</button><button disabled={pendingAction} className="btn-primary btn-sm" onClick={saveVisit}>{pendingAction ? 'Saving…' : 'Save visit'}</button></div>
      </div>}
      <section aria-labelledby="journey-heading">
        <div className="flex min-h-tap items-center justify-between px-3"><h3 id="journey-heading" className="text-ui-11 uppercase tracking-[1.2px] text-tea-text-dim">Trip</h3><button className="tap-target flex items-center gap-1 text-ui-12 text-tea-gold" onClick={() => openJourneyEditor()}><Plus size={14} />New trip</button></div>
        {journeys.length === 0 && <p className="px-3 py-4 text-ui-13 text-tea-text-sec">No saved trips.</p>}
        {journeys.map(j => <div key={j.id} className="flex items-center"><div className="min-w-0 flex-1"><button type="button" className={`btn-quiet w-full min-w-0 justify-start text-left ${selectedJourney === j.id ? 'bg-tea-accent-sub text-tea-gold' : ''}`} aria-pressed={selectedJourney === j.id}
          onClick={() => { setSelectedJourney(j.id); if (visits.find(v => v.id === selectedVisit)?.journey_id !== j.id) setSelectedVisit(null); }}>
          <span className="min-w-0 whitespace-normal">{[j.name, j.season && j.year ? `${j.season} ${j.year}` : j.year].filter(Boolean).join(', ')}</span>
        </button></div><button aria-label={`Edit trip ${j.name}`} className="tap-target text-tea-text-sec" onClick={() => openJourneyEditor(j)}><Pencil size={15} /></button><button aria-label={`Delete trip ${j.name}`} className="tap-target text-tea-text-sec" onClick={() => deleteJourney(j)}><Trash2 size={15} /></button></div>)}
      </section>
      <section aria-labelledby="visit-heading">
        <div className="flex min-h-tap items-center justify-between px-3"><h3 id="visit-heading" className="text-ui-11 uppercase tracking-[1.2px] text-tea-text-dim">Supplier visit</h3><button className="tap-target flex items-center gap-1 text-ui-12 text-tea-gold" onClick={() => openVisitEditor()}><Plus size={14} />New visit</button></div>
        {visits.length === 0 && <p className="px-3 py-4 text-ui-13 text-tea-text-sec">A supplier visit can stand alone or belong to a trip.</p>}
        {visibleVisits.map(v => <div key={v.id} className="flex items-center"><div className="min-w-0 flex-1"><button type="button" className={`btn-quiet w-full min-w-0 justify-start text-left ${selectedVisit === v.id ? 'bg-tea-accent-sub text-tea-gold' : ''}`} aria-pressed={selectedVisit === v.id}
          onClick={() => { setSelectedVisit(v.id); setSelectedJourney(v.journey_id ?? null); }}>
          <span className="min-w-0 whitespace-normal">{v.vendor_name || v.place || 'Visit'}{v.vendor_name && v.place ? ` · ${v.place}` : ''}</span>
        </button></div><button aria-label={`Edit visit ${v.vendor_name || v.place || 'Visit'}`} className="tap-target text-tea-text-sec" onClick={() => openVisitEditor(v)}><Pencil size={15} /></button><button aria-label={`Delete visit ${v.vendor_name || v.place || 'Visit'}`} className="tap-target text-tea-text-sec" onClick={() => deleteVisit(v)}><Trash2 size={15} /></button></div>)}
      </section>
      <div className="flex justify-between gap-3 px-3 pt-2"><Button type="button" variant="quiet" size="sm" onClick={() => { onApply(null, null); onOpenChange(false); }}>Clear context</Button><Button type="button" size="sm" onClick={() => { onApply(selectedJourney, selectedVisit); onOpenChange(false); }}>Apply context</Button></div>
    </section>;
  return inline ? content : <BottomSheet open={open} onOpenChange={onOpenChange} title="Sourcing context" description="Optional trip and supplier visit" large>{content}</BottomSheet>;
};
