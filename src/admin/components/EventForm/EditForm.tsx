import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { compressImage } from '../../../lib/imageCompressor';
import { useToast } from '../Toast';
import { TeaEvent, EventFormData, VenueGuide, VenueGuideStep, SessionFlowItem, SavedLocation } from '../../../types/events';
import { VenueManager } from '../VenueManager';
import { useVenues } from '../../hooks/useEventData';
import { emptyForm, computeEndDate, slugify } from './shared';
import BasicInfoSection from './sections/BasicInfoSection';
import LocationSection from './sections/LocationSection';
import VenueGuideSection from './sections/VenueGuideSection';
import SessionFlowSection from './sections/SessionFlowSection';

export interface EditFormProps {
  initialData: TeaEvent;
  onClose: () => void;
  onSuccess: () => void;
}

export type EditSection = 'basic' | 'location' | 'venue-guide' | 'session-flow' | 'briefing';

const EMPTY_VENUE_GUIDE: VenueGuide = { steps: [], parking_notes: '', transit_notes: '', arrival_notes: '' };

const EditForm: React.FC<EditFormProps> = ({ initialData, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<EventFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slugManual, setSlugManual] = useState(false);
  const [openSections, setOpenSections] = useState<Set<EditSection>>(new Set(['basic']));
  const [durationHours, setDurationHours] = useState(2);
  const [repeatDates, setRepeatDates] = useState<string[]>([]);
  const [editRequiresApproval, setEditRequiresApproval] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const venueStepFileRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [venueStepUploading, setVenueStepUploading] = useState<number | null>(null);

  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [showSaveLocation, setShowSaveLocation] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  // Venue state
  const { data: venues = [] } = useVenues();
  const [editVenueId, setEditVenueId] = useState('');
  const [editSpaceIds, setEditSpaceIds] = useState<string[]>([]);
  const [isVenueManagerOpen, setIsVenueManagerOpen] = useState(false);
  const editVenueObj = useMemo(
    () => venues.find(v => v.id === editVenueId),
    [venues, editVenueId]
  );

  const editCombinedCapacity = useMemo(
    () =>
      (editVenueObj?.spaces ?? [])
        .filter(s => editSpaceIds.includes(s.id))
        .reduce((sum, s) => sum + s.capacity, 0),
    [editVenueObj, editSpaceIds]
  );

  const toggleEditSpace = useCallback((spaceId: string, capacity: number) => {
    setEditSpaceIds(prev => {
      const wasSelected = prev.includes(spaceId);
      setForm(f => ({
        ...f,
        totalCapacity: wasSelected ? Math.max(1, f.totalCapacity - capacity) : f.totalCapacity + capacity,
      }));
      return wasSelected ? prev.filter(id => id !== spaceId) : [...prev, spaceId];
    });
  }, []);

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
      timezone: initialData.timezone,
      status: initialData.status,
      flyerImageUrl: initialData.flyerImageUrl || '',
      locationName: initialData.locationName || '',
      addressText: initialData.addressText || '',
      mapLink: initialData.mapLink || '',
      guidelinesText: initialData.guidelinesText || '',
      areaHint: initialData.areaHint || '',
      format: initialData.format,
      gatheringType: initialData.gatheringType || 'private',
      venueGuide: initialData.venueGuide || { steps: [], parking_notes: '', transit_notes: '', arrival_notes: '' },
      sessionFlow: initialData.sessionFlow || [],
    });
    setSlugManual(true);
    setSelectedLocationId('');
    // Derive duration from existing dates
    if (initialData.eventDate && initialData.eventEndDate) {
      const diffHours = (new Date(initialData.eventEndDate).getTime() - new Date(initialData.eventDate).getTime()) / (1000 * 60 * 60);
      const rounded = Math.round(diffHours * 2) / 2;
      const valid = [1, 1.5, 2, 2.5, 3, 4];
      setDurationHours(valid.includes(rounded) ? rounded : 2);
    } else {
      setDurationHours(2);
    }
    setRepeatDates([]);
    setEditVenueId(initialData.venueId ?? '');
    setEditSpaceIds(initialData.activeSpaceIds ?? []);
    // requires_approval comes as raw integer from worker; default true for old events
    const rawApproval = (initialData as any).requires_approval;
    setEditRequiresApproval(rawApproval === undefined || rawApproval === null ? true : rawApproval !== 0);
  }, [initialData]);

  const updateField = useCallback((field: keyof EventFormData, value: any) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'title' && !slugManual) {
        next.slug = slugify(value as string);
      }
      return next;
    });
  }, [slugManual]);

  const toggleSection = useCallback((key: EditSection) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      updateField('flyerImageUrl', result.url || result);
      showToast('Image uploaded', 'success');
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }, [showToast, updateField]);

  const handleSelectLocation = useCallback((locationId: string) => {
    setSelectedLocationId(locationId);
    if (!locationId) return;
    const loc = savedLocations.find(l => l.id === locationId);
    if (!loc) return;
    setForm(prev => ({
      ...prev,
      locationName: loc.name,
      addressText: loc.address,
      mapLink: loc.mapLink || '',
      guidelinesText: loc.guidelines || '',
      ...(loc.venueGuide ? { venueGuide: loc.venueGuide } : {}),
      locationId,
    } as EventFormData));
  }, [savedLocations]);

  const handleSaveLocation = useCallback(async () => {
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
  }, [form.locationName, form.addressText, form.mapLink, form.guidelinesText, form.venueGuide, showToast]);

  const venueGuide = useMemo(
    () => form.venueGuide || EMPTY_VENUE_GUIDE,
    [form.venueGuide]
  );

  const updateVenueGuide = useCallback((next: VenueGuide) => {
    updateField('venueGuide', next);
  }, [updateField]);

  const addVenueStep = useCallback(() => {
    setForm(prev => {
      const g = prev.venueGuide || EMPTY_VENUE_GUIDE;
      return { ...prev, venueGuide: { ...g, steps: [...g.steps, { description: '', image_url: '' }] } };
    });
  }, []);

  const updateVenueStep = useCallback((idx: number, field: keyof VenueGuideStep, value: string) => {
    setForm(prev => {
      const g = prev.venueGuide || EMPTY_VENUE_GUIDE;
      const steps = [...g.steps];
      steps[idx] = { ...steps[idx], [field]: value };
      return { ...prev, venueGuide: { ...g, steps } };
    });
  }, []);

  const removeVenueStep = useCallback((idx: number) => {
    setForm(prev => {
      const g = prev.venueGuide || EMPTY_VENUE_GUIDE;
      return { ...prev, venueGuide: { ...g, steps: g.steps.filter((_, i) => i !== idx) } };
    });
  }, []);

  const handleVenueStepImageUpload = useCallback(async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
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
  }, [showToast, updateVenueStep]);

  const sessionFlow = useMemo(() => form.sessionFlow || [], [form.sessionFlow]);

  const addFlowItem = useCallback(() => {
    setForm(prev => ({
      ...prev,
      sessionFlow: [...(prev.sessionFlow || []), { title: '', description: '', duration_minutes: 10 }],
    }));
  }, []);

  const updateFlowItem = useCallback((idx: number, field: keyof SessionFlowItem, value: any) => {
    setForm(prev => {
      const items = [...(prev.sessionFlow || [])];
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, sessionFlow: items };
    });
  }, []);

  const removeFlowItem = useCallback((idx: number) => {
    setForm(prev => ({
      ...prev,
      sessionFlow: (prev.sessionFlow || []).filter((_, i) => i !== idx),
    }));
  }, []);

  const moveFlowItem = useCallback((idx: number, dir: -1 | 1) => {
    setForm(prev => {
      const items = [...(prev.sessionFlow || [])];
      const target = idx + dir;
      if (target < 0 || target >= items.length) return prev;
      [items[idx], items[target]] = [items[target], items[idx]];
      return { ...prev, sessionFlow: items };
    });
  }, []);

  // Stable per-section toggle callbacks
  const onToggleBasic = useCallback(() => toggleSection('basic'), [toggleSection]);
  const onToggleLocation = useCallback(() => toggleSection('location'), [toggleSection]);
  const onToggleVenueGuide = useCallback(() => toggleSection('venue-guide'), [toggleSection]);
  const onToggleSessionFlow = useCallback(() => toggleSection('session-flow'), [toggleSection]);

  // BasicInfoSection, slug input also flips slugManual
  const handleSlugChange = useCallback((value: string) => {
    setSlugManual(true);
    setForm(prev => ({ ...prev, slug: value }));
  }, []);

  // LocationSection: location name / address inputs also clear selectedLocationId
  const handleLocationNameChange = useCallback((value: string) => {
    setSelectedLocationId('');
    setForm(prev => ({ ...prev, locationName: value }));
  }, []);

  const handleAddressTextChange = useCallback((value: string) => {
    setSelectedLocationId('');
    setForm(prev => ({ ...prev, addressText: value }));
  }, []);

  const handleOpenVenueManager = useCallback(() => setIsVenueManagerOpen(true), []);

  const handleVenueChange = useCallback((venueId: string) => {
    setEditVenueId(venueId);
    setEditSpaceIds([]);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.eventDate) {
      showToast('Title and event date are required', 'error');
      if (!form.title.trim()) {
        if (!openSections.has('basic')) toggleSection('basic');
        titleRef.current?.focus();
      } else {
        if (!openSections.has('basic')) toggleSection('basic');
        dateRef.current?.focus();
      }
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
        event_end_date: form.eventDate ? computeEndDate(form.eventDate, durationHours) : null,
        repeat_dates: repeatDates.filter(Boolean).length > 0 ? JSON.stringify(repeatDates.filter(Boolean)) : null,
        total_capacity: form.totalCapacity,
        claim_window_minutes: form.claimWindowMinutes,
        timezone: form.timezone || initialData.timezone || 'Asia/Taipei',
        status: form.status,
        event_format: form.format || 'private_tasting',
        gathering_type: form.gatheringType || 'private',
        flyer_image_url: form.flyerImageUrl || null,
        location_name: form.locationName || null,
        address_text: form.addressText || null,
        map_link: form.mapLink || null,
        guidelines_text: form.guidelinesText || null,
        area_hint: form.areaHint || null,
        venue_guide: form.venueGuide ? JSON.stringify(form.venueGuide) : null,
        session_flow: form.sessionFlow && form.sessionFlow.length > 0 ? JSON.stringify(form.sessionFlow) : null,
        location_id: selectedLocationId || null,
        venue_id: editVenueId || null,
        active_space_ids: editSpaceIds.length > 0 ? JSON.stringify(editSpaceIds) : null,
        requires_approval: editRequiresApproval ? 1 : 0,
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

  return (
    <>
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">

        <BasicInfoSection
          slug={form.slug}
          title={form.title}
          subtitle={form.subtitle}
          description={form.description}
          eventDate={form.eventDate}
          durationHours={durationHours}
          totalCapacity={form.totalCapacity}
          claimWindowMinutes={form.claimWindowMinutes ?? 15}
          status={form.status ?? 'draft'}
          format={form.format}
          gatheringType={form.gatheringType}
          flyerImageUrl={form.flyerImageUrl}
          requiresApproval={editRequiresApproval}
          repeatDates={repeatDates}
          uploading={uploading}
          isOpen={openSections.has('basic')}
          titleRef={titleRef as React.RefObject<HTMLInputElement>}
          dateRef={dateRef as React.RefObject<HTMLInputElement>}
          fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
          onToggle={onToggleBasic}
          onUpdateField={updateField}
          onSlugChange={handleSlugChange}
          onDurationChange={setDurationHours}
          onRepeatDatesChange={setRepeatDates}
          onRequiresApprovalChange={setEditRequiresApproval}
          onImageUpload={handleImageUpload}
        />

        <LocationSection
          areaHint={form.areaHint}
          locationName={form.locationName}
          addressText={form.addressText}
          mapLink={form.mapLink}
          guidelinesText={form.guidelinesText}
          isOpen={openSections.has('location')}
          venues={venues}
          editVenueId={editVenueId}
          editSpaceIds={editSpaceIds}
          editVenueObj={editVenueObj}
          editCombinedCapacity={editCombinedCapacity}
          savedLocations={savedLocations}
          selectedLocationId={selectedLocationId}
          showSaveLocation={showSaveLocation}
          savingLocation={savingLocation}
          onToggle={onToggleLocation}
          onUpdateField={updateField}
          onLocationNameChange={handleLocationNameChange}
          onAddressTextChange={handleAddressTextChange}
          onOpenVenueManager={handleOpenVenueManager}
          onVenueChange={handleVenueChange}
          onToggleSpace={toggleEditSpace}
          onSelectLocation={handleSelectLocation}
          onShowSaveLocation={setShowSaveLocation}
          onSaveLocation={handleSaveLocation}
        />

        <VenueGuideSection
          venueGuide={venueGuide}
          isOpen={openSections.has('venue-guide')}
          venueStepUploading={venueStepUploading}
          venueStepFileRefs={venueStepFileRefs}
          onToggle={onToggleVenueGuide}
          onAddVenueStep={addVenueStep}
          onUpdateVenueStep={updateVenueStep}
          onRemoveVenueStep={removeVenueStep}
          onVenueStepImageUpload={handleVenueStepImageUpload}
          onUpdateVenueGuide={updateVenueGuide}
        />

        <SessionFlowSection
          sessionFlow={sessionFlow}
          isOpen={openSections.has('session-flow')}
          onToggle={onToggleSessionFlow}
          onAddFlowItem={addFlowItem}
          onUpdateFlowItem={updateFlowItem}
          onRemoveFlowItem={removeFlowItem}
          onMoveFlowItem={moveFlowItem}
        />

      </div>

      {/* Actions */}
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
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed tap-target"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Update Event
        </button>
      </div>
    </form>

    {/* Inline Venue Manager overlay */}
    {isVenueManagerOpen && (
      <div className="fixed inset-0 bg-tea-bg z-modal flex flex-col">
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

export default EditForm;
