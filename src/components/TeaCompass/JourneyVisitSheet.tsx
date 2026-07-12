import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { CurateJourney, CurateVisit } from './types';
import { BottomSheet, SheetOption } from '../shared/BottomSheet';

interface Props {
  open: boolean;
  journeyId?: string | null;
  visitId?: string | null;
  onOpenChange: (open: boolean) => void;
  onApply: (journeyId: string | null, visitId: string | null) => void;
  onLoaded?: (journeys: CurateJourney[], visits: CurateVisit[]) => void;
}

type Editor = { kind: 'journey'; item?: CurateJourney } | { kind: 'visit'; item?: CurateVisit } | null;
const inputClass = 'min-h-11 w-full rounded-md border border-tea-border bg-tea-surface px-3 text-ui-14 text-tea-text focus:border-tea-gold focus:outline-none';

export const JourneyVisitSheet: React.FC<Props> = ({ open, journeyId, visitId, onOpenChange, onApply, onLoaded }) => {
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

  const publish = (nextJourneys: CurateJourney[], nextVisits: CurateVisit[]) => {
    setJourneys(nextJourneys); setVisits(nextVisits); onLoaded?.(nextJourneys, nextVisits);
  };
  useEffect(() => {
    if (!open) return;
    setSelectedJourney(journeyId ?? null); setSelectedVisit(visitId ?? null); setEditor(null);
    let active = true;
    Promise.all([api.curateContext.listJourneys(), api.curateContext.listVisits(), api.customers.list()])
      .then(([j, v, customers]) => {
        if (!active) return;
        publish(j.journeys, v.visits);
        const rows = Array.isArray(customers) ? customers : customers.customers ?? [];
        setVendors(rows.filter((row: any) => !row.tags || String(row.tags).includes('vendor')).map((row: any) => ({ id: row.id, name: row.name })));
      }).catch(() => { /* Context is optional; capture stays usable offline. */ });
    return () => { active = false; };
  }, [open, journeyId, visitId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openJourneyEditor = (item?: CurateJourney) => {
    setEditor({ kind: 'journey', item }); setName(item?.name ?? ''); setSeason(item?.season ?? ''); setYear(item?.year ? String(item.year) : '');
  };
  const openVisitEditor = (item?: CurateVisit) => {
    setEditor({ kind: 'visit', item }); setVendorId(item?.vendor_id ?? ''); setPlace(item?.place ?? '');
    if (item) setSelectedJourney(item.journey_id ?? null);
  };
  const saveJourney = async () => {
    if (!name.trim()) return;
    const payload = { name: name.trim(), season: season.trim() || null, year: year ? Number(year) : null };
    const saved = editor?.kind === 'journey' && editor.item
      ? await api.curateContext.updateJourney(editor.item.id, payload)
      : await api.curateContext.createJourney(payload);
    const next = editor?.kind === 'journey' && editor.item ? journeys.map(j => j.id === saved.id ? saved : j) : [...journeys, saved];
    publish(next, visits); setSelectedJourney(saved.id); setEditor(null);
  };
  const saveVisit = async () => {
    const payload = { journey_id: selectedJourney, vendor_id: vendorId || null, place: place.trim() || null };
    const saved = editor?.kind === 'visit' && editor.item
      ? await api.curateContext.updateVisit(editor.item.id, payload)
      : await api.curateContext.createVisit(payload);
    const next = editor?.kind === 'visit' && editor.item ? visits.map(v => v.id === saved.id ? saved : v) : [...visits, saved];
    publish(journeys, next); setSelectedVisit(saved.id); setSelectedJourney(saved.journey_id ?? null); setEditor(null);
  };
  const deleteJourney = async (item: CurateJourney) => {
    await api.curateContext.deleteJourney(item.id);
    const nextVisits = visits.map(v => v.journey_id === item.id ? { ...v, journey_id: null } : v);
    publish(journeys.filter(j => j.id !== item.id), nextVisits);
    if (selectedJourney === item.id) setSelectedJourney(null);
  };
  const deleteVisit = async (item: CurateVisit) => {
    await api.curateContext.deleteVisit(item.id); publish(journeys, visits.filter(v => v.id !== item.id));
    if (selectedVisit === item.id) setSelectedVisit(null);
  };
  const visibleVisits = useMemo(() => visits.filter(v => !selectedJourney || !v.journey_id || v.journey_id === selectedJourney), [visits, selectedJourney]);

  return <BottomSheet open={open} onOpenChange={onOpenChange} title="Journey & visit" description="Optional context for where this was encountered" large>
    <div className="space-y-5 px-1">
      {editor?.kind === 'journey' && <div className="space-y-3 rounded-md border border-tea-border bg-tea-surface p-3">
        <input aria-label="Journey name" className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="Journey name" />
        <div className="grid grid-cols-2 gap-2"><input aria-label="Journey season" className={inputClass} value={season} onChange={e => setSeason(e.target.value)} placeholder="Season" /><input aria-label="Journey year" inputMode="numeric" className={inputClass} value={year} onChange={e => setYear(e.target.value)} placeholder="Year" /></div>
        <div className="flex justify-between"><button className="tap-target text-ui-14 text-tea-text-sec" onClick={() => setEditor(null)}>Cancel</button><button className="min-h-11 rounded-md bg-tea-gold px-4 text-ui-14 text-tea-bg" onClick={saveJourney}>Save journey</button></div>
      </div>}
      {editor?.kind === 'visit' && <div className="space-y-3 rounded-md border border-tea-border bg-tea-surface p-3">
        <select aria-label="Visit vendor" className={inputClass} value={vendorId} onChange={e => setVendorId(e.target.value)}><option value="">No vendor</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
        <input aria-label="Visit place" className={inputClass} value={place} onChange={e => setPlace(e.target.value)} placeholder="Place" />
        <div className="flex justify-between"><button className="tap-target text-ui-14 text-tea-text-sec" onClick={() => setEditor(null)}>Cancel</button><button className="min-h-11 rounded-md bg-tea-gold px-4 text-ui-14 text-tea-bg" onClick={saveVisit}>Save visit</button></div>
      </div>}
      <section aria-labelledby="journey-heading">
        <div className="flex min-h-11 items-center justify-between px-3"><h3 id="journey-heading" className="text-ui-11 uppercase tracking-[1.2px] text-tea-text-dim">Journey</h3><button className="tap-target flex items-center gap-1 text-ui-12 text-tea-gold" onClick={() => openJourneyEditor()}><Plus size={14} />New journey</button></div>
        {journeys.length === 0 && <p className="px-3 py-4 text-ui-13 text-tea-text-sec">No journeys yet</p>}
        {journeys.map(j => <div key={j.id} className="flex items-center"><div className="min-w-0 flex-1"><SheetOption label={[j.name, j.season && j.year ? `${j.season} ${j.year}` : j.year].filter(Boolean).join(', ')} selected={selectedJourney === j.id} onSelect={() => { setSelectedJourney(j.id); if (visits.find(v => v.id === selectedVisit)?.journey_id !== j.id) setSelectedVisit(null); }} /></div><button aria-label={`Edit journey ${j.name}`} className="tap-target text-tea-text-sec" onClick={() => openJourneyEditor(j)}><Pencil size={15} /></button><button aria-label={`Delete journey ${j.name}`} className="tap-target text-tea-text-sec" onClick={() => deleteJourney(j)}><Trash2 size={15} /></button></div>)}
      </section>
      <section aria-labelledby="visit-heading">
        <div className="flex min-h-11 items-center justify-between px-3"><h3 id="visit-heading" className="text-ui-11 uppercase tracking-[1.2px] text-tea-text-dim">Visit</h3><button className="tap-target flex items-center gap-1 text-ui-12 text-tea-gold" onClick={() => openVisitEditor()}><Plus size={14} />New visit</button></div>
        {visits.length === 0 && <p className="px-3 py-4 text-ui-13 text-tea-text-sec">Visits can stand alone or belong to a journey.</p>}
        {visibleVisits.map(v => <div key={v.id} className="flex items-center"><div className="min-w-0 flex-1"><SheetOption label={v.vendor_name || v.place || 'Visit'} hint={v.place || undefined} selected={selectedVisit === v.id} onSelect={() => { setSelectedVisit(v.id); setSelectedJourney(v.journey_id ?? null); }} /></div><button aria-label={`Edit visit ${v.vendor_name || v.place || 'Visit'}`} className="tap-target text-tea-text-sec" onClick={() => openVisitEditor(v)}><Pencil size={15} /></button><button aria-label={`Delete visit ${v.vendor_name || v.place || 'Visit'}`} className="tap-target text-tea-text-sec" onClick={() => deleteVisit(v)}><Trash2 size={15} /></button></div>)}
      </section>
      <div className="flex justify-between gap-3 px-3 pt-2"><button className="tap-target text-ui-14 text-tea-text-sec" onClick={() => { onApply(null, null); onOpenChange(false); }}>Clear context</button><button className="min-h-11 rounded-md bg-tea-gold px-5 text-ui-14 font-medium text-tea-bg" onClick={() => { onApply(selectedJourney, selectedVisit); onOpenChange(false); }}>Apply context</button></div>
    </div>
  </BottomSheet>;
};
