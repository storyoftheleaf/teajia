import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Loader2, Plus, ChevronDown, ChevronUp, Trash2, ArrowUp, ArrowDown, Upload, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../lib/api';
import { useToast } from './Toast';
import { TeaEvent, EventFormData, EventStatus, VenueGuideStep, SessionFlowItem } from '../../types/events';

interface EventFormProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: TeaEvent;
  onSuccess: () => void;
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
  venueGuide: { steps: [], parking_notes: '', transit_notes: '', arrival_notes: '' },
  sessionFlow: [],
  playlistUrl: '',
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
    <label className="text-[10px] uppercase tracking-[0.2em] text-tea-text-dim block mb-1.5">{label}</label>
    {children}
  </div>
);

const inputClass = 'w-full border-b border-tea-border bg-transparent focus:border-tea-gold outline-none text-sm text-tea-text py-2 placeholder:text-tea-text-dim/50';
const textareaClass = 'w-full border border-tea-border bg-transparent focus:border-tea-gold outline-none text-sm text-tea-text p-2 rounded-md placeholder:text-tea-text-dim/50 resize-y min-h-[80px]';

export const EventForm: React.FC<EventFormProps> = ({ isOpen, onClose, initialData, onSuccess }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState<EventFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slugManual, setSlugManual] = useState(false);
  const [venueOpen, setVenueOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!initialData;

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
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
          venueGuide: initialData.venueGuide || { steps: [], parking_notes: '', transit_notes: '', arrival_notes: '' },
          sessionFlow: initialData.sessionFlow || [],
          playlistUrl: initialData.playlistUrl || '',
        });
        setSlugManual(true);
      } else {
        setForm(emptyForm);
        setSlugManual(false);
      }
    }
  }, [isOpen, initialData]);

  const updateField = (field: keyof EventFormData, value: any) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'title' && !slugManual) {
        next.slug = slugify(value as string);
      }
      return next;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { uploadUrl, publicUrl } = await api.uploadImage(file.name, file.type);
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      updateField('flyerImageUrl', publicUrl);
      showToast('Image uploaded', 'success');
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  // ── Venue Guide helpers ──
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

  // ── Session Flow helpers ──
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
      const payload = {
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
        address: form.addressText || null,
        map_link: form.mapLink || null,
        guidelines: form.guidelinesText || null,
        venue_guide: form.venueGuide ? JSON.stringify(form.venueGuide) : null,
        session_flow: form.sessionFlow && form.sessionFlow.length > 0 ? JSON.stringify(form.sessionFlow) : null,
        playlist_url: form.playlistUrl || null,
      };

      if (isEdit && initialData) {
        await api.events.update(initialData.id, payload);
        showToast('Event updated', 'success');
      } else {
        await api.events.create(payload);
        showToast('Event created', 'success');
      }
      onSuccess();
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto py-8"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-tea-surface border border-tea-border rounded-lg w-full max-w-5xl mx-4 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-tea-border">
            <h2 className="text-lg font-serif text-tea-text">{isEdit ? 'Edit Event' : 'Create Event'}</h2>
            <button onClick={onClose} className="text-tea-text-dim hover:text-tea-text transition-colors">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
              {/* ── Left Column ── */}
              <div className="space-y-5">
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

                <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-3 gap-4">
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
                    <select
                      value={form.status}
                      onChange={(e) => updateField('status', e.target.value as EventStatus)}
                      className={`${inputClass} bg-tea-surface`}
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field label="Playlist URL">
                  <input
                    type="text"
                    value={form.playlistUrl || ''}
                    onChange={(e) => updateField('playlistUrl', e.target.value)}
                    className={inputClass}
                    placeholder="https://open.spotify.com/playlist/..."
                  />
                </Field>
              </div>

              {/* ── Right Column ── */}
              <div className="space-y-5">
                {/* Flyer Image */}
                <Field label="Flyer Image">
                  <div className="space-y-2">
                    {form.flyerImageUrl ? (
                      <div className="relative w-full h-40 rounded-md overflow-hidden border border-tea-border">
                        <img src={form.flyerImageUrl} alt="Flyer" className="w-full h-full object-cover" />
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
                        className="w-full h-40 border border-dashed border-tea-border rounded-md flex flex-col items-center justify-center gap-2 text-tea-text-dim hover:border-tea-gold/50 hover:text-tea-text-sec transition-colors"
                      >
                        {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                        <span className="text-xs">{uploading ? 'Uploading...' : 'Upload flyer'}</span>
                      </button>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    <input
                      type="text"
                      value={form.flyerImageUrl || ''}
                      onChange={(e) => updateField('flyerImageUrl', e.target.value)}
                      className={inputClass}
                      placeholder="Or paste image URL"
                    />
                  </div>
                </Field>

                <Field label="Location Name">
                  <input
                    type="text"
                    value={form.locationName || ''}
                    onChange={(e) => updateField('locationName', e.target.value)}
                    className={inputClass}
                    placeholder="The Tea Room"
                  />
                </Field>

                <Field label="Address">
                  <input
                    type="text"
                    value={form.addressText || ''}
                    onChange={(e) => updateField('addressText', e.target.value)}
                    className={inputClass}
                    placeholder="123 Tea Lane"
                  />
                </Field>

                <Field label="Map Link">
                  <input
                    type="text"
                    value={form.mapLink || ''}
                    onChange={(e) => updateField('mapLink', e.target.value)}
                    className={inputClass}
                    placeholder="https://maps.google.com/..."
                  />
                </Field>

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
            </div>

            {/* ── Collapsible: Venue Guide ── */}
            <div className="mt-6 border border-tea-border rounded-md">
              <button
                type="button"
                onClick={() => setVenueOpen(!venueOpen)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-tea-text-sec hover:text-tea-text transition-colors"
              >
                <span className="text-[10px] uppercase tracking-[0.2em] text-tea-text-dim font-medium">Venue Guide</span>
                {venueOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {venueOpen && (
                <div className="px-4 pb-4 space-y-4 border-t border-tea-border pt-4">
                  {venueGuide.steps.map((step, idx) => (
                    <div key={idx} className="flex gap-3 items-start">
                      <span className="text-[10px] text-tea-text-dim mt-2 w-4 shrink-0">{idx + 1}.</span>
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={step.description}
                          onChange={(e) => updateVenueStep(idx, 'description', e.target.value)}
                          className={inputClass}
                          placeholder="Step description"
                        />
                        <input
                          type="text"
                          value={step.image_url || ''}
                          onChange={(e) => updateVenueStep(idx, 'image_url', e.target.value)}
                          className={`${inputClass} text-xs`}
                          placeholder="Image URL (optional)"
                        />
                      </div>
                      <button type="button" onClick={() => removeVenueStep(idx)} className="text-tea-text-dim hover:text-tea-text p-1 mt-1">
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

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-tea-border/50">
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

            {/* ── Collapsible: Session Flow ── */}
            <div className="mt-4 border border-tea-border rounded-md">
              <button
                type="button"
                onClick={() => setFlowOpen(!flowOpen)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-tea-text-sec hover:text-tea-text transition-colors"
              >
                <span className="text-[10px] uppercase tracking-[0.2em] text-tea-text-dim font-medium">Session Flow</span>
                {flowOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {flowOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-tea-border pt-4">
                  {sessionFlow.map((item, idx) => (
                    <div key={idx} className="flex gap-3 items-start bg-tea-bg/30 rounded-md p-3">
                      <div className="flex flex-col gap-1 shrink-0 mt-1">
                        <button type="button" onClick={() => moveFlowItem(idx, -1)} disabled={idx === 0} className="text-tea-text-dim hover:text-tea-text disabled:opacity-20 transition-colors">
                          <ArrowUp size={12} />
                        </button>
                        <button type="button" onClick={() => moveFlowItem(idx, 1)} disabled={idx === sessionFlow.length - 1} className="text-tea-text-dim hover:text-tea-text disabled:opacity-20 transition-colors">
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
                          value={item.description}
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
                        <span className="text-[9px] text-tea-text-dim block text-center">min</span>
                      </div>
                      <button type="button" onClick={() => removeFlowItem(idx)} className="text-tea-text-dim hover:text-tea-text p-1 mt-1">
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
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-tea-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-tea-text-dim hover:text-tea-text transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-tea-gold text-tea-bg px-5 py-2 rounded-md text-sm font-medium hover:bg-tea-gold-lt transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {isEdit ? 'Update Event' : 'Create Event'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
