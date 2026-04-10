import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Loader2, Plus, ChevronDown, ChevronUp, Trash2, ArrowUp, ArrowDown, Upload, MapPin, Bookmark, Image, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../lib/api';
import { compressImage } from '../../lib/imageCompressor';
import { useToast } from './Toast';
import { TeaEvent, EventFormData, EventStatus, VenueGuideStep, SessionFlowItem, SavedLocation, Venue, VenueSpace } from '../../types/events';

interface EventFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: TeaEvent;
  onSuccess: (createdEventId?: string) => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

const emptyForm: EventFormData = {
  slug: '',
  title: '',
  subtitle: '',
  description: '',
  eventDate: '',
  eventEndDate: '',
  totalCapacity: 12,
  claimWindowMinutes: 60,
  status: 'draft',
  flyerImageUrl: '',
  locationName: '',
  addressText: '',
  mapLink: '',
  guidelinesText: '',
  areaHint: '',
  venueGuide: { steps: [], parking_notes: '', transit_notes: '', arrival_notes: '' },
  sessionFlow: [],
};

const STATUS_OPTIONS: EventStatus[] = ['draft', 'active', 'closed', 'archived'];

const Field = ({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={className}>
    <label className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec block mb-1.5">{label}</label>
    {children}
  </div>
);

const inputClass = 'w-full border-b border-tea-border bg-transparent focus:border-tea-gold outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg text-sm text-tea-text py-2 placeholder:text-tea-text-sec/50 [color-scheme:dark]';
const textareaClass = 'w-full border border-tea-border bg-transparent focus:border-tea-gold outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg text-sm text-tea-text p-2 rounded-md placeholder:text-tea-text-sec/50 resize-y min-h-[80px]';
const selectClass = 'w-full border-b border-tea-border bg-transparent focus:border-tea-gold outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg text-sm text-tea-text py-2 appearance-none cursor-pointer [color-scheme:dark]';

// ─── Create Wizard ───────────────────────────────────────────────────────────

interface CreateWizardProps {
  onClose: () => void;
  onSuccess: (createdEventId?: string) => void;
}

const CreateWizard: React.FC<CreateWizardProps> = ({ onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [totalCapacity, setTotalCapacity] = useState(12);
  const [status, setStatus] = useState<EventStatus>('draft');
  const [flyerImageUrl, setFlyerImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Venue / space state
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState('');
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);

  useEffect(() => {
    api.venues.list().then(setVenues).catch(() => {});
  }, []);

  const selectedVenue = venues.find(v => v.id === selectedVenueId);

  const toggleSpace = (spaceId: string, capacity: number) => {
    setSelectedSpaceIds(prev => {
      if (prev.includes(spaceId)) return prev.filter(id => id !== spaceId);
      return [...prev, spaceId];
    });
    // Auto-sum capacity when toggling spaces
    setTotalCapacity(prev => {
      const wasSelected = selectedSpaceIds.includes(spaceId);
      return wasSelected ? Math.max(1, prev - capacity) : prev + capacity;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const result = await api.events.uploadFlyer(compressed);
      setFlyerImageUrl(result.url || result);
      showToast('Flyer uploaded', 'success');
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventDate) {
      showToast('Title and event date are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const result = await api.events.create({
        slug: slugify(title),
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        description: description.trim() || undefined,
        event_date: eventDate,
        event_end_date: eventEndDate || undefined,
        total_capacity: totalCapacity,
        claim_window_minutes: 60,
        status,
        flyer_image_url: flyerImageUrl || null,
        venue_id: selectedVenueId || undefined,
        active_space_ids: selectedSpaceIds.length > 0 ? JSON.stringify(selectedSpaceIds) : undefined,
        location_name: selectedVenue?.name || undefined,
        address_text: selectedVenue?.address || undefined,
        map_link: selectedVenue?.mapLink || undefined,
        area_hint: selectedVenue?.areaHint || undefined,
      });
      showToast('Event created', 'success');
      onSuccess(result?.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to create', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleCreate} className="flex flex-col h-full min-h-0">
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">

          {/* ── Left column: details ── */}
          <div className="divide-y divide-tea-border">

            {/* Identity */}
            <section className="space-y-5 pb-8">
              <h3 className="text-xs uppercase tracking-widest text-tea-text-sec font-medium">Event Details</h3>
              <Field label="Title *">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                  placeholder="Spring Tea Tasting"
                  required
                  autoFocus
                />
              </Field>
              <Field label="Subtitle">
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className={inputClass}
                  placeholder="A curated afternoon of aged puerh"
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={textareaClass}
                  placeholder="Describe the experience, what guests can expect…"
                  rows={4}
                />
              </Field>
            </section>

            {/* Scheduling */}
            <section className="space-y-5 py-8">
              <h3 className="text-xs uppercase tracking-widest text-tea-text-sec font-medium">Scheduling</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Start Date & Time *">
                  <input
                    type="datetime-local"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className={inputClass}
                    required
                  />
                </Field>
                <Field label="End Date & Time">
                  <input
                    type="datetime-local"
                    value={eventEndDate}
                    onChange={(e) => setEventEndDate(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Seats">
                  <input
                    type="number"
                    value={totalCapacity}
                    onChange={(e) => setTotalCapacity(parseInt(e.target.value) || 12)}
                    className={inputClass}
                    min={1}
                    max={200}
                  />
                </Field>
                <Field label="Status">
                  <div className="relative">
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as EventStatus)}
                      className={selectClass}
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-tea-text-sec pointer-events-none" />
                  </div>
                </Field>
              </div>
            </section>

            {/* Location */}
            <section className="space-y-4 pt-8">
              <h3 className="text-xs uppercase tracking-widest text-tea-text-sec font-medium">Location</h3>

              {venues.length === 0 ? (
                <p className="text-xs text-tea-text-dim py-1">
                  No venues configured yet.{' '}
                  <a href="/admin/venues" className="text-tea-gold underline-offset-2 hover:underline">
                    Add a venue
                  </a>{' '}
                  to enable space selection.
                </p>
              ) : (
                <>
                  {/* Venue picker */}
                  <Field label="Venue">
                    <div className="relative">
                      <MapPin size={12} className="absolute left-0 top-1/2 -translate-y-1/2 text-tea-text-sec" />
                      <select
                        value={selectedVenueId}
                        onChange={(e) => { setSelectedVenueId(e.target.value); setSelectedSpaceIds([]); }}
                        className={`${selectClass} pl-5`}
                      >
                        <option value="">Choose a venue…</option>
                        {venues.map(v => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-tea-text-sec pointer-events-none" />
                    </div>
                  </Field>

                  {/* Space picker — shown once a venue is selected */}
                  {selectedVenue && selectedVenue.spaces.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec">Spaces</p>
                      <div className="space-y-2">
                        {selectedVenue.spaces.map(space => {
                          const active = selectedSpaceIds.includes(space.id);
                          return (
                            <button
                              key={space.id}
                              type="button"
                              onClick={() => toggleSpace(space.id, space.capacity)}
                              className={`w-full flex items-start gap-3 p-3 rounded-md border text-left transition-colors ${
                                active
                                  ? 'border-tea-gold/50 bg-tea-gold/5 text-tea-text'
                                  : 'border-tea-border hover:border-tea-border text-tea-text-sec'
                              }`}
                            >
                              {/* Space photo */}
                              {space.photos[0] ? (
                                <div className="w-14 h-14 rounded overflow-hidden border border-tea-border flex-shrink-0">
                                  <img src={space.photos[0]} alt={space.name} className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-14 h-14 rounded border border-dashed border-tea-border flex items-center justify-center flex-shrink-0">
                                  <MapPin size={14} className="text-tea-text-dim" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${active ? 'text-tea-text' : 'text-tea-text-sec'}`}>{space.name}</p>
                                <p className="text-[11px] text-tea-text-dim mt-0.5">{space.capacity} seats</p>
                                {space.description && (
                                  <p className="text-[11px] text-tea-text-dim mt-1 line-clamp-1">{space.description}</p>
                                )}
                              </div>
                              <div className={`w-4 h-4 rounded-sm border flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                                active ? 'bg-tea-gold border-tea-gold' : 'border-tea-border'
                              }`}>
                                {active && <span className="text-tea-bg text-[10px] font-bold leading-none">✓</span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {selectedSpaceIds.length > 1 && (
                        <p className="text-[11px] text-tea-text-sec">
                          Combined capacity: {selectedVenue.spaces.filter(s => selectedSpaceIds.includes(s.id)).reduce((sum, s) => sum + s.capacity, 0)} seats
                        </p>
                      )}
                    </div>
                  )}

                  {selectedVenue && selectedVenue.spaces.length === 0 && (
                    <p className="text-xs text-tea-text-dim">
                      This venue has no spaces yet.{' '}
                      <a href="/admin/venues" className="text-tea-gold underline-offset-2 hover:underline">Add spaces</a> to enable selection.
                    </p>
                  )}
                </>
              )}
            </section>
          </div>

          {/* ── Right column: flyer ── */}
          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest text-tea-text-sec font-medium">Flyer</h3>
            {flyerImageUrl ? (
              <div className="relative w-full rounded-md overflow-hidden border border-tea-border">
                <img src={flyerImageUrl} alt="Flyer" className="w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setFlyerImageUrl('')}
                  className="absolute top-3 right-3 bg-tea-bg/80 text-tea-text p-1.5 rounded-full hover:bg-tea-bg transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full border border-dashed border-tea-border rounded-md flex flex-col items-center justify-center gap-3 py-16 text-tea-text-sec hover:border-tea-gold/40 hover:text-tea-text-sec transition-colors"
              >
                {uploading ? (
                  <Loader2 size={24} className="animate-spin text-tea-gold" />
                ) : (
                  <Image size={24} className="text-tea-text-dim" />
                )}
                <span className="text-xs tracking-wide">
                  {uploading ? 'Uploading flyer...' : 'Upload flyer image'}
                </span>
                <span className="text-[10px] text-tea-text-dim">JPG, PNG, WebP</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

        </div>
      </div>

      {/* Sticky footer */}
      <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-tea-border">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-tea-text-sec hover:text-tea-text transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || uploading}
          className="flex items-center gap-2 bg-tea-gold text-tea-bg px-5 py-2 rounded-md text-sm font-medium hover:bg-tea-gold-lt transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Create Event
        </button>
      </div>
    </form>
  );
};

// ─── Edit Form ───────────────────────────────────────────────────────────────

interface EditFormProps {
  initialData: TeaEvent;
  onClose: () => void;
  onSuccess: () => void;
}

type EditSection = 'basic' | 'location' | 'venue-guide' | 'session-flow' | 'briefing';

const EditForm: React.FC<EditFormProps> = ({ initialData, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState<EventFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slugManual, setSlugManual] = useState(false);
  const [openSections, setOpenSections] = useState<Set<EditSection>>(new Set(['basic']));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const venueStepFileRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [venueStepUploading, setVenueStepUploading] = useState<number | null>(null);

  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [showSaveLocation, setShowSaveLocation] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  useEffect(() => {
    api.savedLocations.list().then(setSavedLocations).catch(() => {});
  }, []);

  useEffect(() => {
    setForm({
      slug: initialData.slug,
      title: initialData.title,
      subtitle: initialData.subtitle || '',
      description: initialData.description || '',
      eventDate: initialData.eventDate ? initialData.eventDate.slice(0, 16) : '',
      eventEndDate: initialData.eventEndDate ? initialData.eventEndDate.slice(0, 16) : '',
      totalCapacity: initialData.totalCapacity,
      claimWindowMinutes: initialData.claimWindowMinutes,
      status: initialData.status,
      flyerImageUrl: initialData.flyerImageUrl || '',
      locationName: initialData.locationName || '',
      addressText: initialData.addressText || '',
      mapLink: initialData.mapLink || '',
      guidelinesText: initialData.guidelinesText || '',
      areaHint: initialData.areaHint || '',
      venueGuide: initialData.venueGuide || { steps: [], parking_notes: '', transit_notes: '', arrival_notes: '' },
      sessionFlow: initialData.sessionFlow || [],
    });
    setSlugManual(true);
    setSelectedLocationId('');
  }, [initialData]);

  const updateField = (field: keyof EventFormData, value: any) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'title' && !slugManual) {
        next.slug = slugify(value as string);
      }
      return next;
    });
  };

  const toggleSection = (key: EditSection) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const result = await api.events.uploadFlyer(compressed);
      updateField('flyerImageUrl', result.url || result);
      showToast('Image uploaded', 'success');
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSelectLocation = (locationId: string) => {
    setSelectedLocationId(locationId);
    if (!locationId) return;
    const loc = savedLocations.find(l => l.id === locationId);
    if (!loc) return;
    updateField('locationName', loc.name);
    updateField('addressText', loc.address);
    updateField('mapLink', loc.mapLink || '');
    updateField('guidelinesText', loc.guidelines || '');
    if (loc.venueGuide) updateField('venueGuide', loc.venueGuide);
    updateField('locationId', locationId);
  };

  const handleSaveLocation = async () => {
    if (!form.locationName?.trim() || !form.addressText?.trim()) {
      showToast('Location name and address are required to save', 'error');
      return;
    }
    setSavingLocation(true);
    try {
      const data: Record<string, any> = {
        name: form.locationName,
        address: form.addressText,
        map_link: form.mapLink || null,
        guidelines: form.guidelinesText || null,
        venue_guide: form.venueGuide ? JSON.stringify(form.venueGuide) : null,
      };
      const result = await api.savedLocations.create(data);
      const refreshed = await api.savedLocations.list();
      setSavedLocations(refreshed);
      setSelectedLocationId(result.id);
      setShowSaveLocation(false);
      showToast('Location saved', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save location', 'error');
    } finally {
      setSavingLocation(false);
    }
  };

  const venueGuide = form.venueGuide || { steps: [], parking_notes: '', transit_notes: '', arrival_notes: '' };

  const addVenueStep = () => {
    updateField('venueGuide', {
      ...venueGuide,
      steps: [...venueGuide.steps, { description: '', image_url: '' }],
    });
  };

  const updateVenueStep = (idx: number, field: keyof VenueGuideStep, value: string) => {
    const steps = [...venueGuide.steps];
    steps[idx] = { ...steps[idx], [field]: value };
    updateField('venueGuide', { ...venueGuide, steps });
  };

  const removeVenueStep = (idx: number) => {
    updateField('venueGuide', {
      ...venueGuide,
      steps: venueGuide.steps.filter((_, i) => i !== idx),
    });
  };

  const handleVenueStepImageUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVenueStepUploading(idx);
    try {
      const compressed = await compressImage(file);
      const result = await api.events.uploadFlyer(compressed);
      updateVenueStep(idx, 'image_url', result.url || result);
      showToast('Photo uploaded', 'success');
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setVenueStepUploading(null);
    }
  };

  const sessionFlow = form.sessionFlow || [];

  const addFlowItem = () => {
    updateField('sessionFlow', [...sessionFlow, { title: '', description: '', duration_minutes: 10 }]);
  };

  const updateFlowItem = (idx: number, field: keyof SessionFlowItem, value: any) => {
    const items = [...sessionFlow];
    items[idx] = { ...items[idx], [field]: value };
    updateField('sessionFlow', items);
  };

  const removeFlowItem = (idx: number) => {
    updateField('sessionFlow', sessionFlow.filter((_, i) => i !== idx));
  };

  const moveFlowItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= sessionFlow.length) return;
    const items = [...sessionFlow];
    [items[idx], items[target]] = [items[target], items[idx]];
    updateField('sessionFlow', items);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.eventDate) {
      showToast('Title and event date are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        slug: form.slug || slugify(form.title),
        title: form.title,
        subtitle: form.subtitle || null,
        description: form.description || null,
        event_date: form.eventDate,
        end_date: form.eventEndDate || null,
        total_capacity: form.totalCapacity,
        claim_window_minutes: form.claimWindowMinutes,
        status: form.status,
        flyer_image_url: form.flyerImageUrl || null,
        location_name: form.locationName || null,
        address_text: form.addressText || null,
        map_link: form.mapLink || null,
        guidelines_text: form.guidelinesText || null,
        area_hint: form.areaHint || null,
        venue_guide: form.venueGuide ? JSON.stringify(form.venueGuide) : null,
        session_flow: form.sessionFlow && form.sessionFlow.length > 0 ? JSON.stringify(form.sessionFlow) : null,
        location_id: selectedLocationId || null,
      };
      await api.events.update(initialData.id, payload);
      showToast('Event updated', 'success');
      onSuccess();
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const SectionHeader = ({ label, sectionKey, count }: { label: string; sectionKey: EditSection; count?: number }) => (
    <button
      type="button"
      onClick={() => toggleSection(sectionKey)}
      className="w-full flex items-center justify-between px-4 py-3 text-sm text-tea-text-sec hover:text-tea-text transition-colors"
    >
      <span className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec font-medium">{label}</span>
        {count !== undefined && count > 0 && (
          <span className="text-[10px] text-tea-text-dim bg-tea-elevated px-1.5 py-0.5 rounded-sm">{count}</span>
        )}
      </span>
      {openSections.has(sectionKey) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </button>
  );

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">

      {/* ── Section: Basic Info ── */}
      <div className="border border-tea-border rounded-md">
        <SectionHeader label="Basic Info" sectionKey="basic" />
        {openSections.has('basic') && (
          <div className="px-4 pb-5 pt-4 border-t border-tea-border space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {/* Left */}
              <div className="space-y-4">
                <Field label="Slug">
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => { setSlugManual(true); updateField('slug', e.target.value); }}
                    className={inputClass}
                    placeholder="auto-generated-from-title"
                  />
                </Field>
                <Field label="Title *">
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    className={inputClass}
                    placeholder="Spring Tea Tasting"
                    required
                  />
                </Field>
                <Field label="Subtitle">
                  <input
                    type="text"
                    value={form.subtitle || ''}
                    onChange={(e) => updateField('subtitle', e.target.value)}
                    className={inputClass}
                    placeholder="A journey through Wuyi oolongs"
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    value={form.description || ''}
                    onChange={(e) => updateField('description', e.target.value)}
                    className={textareaClass}
                    placeholder="Describe the event..."
                    rows={3}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Event Date *">
                    <input
                      type="datetime-local"
                      value={form.eventDate}
                      onChange={(e) => updateField('eventDate', e.target.value)}
                      className={inputClass}
                      required
                    />
                  </Field>
                  <Field label="End Date">
                    <input
                      type="datetime-local"
                      value={form.eventEndDate || ''}
                      onChange={(e) => updateField('eventEndDate', e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Capacity">
                    <input
                      type="number"
                      value={form.totalCapacity}
                      onChange={(e) => updateField('totalCapacity', parseInt(e.target.value) || 12)}
                      className={inputClass}
                      min={1}
                    />
                  </Field>
                  <Field label="Claim Window (min)">
                    <input
                      type="number"
                      value={form.claimWindowMinutes}
                      onChange={(e) => updateField('claimWindowMinutes', parseInt(e.target.value) || 60)}
                      className={inputClass}
                      min={5}
                    />
                  </Field>
                  <Field label="Status">
                    <div className="relative">
                      <select
                        value={form.status}
                        onChange={(e) => updateField('status', e.target.value as EventStatus)}
                        className={selectClass}
                      >
                        {STATUS_OPTIONS.map(s => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                      <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-tea-text-sec pointer-events-none" />
                    </div>
                  </Field>
                </div>
              </div>
              {/* Right — Flyer */}
              <div className="space-y-4">
                <Field label="Flyer Image">
                  {form.flyerImageUrl ? (
                    <div className="relative w-full rounded-md overflow-hidden border border-tea-border" style={{ maxHeight: 240 }}>
                      <img src={form.flyerImageUrl} alt="Flyer" className="w-full object-cover" style={{ maxHeight: 240 }} />
                      <button
                        type="button"
                        onClick={() => updateField('flyerImageUrl', '')}
                        className="absolute top-2 right-2 bg-tea-bg/80 text-tea-text p-1 rounded-full hover:bg-tea-bg transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full h-40 border border-dashed border-tea-border rounded-md flex flex-col items-center justify-center gap-2 text-tea-text-sec hover:border-tea-gold/50 hover:text-tea-text-sec transition-colors"
                    >
                      {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                      <span className="text-xs">{uploading ? 'Uploading...' : 'Upload flyer'}</span>
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </Field>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Section: Location ── */}
      <div className="border border-tea-border rounded-md">
        <SectionHeader label="Location" sectionKey="location" />
        {openSections.has('location') && (
          <div className="px-4 pb-5 pt-4 border-t border-tea-border space-y-3">
            {/* Area hint (shown publicly before approval) */}
            <Field label="Area Hint (shown publicly before approval)">
              <input
                type="text"
                value={form.areaHint || ''}
                onChange={(e) => updateField('areaHint', e.target.value)}
                className={inputClass}
                placeholder="Da'an District, Taipei"
              />
            </Field>

            <div className="flex items-center justify-between pt-1">
              <label className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec">Venue</label>
              {form.locationName?.trim() && form.addressText?.trim() && !selectedLocationId && (
                <button
                  type="button"
                  onClick={() => setShowSaveLocation(true)}
                  className="flex items-center gap-1 text-[10px] text-tea-gold hover:text-tea-gold-lt transition-colors uppercase tracking-[0.15em]"
                >
                  <Bookmark size={10} /> Save Location
                </button>
              )}
            </div>

            {savedLocations.length > 0 && (
              <div className="relative">
                <MapPin size={12} className="absolute left-0 top-1/2 -translate-y-1/2 text-tea-text-sec" />
                <select
                  value={selectedLocationId}
                  onChange={(e) => handleSelectLocation(e.target.value)}
                  className={`${selectClass} pl-5`}
                >
                  <option value="">Choose a saved location...</option>
                  {savedLocations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-tea-text-sec pointer-events-none" />
              </div>
            )}

            {showSaveLocation && (
              <div className="bg-tea-bg/50 border border-tea-border rounded-md p-3 space-y-2">
                <p className="text-xs text-tea-text-sec">
                  Save "{form.locationName}" as a reusable location?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveLocation}
                    disabled={savingLocation}
                    className="flex items-center gap-1.5 text-xs bg-tea-gold text-tea-bg px-3 py-1.5 rounded-md hover:bg-tea-gold-lt transition-colors disabled:opacity-50"
                  >
                    {savingLocation ? <Loader2 size={10} className="animate-spin" /> : <Bookmark size={10} />}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSaveLocation(false)}
                    className="text-xs text-tea-text-sec hover:text-tea-text px-3 py-1.5 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <input
              type="text"
              value={form.locationName || ''}
              onChange={(e) => { updateField('locationName', e.target.value); setSelectedLocationId(''); }}
              className={inputClass}
              placeholder="Location name"
            />
            <input
              type="text"
              value={form.addressText || ''}
              onChange={(e) => { updateField('addressText', e.target.value); setSelectedLocationId(''); }}
              className={inputClass}
              placeholder="Address"
            />
            <input
              type="text"
              value={form.mapLink || ''}
              onChange={(e) => updateField('mapLink', e.target.value)}
              className={inputClass}
              placeholder="Map link"
            />
            <Field label="Guidelines">
              <textarea
                value={form.guidelinesText || ''}
                onChange={(e) => updateField('guidelinesText', e.target.value)}
                className={textareaClass}
                placeholder="Dress code, what to bring, etc."
                rows={3}
              />
            </Field>
          </div>
        )}
      </div>

      {/* ── Section: Venue Guide ── */}
      <div className="border border-tea-border rounded-md">
        <SectionHeader label="Venue Guide" sectionKey="venue-guide" count={venueGuide.steps.length} />
        {openSections.has('venue-guide') && (
          <div className="px-4 pb-5 pt-4 border-t border-tea-border space-y-4">
            {venueGuide.steps.map((step, idx) => (
              <div key={idx} className="flex gap-3 items-start">
                <span className="text-[10px] text-tea-text-sec mt-2 w-4 shrink-0">{idx + 1}.</span>
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={step.description}
                    onChange={(e) => updateVenueStep(idx, 'description', e.target.value)}
                    className={inputClass}
                    placeholder="Step description"
                  />
                  {step.image_url ? (
                    <div className="relative w-full h-24 rounded-md overflow-hidden border border-tea-border">
                      <img src={step.image_url} alt={`Step ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => updateVenueStep(idx, 'image_url', '')}
                        className="absolute top-1 right-1 bg-tea-bg/80 text-tea-text p-0.5 rounded-full hover:bg-tea-bg transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => venueStepFileRefs.current[idx]?.click()}
                      disabled={venueStepUploading === idx}
                      className="w-full h-16 border border-dashed border-tea-border rounded-md flex items-center justify-center gap-2 text-tea-text-sec hover:border-tea-gold/50 hover:text-tea-text-sec transition-colors text-xs"
                    >
                      {venueStepUploading === idx ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Upload size={14} />
                      )}
                      <span>{venueStepUploading === idx ? 'Uploading...' : 'Upload photo'}</span>
                    </button>
                  )}
                  <input
                    ref={(el) => { venueStepFileRefs.current[idx] = el; }}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleVenueStepImageUpload(idx, e)}
                    className="hidden"
                  />
                </div>
                <button type="button" onClick={() => removeVenueStep(idx)} className="text-tea-text-sec hover:text-tea-text p-1 mt-1">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addVenueStep}
              className="flex items-center gap-1 text-xs text-tea-gold hover:text-tea-gold-lt transition-colors"
            >
              <Plus size={12} /> Add Step
            </button>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-tea-border">
              <Field label="Parking Notes">
                <input
                  type="text"
                  value={venueGuide.parking_notes || ''}
                  onChange={(e) => updateField('venueGuide', { ...venueGuide, parking_notes: e.target.value })}
                  className={inputClass}
                  placeholder="Free parking available"
                />
              </Field>
              <Field label="Transit Notes">
                <input
                  type="text"
                  value={venueGuide.transit_notes || ''}
                  onChange={(e) => updateField('venueGuide', { ...venueGuide, transit_notes: e.target.value })}
                  className={inputClass}
                  placeholder="Take the Blue Line"
                />
              </Field>
              <Field label="Arrival Notes">
                <input
                  type="text"
                  value={venueGuide.arrival_notes || ''}
                  onChange={(e) => updateField('venueGuide', { ...venueGuide, arrival_notes: e.target.value })}
                  className={inputClass}
                  placeholder="Ring the bell"
                />
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* ── Section: Session Flow ── */}
      <div className="border border-tea-border rounded-md">
        <SectionHeader label="Session Flow" sectionKey="session-flow" count={sessionFlow.length} />
        {openSections.has('session-flow') && (
          <div className="px-4 pb-5 pt-4 border-t border-tea-border space-y-3">
            {sessionFlow.map((item, idx) => (
              <div key={idx} className="flex gap-3 items-start bg-tea-bg/30 rounded-md p-3">
                <div className="flex flex-col gap-1 shrink-0 mt-1">
                  <button type="button" onClick={() => moveFlowItem(idx, -1)} disabled={idx === 0} className="text-tea-text-sec hover:text-tea-text disabled:opacity-20 transition-colors">
                    <ArrowUp size={12} />
                  </button>
                  <button type="button" onClick={() => moveFlowItem(idx, 1)} disabled={idx === sessionFlow.length - 1} className="text-tea-text-sec hover:text-tea-text disabled:opacity-20 transition-colors">
                    <ArrowDown size={12} />
                  </button>
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateFlowItem(idx, 'title', e.target.value)}
                    className={inputClass}
                    placeholder="Step title"
                  />
                  <input
                    type="text"
                    value={item.description || ''}
                    onChange={(e) => updateFlowItem(idx, 'description', e.target.value)}
                    className={inputClass}
                    placeholder="Description"
                  />
                </div>
                <div className="w-16 shrink-0">
                  <input
                    type="number"
                    value={item.duration_minutes}
                    onChange={(e) => updateFlowItem(idx, 'duration_minutes', parseInt(e.target.value) || 0)}
                    className={`${inputClass} text-center text-xs`}
                    min={0}
                    title="Minutes"
                  />
                  <span className="text-[9px] text-tea-text-sec block text-center">min</span>
                </div>
                <button type="button" onClick={() => removeFlowItem(idx)} className="text-tea-text-sec hover:text-tea-text p-1 mt-1">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addFlowItem}
              className="flex items-center gap-1 text-xs text-tea-gold hover:text-tea-gold-lt transition-colors"
            >
              <Plus size={12} /> Add Step
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t border-tea-border">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-tea-text-sec hover:text-tea-text transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-tea-gold text-tea-bg px-5 py-2 rounded-md text-sm font-medium hover:bg-tea-gold-lt transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Update Event
        </button>
      </div>
    </form>
  );
};

// ─── EventForm Shell ─────────────────────────────────────────────────────────

export const EventForm: React.FC<EventFormProps> = ({ isOpen, onClose, initialData, onSuccess }) => {
  const isEdit = !!initialData;

  if (!isOpen) return null;

  // Create mode: full-screen panel
  if (!isEdit) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed inset-0 bg-tea-bg z-50 flex flex-col"
        >
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-tea-border">
            <h2 className="text-lg font-serif text-tea-text">Create Event</h2>
            <button onClick={onClose} className="text-tea-text-sec hover:text-tea-text transition-colors">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <CreateWizard onClose={onClose} onSuccess={onSuccess} />
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Edit mode: centered modal (existing behaviour)
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-tea-text/70 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto py-8"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-tea-surface border border-tea-border rounded-lg w-full max-w-2xl mx-4"
          style={{ boxShadow: '0 25px 50px -12px var(--tea-bg)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-tea-border">
            <h2 className="text-lg font-serif text-tea-text">Edit Event</h2>
            <button onClick={onClose} className="text-tea-text-sec hover:text-tea-text transition-colors">
              <X size={18} />
            </button>
          </div>
          <EditForm
            initialData={initialData!}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
