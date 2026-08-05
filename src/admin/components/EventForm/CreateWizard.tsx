import React, { useState, useRef, useMemo } from 'react';
import { X, Save, Loader2, Plus, ChevronDown, MapPin, Image } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { compressImage } from '../../../lib/imageCompressor';
import { useToast } from '../Toast';
import { EventStatus, EventFormat, GatheringType } from '../../../types/events';
import { VenueManager } from '../VenueManager';
import { useVenues } from '../../hooks/useEventData';
import { Field, inputClass, textareaClass, selectClass, STATUS_OPTIONS, computeEndDate, slugify } from './shared';

export interface CreateWizardProps {
  onClose: () => void;
  onSuccess: (createdEventId?: string) => void;
}

const CreateWizard: React.FC<CreateWizardProps> = ({ onClose, onSuccess }) => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [durationHours, setDurationHours] = useState(2);
  const [repeatDates, setRepeatDates] = useState<string[]>([]);
  const [totalCapacity, setTotalCapacity] = useState(12);
  const [status, setStatus] = useState<EventStatus>('draft');
  const [format, setFormat] = useState<EventFormat>('private_tasting');
  const [gatheringType, setGatheringType] = useState<GatheringType>('private');
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [flyerImageUrl, setFlyerImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Venue / space state
  const { data: venues = [] } = useVenues();
  const [selectedVenueId, setSelectedVenueId] = useState('');
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);
  const [isVenueManagerOpen, setIsVenueManagerOpen] = useState(false);

  const selectedVenue = useMemo(
    () => venues.find(v => v.id === selectedVenueId),
    [venues, selectedVenueId]
  );

  const combinedCapacity = useMemo(
    () =>
      (selectedVenue?.spaces ?? [])
        .filter(s => selectedSpaceIds.includes(s.id))
        .reduce((sum, s) => sum + s.capacity, 0),
    [selectedVenue, selectedSpaceIds]
  );

  const toggleSpace = (spaceId: string, capacity: number) => {
    const wasSelected = selectedSpaceIds.includes(spaceId);
    setSelectedSpaceIds(prev => {
      if (wasSelected) return prev.filter(id => id !== spaceId);
      return [...prev, spaceId];
    });
    // Auto-sum capacity when toggling spaces
    setTotalCapacity(prev => (wasSelected ? Math.max(1, prev - capacity) : prev + capacity));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('Image must be under 10 MB', 'error');
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      showToast('Only JPG, PNG, WebP, or GIF images are supported', 'error');
      return;
    }
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
      (!title.trim() ? titleRef.current : dateRef.current)?.focus();
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
        event_end_date: computeEndDate(eventDate, durationHours) || undefined,
        repeat_dates: repeatDates.filter(Boolean).length > 0 ? JSON.stringify(repeatDates.filter(Boolean)) : undefined,
        total_capacity: totalCapacity,
        claim_window_minutes: 60,
        status,
        event_format: format,
        gathering_type: gatheringType,
        requires_approval: requiresApproval ? 1 : 0,
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
    <>
    <form ref={formRef} onSubmit={handleCreate} className="flex flex-col h-full min-h-0">
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">

          {/* ── Left column: details ── */}
          <div className="divide-y divide-tea-border">

            {/* Identity: Title always visible */}
            <section className="space-y-5 pb-8">
              <h3 className="label-caps text-tea-text-sec">Event Details</h3>
              <Field label="Title" required>
                <input
                  ref={titleRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                  placeholder="Spring Tea Tasting"
                  required
                  aria-required="true"
                  autoFocus
                />
              </Field>
            </section>

            {/* Scheduling: Date + Seats always visible */}
            <section className="space-y-5 py-8">
              <h3 className="label-caps text-tea-text-sec">Scheduling</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Start Date & Time" required>
                  <input
                    ref={dateRef}
                    type="datetime-local"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className={inputClass}
                    required
                    aria-required="true"
                  />
                </Field>
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
              </div>
            </section>

            {/* Format: Gathering Type always visible */}
            <section className="space-y-5 py-8">
              <h3 className="label-caps text-tea-text-sec">Format</h3>
              <Field label="Gathering Type">
                <p className="text-ui-11 text-tea-text-dim mb-2">Intimacy &amp; access level</p>
                <div className="flex gap-4 pt-1" role="radiogroup" aria-label="Gathering Type">
                  {(['private', 'semi-private', 'open', 'bespoke'] as GatheringType[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={gatheringType === opt}
                      onClick={() => setGatheringType(opt)}
                      className={`text-ui-11 font-medium capitalize transition-colors pb-0.5 ${
                        gatheringType === opt
                          ? 'text-tea-gold border-b border-tea-gold'
                          : 'text-tea-text-sec hover:text-tea-text'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </Field>
            </section>

            {/* Location, always visible */}
            <section className="space-y-4 pt-8">
              <h3 className="label-caps text-tea-text-sec">Location</h3>

              {venues.length === 0 ? (
                <div className="flex items-center justify-between py-1">
                  <p className="text-xs text-tea-text-dim">No venues configured yet.</p>
                  <button
                    type="button"
                    onClick={() => setIsVenueManagerOpen(true)}
                    className="flex items-center gap-1.5 text-xs text-tea-gold hover:text-tea-gold-lt transition-colors"
                  >
                    <MapPin size={11} />
                    Add venue
                  </button>
                </div>
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
                    {selectedVenueId && (
                      <p className="text-ui-11 text-tea-text-dim mt-1.5">
                        Select the spaces within this venue where the event will be held
                      </p>
                    )}
                  </Field>

                  {/* Space picker, shown once a venue is selected */}
                  {selectedVenue && selectedVenue.spaces.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="label-caps text-tea-text-sec">Spaces</p>
                        {selectedSpaceIds.length === 0 && (
                          <p className="text-ui-11 text-tea-gold">No spaces selected. Capacity defaults to 12.</p>
                        )}
                      </div>
                      {/* Selected space chips */}
                      {selectedSpaceIds.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedVenue.spaces.filter(s => selectedSpaceIds.includes(s.id)).map(s => (
                            <span key={s.id} className="inline-flex items-center gap-1 text-ui-11 text-tea-gold">
                              {s.name} · {s.capacity}
                            </span>
                          ))}
                        </div>
                      )}
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
                                  ? 'border-tea-gold bg-tea-gold/5 text-tea-text'
                                  : 'border-tea-border hover:border-tea-border text-tea-text-sec'
                              }`}
                            >
                              {/* Space photo */}
                              {space.photos[0] ? (
                                <div className="w-14 h-14 rounded overflow-hidden border border-tea-border flex-shrink-0">
                                  <img src={space.photos[0]} alt={space.name} className="w-full h-full object-cover" loading="lazy" />
                                </div>
                              ) : (
                                <div className="w-14 h-14 rounded border border-dashed border-tea-border flex items-center justify-center flex-shrink-0">
                                  <MapPin size={14} className="text-tea-text-dim" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${active ? 'text-tea-text' : 'text-tea-text-sec'}`}>{space.name}</p>
                                <p className="text-ui-11 text-tea-text-dim mt-0.5">{space.capacity} seats</p>
                                {space.description && (
                                  <p className="text-ui-11 text-tea-text-dim mt-1 line-clamp-1">{space.description}</p>
                                )}
                              </div>
                              <div className={`w-4 h-4 rounded-md border flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                                active ? 'bg-tea-gold border-tea-gold' : 'border-tea-border'
                              }`}>
                                {active && <span className="text-tea-bg text-ui-10 font-semibold leading-none">✓</span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {selectedSpaceIds.length > 1 && (
                        <p className="text-ui-11 text-tea-text-sec">
                          Combined capacity: {combinedCapacity} seats
                        </p>
                      )}
                    </div>
                  )}

                  {selectedVenue && selectedVenue.spaces.length === 0 && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-tea-text-dim">This venue has no spaces yet.</p>
                      <button
                        type="button"
                        onClick={() => setIsVenueManagerOpen(true)}
                        className="flex items-center gap-1.5 text-xs text-tea-gold hover:text-tea-gold-lt transition-colors"
                      >
                        <MapPin size={11} />
                        Add spaces
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* ── Add Details disclosure ── */}
            <div className="border-t border-tea-border pt-6 pb-2">
              <button
                type="button"
                onClick={() => setDetailsOpen(prev => !prev)}
                aria-expanded={detailsOpen}
                className="flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors"
              >
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${detailsOpen ? 'rotate-180' : ''}`}
                />
                <span className="label-caps">
                  Add Details
                </span>
              </button>
            </div>

            {detailsOpen && (
              <div className="divide-y divide-tea-border">

                {/* Subtitle + Description */}
                <section className="space-y-5 pb-8">
                  <h3 className="label-caps text-tea-text-sec">Event Details</h3>
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

                {/* Duration, Repeat dates, Status */}
                <section className="space-y-5 py-8">
                  <h3 className="label-caps text-tea-text-sec">Scheduling</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Duration">
                      <div className="relative">
                        <select
                          value={durationHours}
                          onChange={(e) => setDurationHours(parseFloat(e.target.value))}
                          className={selectClass}
                        >
                          <option value="1">1 hour</option>
                          <option value="1.5">1.5 hours</option>
                          <option value="2">2 hours</option>
                          <option value="2.5">2.5 hours</option>
                          <option value="3">3 hours</option>
                          <option value="4">4 hours</option>
                        </select>
                        <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-tea-text-sec pointer-events-none" />
                      </div>
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
                  {/* Repeat dates */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="label-caps text-tea-text-sec">Repeats</span>
                      <div className="flex gap-3" role="radiogroup" aria-label="Repeats">
                        <button
                          type="button"
                          role="radio"
                          aria-checked={repeatDates.length === 0}
                          onClick={() => setRepeatDates([])}
                          className={`text-ui-11 font-medium transition-colors pb-0.5 ${
                            repeatDates.length === 0
                              ? 'text-tea-gold border-b border-tea-gold'
                              : 'text-tea-text-sec hover:text-tea-text'
                          }`}
                        >
                          One-time
                        </button>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={repeatDates.length > 0}
                          onClick={() => { if (repeatDates.length === 0) setRepeatDates(['']); }}
                          className={`text-ui-11 font-medium transition-colors pb-0.5 ${
                            repeatDates.length > 0
                              ? 'text-tea-gold border-b border-tea-gold'
                              : 'text-tea-text-sec hover:text-tea-text'
                          }`}
                        >
                          Multiple dates
                        </button>
                      </div>
                    </div>
                    {repeatDates.length > 0 && (
                      <div className="space-y-2 pl-1">
                        <p className="text-ui-10 text-tea-text-dim">Additional occurrences. Same duration applies to each.</p>
                        {repeatDates.map((d, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input
                              type="datetime-local"
                              value={d}
                              onChange={(e) => setRepeatDates(prev => { const next = [...prev]; next[i] = e.target.value; return next; })}
                              className={`${inputClass} flex-1`}
                            />
                            <button
                              type="button"
                              aria-label="Remove date"
                              onClick={() => setRepeatDates(prev => prev.filter((_, j) => j !== i))}
                              className="text-tea-text-sec hover:text-tea-text transition-colors tap-target"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setRepeatDates(prev => [...prev, ''])}
                          className="flex items-center gap-1 text-xs text-tea-gold hover:text-tea-gold-lt transition-colors"
                        >
                          <Plus size={12} /> Add date
                        </button>
                      </div>
                    )}
                  </div>
                </section>

                {/* Format select */}
                <section className="space-y-5 py-8">
                  <h3 className="label-caps text-tea-text-sec">Format</h3>
                  <Field label="Format">
                    <select
                      value={format}
                      onChange={e => setFormat(e.target.value as EventFormat)}
                      className={selectClass}
                    >
                      <option value="private_tasting">Private Tasting</option>
                      <option value="public_tasting">Public Tasting</option>
                      <option value="workshop">Workshop</option>
                      <option value="pop_up">Pop-up</option>
                      <option value="wholesale_showing">Wholesale Showing</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                  <label className="flex items-start gap-3 cursor-pointer group pt-1">
                    <input
                      type="checkbox"
                      checked={requiresApproval}
                      onChange={(e) => setRequiresApproval(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded-md border border-tea-border bg-tea-surface accent-tea-gold cursor-pointer"
                    />
                    <span className="space-y-0.5">
                      <span className="block text-sm text-tea-text">Requires approval before confirmed</span>
                      <span className="block text-ui-11 text-tea-text-dim">When off, guests are confirmed instantly (subject to capacity).</span>
                    </span>
                  </label>
                </section>

              </div>
            )}

          </div>

          {/* ── Right column: flyer ── */}
          <div className="space-y-4">
            <h3 className="label-caps text-tea-text-sec">Flyer</h3>
            {flyerImageUrl ? (
              <div className="relative w-full rounded-md overflow-hidden border border-tea-border">
                <img src={flyerImageUrl} alt="Flyer" className="w-full object-cover" loading="lazy" />
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
                <span className="text-ui-10 text-tea-text-dim">JPG, PNG, WebP</span>
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
      <div className="flex-shrink-0 flex justify-between gap-2 px-6 py-4 border-t border-tea-border pb-nav-gap lg:pb-4">
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-1 text-xs text-tea-text-sec hover:text-tea-text transition-colors tap-target"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || uploading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed tap-target"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Create Event
        </button>
      </div>
    </form>

    {/* Inline Venue Manager overlay, slides over form without losing state */}
    {isVenueManagerOpen && (
      <div className="absolute inset-0 bg-tea-bg z-toast flex flex-col">
        <div className="flex-shrink-0 flex items-center gap-3 px-6 py-4 border-b border-tea-border">
          <button
            type="button"
            onClick={() => { setIsVenueManagerOpen(false); queryClient.invalidateQueries({ queryKey: ['venues'] }); }}
            aria-label="Close"
            className="text-tea-text-sec hover:text-tea-text transition-colors rounded-md p-1.5 tap-target"
          >
            <X size={16} />
          </button>
          <h3 className="h3 text-tea-text">Manage Venues</h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          <VenueManager />
        </div>
      </div>
    )}
    </>
  );
};

export default CreateWizard;
