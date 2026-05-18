import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Save, Loader2, Trash2, MapPin, Upload, ChevronDown, ChevronUp, Image, Users, Calendar, ExternalLink } from 'lucide-react';

const TEA_STYLE_OPTIONS = [
  'Gongfu', 'Grandpa Style', 'Western', 'Gaiwan', 'Yixing Pot',
  'Charcoal Fire', 'Aged Puerh', 'Raw Puerh', 'Roasted Oolong',
  'Light Oolong', 'White Tea', 'Green Tea', 'Cold Brew',
];
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { compressImage } from '../../lib/imageCompressor';
import { useToast } from './Toast';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { Venue, VenueSpace } from '../../types/events';

// ─── Shared primitives ────────────────────────────────────────────────────────

const inputClass = 'w-full border-b border-tea-border bg-transparent focus:border-tea-gold outline-none text-sm text-tea-text py-2 placeholder:text-tea-text-dim';
const textareaClass = 'w-full border border-tea-border bg-transparent focus:border-tea-gold outline-none text-sm text-tea-text p-2 rounded-md placeholder:text-tea-text-dim resize-y min-h-[72px]';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="label-caps text-tea-text-sec block mb-1.5">{label}</label>
    {children}
  </div>
);

// ─── Photo strip ─────────────────────────────────────────────────────────────

interface PhotoStripProps {
  photos: string[];
  onAdd: (file: File) => Promise<void>;
  onRemove: (url: string) => void;
  uploading?: boolean;
}

const PhotoStrip: React.FC<PhotoStripProps> = ({ photos, onAdd, onRemove, uploading }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onAdd(file);
    e.target.value = '';
  };
  return (
    <div className="flex gap-2 flex-wrap">
      {photos.map((url) => (
        <div key={url} className="relative w-24 h-24 rounded-md overflow-hidden border border-tea-border flex-shrink-0">
          <img src={url} alt="Venue photo" className="w-full h-full object-cover" loading="lazy" />
          <button
            type="button"
            onClick={() => onRemove(url)}
            aria-label="Remove photo"
            className="tap-target absolute top-1 right-1 bg-tea-bg/80 text-tea-text rounded-full p-0.5 hover:bg-tea-bg transition-colors"
          >
            <X size={10} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-24 h-24 border border-dashed border-tea-border rounded-md flex flex-col items-center justify-center gap-1.5 text-tea-text-dim hover:border-tea-gold/40 hover:text-tea-text-sec transition-colors flex-shrink-0"
      >
        {uploading ? <Loader2 size={16} className="animate-spin text-tea-gold" /> : <Upload size={16} />}
        <span className="text-ui-9 tracking-wide">{uploading ? 'Uploading…' : 'Add photo'}</span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  );
};

// ─── Space form (inline) ─────────────────────────────────────────────────────

interface SpaceFormProps {
  venueId: string;
  space?: VenueSpace;
  onSaved: () => void;
  onCancel: () => void;
}

const SpaceForm: React.FC<SpaceFormProps> = ({ venueId, space, onSaved, onCancel }) => {
  const { showToast } = useToast();
  const [name, setName] = useState(space?.name ?? '');
  const [capacity, setCapacity] = useState(space?.capacity ?? 10);
  const [description, setDescription] = useState(space?.description ?? '');
  const [photos, setPhotos] = useState<string[]>(space?.photos ?? []);
  const [teaStyles, setTeaStyles] = useState<string[]>(space?.teaStyles ?? []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      // For spaces we use the venue photo endpoint with the venue id
      const result = await api.venues.uploadPhoto(venueId, compressed as File);
      setPhotos(p => [...p, result.url]);
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      const data = { name: name.trim(), capacity, description: description.trim() || undefined, photos, tea_styles: teaStyles };
      if (space) {
        await api.venues.updateSpace(venueId, space.id, data);
      } else {
        await api.venues.createSpace(venueId, data);
      }
      showToast(space ? 'Space updated' : 'Space added', 'success');
      onSaved();
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-tea-bg/50 border border-tea-border rounded-md p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Space Name *">
          <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="Charcoal Table" autoFocus />
        </Field>
        <Field label="Capacity">
          <input type="number" value={capacity} onChange={e => setCapacity(parseInt(e.target.value) || 1)} className={inputClass} min={1} max={200} />
        </Field>
      </div>
      <Field label="Description">
        <textarea value={description} onChange={e => setDescription(e.target.value)} className={textareaClass} placeholder="Formal gongfu, charcoal, aged puerh. Best for focused tasting." rows={2} />
      </Field>
      <Field label="Photos">
        <PhotoStrip photos={photos} onAdd={handleUpload} onRemove={url => setPhotos(p => p.filter(u => u !== url))} uploading={uploading} />
      </Field>
      <Field label="Tea Styles">
        <div role="group" aria-label="Tea styles" className="flex flex-wrap gap-1.5 mt-1">
          {TEA_STYLE_OPTIONS.map(style => {
            const active = teaStyles.includes(style);
            return (
              <button
                key={style}
                type="button"
                aria-pressed={active}
                onClick={() => setTeaStyles(prev => active ? prev.filter(s => s !== style) : [...prev, style])}
                className={`px-2.5 py-1 rounded-full text-ui-11 transition-colors ${
                  active ? 'bg-tea-gold/10 text-tea-text' : 'bg-tea-elevated text-tea-text-sec hover:text-tea-text'
                }`}
              >
                {style}
              </button>
            );
          })}
        </div>
      </Field>
      <div className="flex justify-between gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-tea-text-sec hover:text-tea-text transition-colors">
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={saving || uploading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {space ? 'Update' : 'Add Space'}
        </button>
      </div>
    </div>
  );
};

// ─── Venue card ───────────────────────────────────────────────────────────────

interface VenueCardProps {
  venue: Venue;
  onRefresh: () => void;
}

const VenueCard: React.FC<VenueCardProps> = ({ venue, onRefresh }) => {
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingSpace, setAddingSpace] = useState(false);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [venueEvents, setVenueEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [confirmDeleteVenue, setConfirmDeleteVenue] = useState(false);
  const [spacePendingDelete, setSpacePendingDelete] = useState<VenueSpace | null>(null);
  const eventsLoadedRef = useRef(false);

  const handleToggleExpand = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !eventsLoadedRef.current) {
      eventsLoadedRef.current = true;
      setLoadingEvents(true);
      try {
        const data = await api.venues.getEvents(venue.id);
        setVenueEvents(Array.isArray(data) ? data : []);
      } catch {
        // silently fail
      } finally {
        setLoadingEvents(false);
      }
    }
  };

  // Editable venue fields
  const [name, setName] = useState(venue.name);
  const [address, setAddress] = useState(venue.address);
  const [mapLink, setMapLink] = useState(venue.mapLink ?? '');
  const [areaHint, setAreaHint] = useState(venue.areaHint ?? '');
  const [arrivalNotes, setArrivalNotes] = useState(venue.arrivalNotes ?? '');
  const [website, setWebsite] = useState(venue.website ?? '');
  const [instagram, setInstagram] = useState(venue.instagram ?? '');
  const [photos, setPhotos] = useState<string[]>(venue.photos);
  const [saving, setSaving] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const result = await api.venues.uploadPhoto(venue.id, compressed as File);
      const newPhotos = [...photos, result.url];
      setPhotos(newPhotos);
      await api.venues.update(venue.id, { photos: newPhotos });
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async (url: string) => {
    const newPhotos = photos.filter(u => u !== url);
    setPhotos(newPhotos);
    await api.venues.update(venue.id, { photos: newPhotos });
  };

  const handleSave = async () => {
    if (!name.trim()) { showToast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      await api.venues.update(venue.id, {
        name: name.trim(),
        address: address.trim(),
        map_link: mapLink.trim() || null,
        area_hint: areaHint.trim() || null,
        arrival_notes: arrivalNotes.trim() || null,
        website: website.trim() || null,
        instagram: instagram.trim() || null,
        photos,
      });
      showToast('Venue updated', 'success');
      setEditing(false);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setConfirmDeleteVenue(false);
    setDeleting(true);
    try {
      await api.venues.delete(venue.id);
      showToast('Venue deleted', 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSpace = async (space: VenueSpace) => {
    setSpacePendingDelete(null);
    try {
      await api.venues.deleteSpace(venue.id, space.id);
      showToast('Space removed', 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete', 'error');
    }
  };

  const totalCapacity = venue.spaces.reduce((sum, s) => sum + s.capacity, 0);

  return (
    <div className="border border-tea-border rounded-xl overflow-hidden">
      {/* Venue header */}
      <div className="flex items-start gap-4 p-4">
        {/* Venue photo thumbnail */}
        {photos[0] ? (
          <div className="w-16 h-16 rounded-md overflow-hidden border border-tea-border flex-shrink-0">
            <img src={photos[0]} alt={venue.name} className="w-full h-full object-cover" loading="lazy" />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-md border border-dashed border-tea-border flex items-center justify-center flex-shrink-0">
            <MapPin size={18} className="text-tea-text-dim" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium text-tea-text">{venue.name}</h3>
              <p className="text-xs text-tea-text-sec mt-0.5">{venue.address}</p>
              {venue.spaces.length > 0 && (
                <p className="text-ui-11 text-tea-text-dim mt-1">
                  {venue.spaces.length} space{venue.spaces.length !== 1 ? 's' : ''} · {totalCapacity} seats total
                </p>
              )}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {venue.website && (
                  <a href={venue.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-ui-11 text-tea-gold hover:text-tea-gold-lt transition-colors truncate max-w-[180px]">
                    {venue.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {venue.instagram && (
                  <span className="text-ui-11 text-tea-text-dim">{venue.instagram.startsWith('@') ? venue.instagram : `@${venue.instagram}`}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => { setEditing(e => !e); if (!expanded) handleToggleExpand(); }} className="tap-target text-ui-11 text-tea-text-sec hover:text-tea-text px-2 py-1 transition-colors">
                Edit
              </button>
              <button
                onClick={handleToggleExpand}
                aria-label={expanded ? 'Collapse venue' : 'Expand venue'}
                aria-expanded={expanded}
                className="tap-target text-tea-text-sec hover:text-tea-text p-1 transition-colors"
              >
                {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-tea-border">
          {/* Edit venue fields */}
          {editing && (
            <div className="p-4 space-y-4 border-b border-tea-border bg-tea-bg/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Venue Name *">
                  <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Area Hint">
                  <input type="text" value={areaHint} onChange={e => setAreaHint(e.target.value)} className={inputClass} placeholder="Da'an District, Taipei" />
                </Field>
              </div>
              <Field label="Address">
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Map Link">
                <input type="url" value={mapLink} onChange={e => setMapLink(e.target.value)} className={inputClass} placeholder="https://maps.google.com/…" />
              </Field>
              <Field label="Arrival Notes">
                <textarea value={arrivalNotes} onChange={e => setArrivalNotes(e.target.value)} className={textareaClass} placeholder="Ring the bell on the left, take the stairs to floor 3…" rows={2} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Website / Profile Link">
                  <input type="url" value={website} onChange={e => setWebsite(e.target.value)} className={inputClass} placeholder="https://instagram.com/teajia" />
                </Field>
                <Field label="Instagram Handle">
                  <input type="text" value={instagram} onChange={e => setInstagram(e.target.value)} className={inputClass} placeholder="@teajia" />
                </Field>
              </div>
              <div>
                <label className="label-caps text-tea-text-sec block mb-1">Venue Photos</label>
                <p className="text-ui-10 text-tea-text-dim mb-2">First photo is the hero. Add more to show the vibe from past events.</p>
                <PhotoStrip photos={photos} onAdd={handleUpload} onRemove={handleRemovePhoto} uploading={uploading} />
              </div>
              <div className="flex items-center justify-between pt-1">
                <button type="button" onClick={() => setConfirmDeleteVenue(true)} disabled={deleting} className="flex items-center gap-1.5 text-xs text-tea-error hover:text-tea-error transition-colors disabled:opacity-50">
                  {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  Delete venue
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm text-tea-text-sec hover:text-tea-text transition-colors">
                    Cancel
                  </button>
                  <button type="button" onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Spaces list */}
          <div className="p-4 space-y-3">
            <p className="label-caps text-tea-text-dim">Spaces</p>

            {venue.spaces.length === 0 && !addingSpace && (
              <p className="text-xs text-tea-text-dim py-2">No spaces yet — add a tea table or room below.</p>
            )}

            {venue.spaces.map(space => (
              <div key={space.id}>
                {editingSpaceId === space.id ? (
                  <SpaceForm
                    venueId={venue.id}
                    space={space}
                    onSaved={() => { setEditingSpaceId(null); onRefresh(); }}
                    onCancel={() => setEditingSpaceId(null)}
                  />
                ) : (
                  <div className="flex items-start gap-3 py-2 border-b border-tea-border last:border-0">
                    {/* Space photos */}
                    {space.photos.length > 0 ? (
                      <div className="flex gap-1.5 flex-shrink-0">
                        {space.photos.slice(0, 3).map(url => (
                          <div key={url} className="w-14 h-14 rounded overflow-hidden border border-tea-border">
                            <img src={url} alt={`${space.name} photo`} className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded border border-dashed border-tea-border flex items-center justify-center flex-shrink-0">
                        <Image size={14} className="text-tea-text-dim" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-tea-text font-medium">{space.name}</p>
                          <p className="text-ui-11 text-tea-text-sec flex items-center gap-1 mt-0.5">
                            <Users size={10} /> {space.capacity} seats
                          </p>
                          {space.description && (
                            <p className="text-xs text-tea-text-dim mt-1 line-clamp-2">{space.description}</p>
                          )}
                          {space.teaStyles && space.teaStyles.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {space.teaStyles.map(s => (
                                <span key={s} className="px-2 py-0.5 rounded-full text-ui-10 bg-tea-elevated text-tea-text-sec">{s}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => setEditingSpaceId(space.id)} className="tap-target text-ui-11 text-tea-text-sec hover:text-tea-text px-2 py-0.5 transition-colors">
                            Edit
                          </button>
                          <button onClick={() => setSpacePendingDelete(space)} aria-label={`Remove ${space.name}`} className="tap-target text-tea-text-dim hover:text-tea-error p-0.5 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {addingSpace && (
              <SpaceForm
                venueId={venue.id}
                onSaved={() => { setAddingSpace(false); onRefresh(); }}
                onCancel={() => setAddingSpace(false)}
              />
            )}

            {!addingSpace && (
              <button
                type="button"
                onClick={() => setAddingSpace(true)}
                className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-text transition-colors mt-1"
              >
                <Plus size={13} />
                Add space
              </button>
            )}
          </div>

          {/* Events hosted here */}
          <div className="p-4 border-t border-tea-border space-y-2">
            <div className="flex items-center gap-2">
              <Calendar size={12} className="text-tea-text-dim" />
              <p className="label-caps text-tea-text-dim">Events Hosted Here</p>
            </div>
            {loadingEvents ? (
              <Loader2 size={14} className="animate-spin text-tea-text-dim" />
            ) : venueEvents.length === 0 ? (
              <p className="text-xs text-tea-text-dim">No events yet.</p>
            ) : (
              <div className="space-y-1.5">
                {venueEvents.map((ev: any) => (
                  <Link
                    key={ev.id}
                    to={`/admin/events/${ev.id}`}
                    className="flex items-center justify-between gap-3 py-1.5 group"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-tea-text group-hover:text-tea-gold transition-colors truncate">{ev.title}</p>
                      <p className="text-ui-10 text-tea-text-dim mt-0.5">
                        {new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {' · '}{ev.confirmed_count ?? 0}/{ev.total_capacity} confirmed
                      </p>
                    </div>
                    <ExternalLink size={11} className="text-tea-text-dim group-hover:text-tea-gold transition-colors flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDeleteVenue}
        title="Delete venue"
        message={`Delete "${venue.name}"? This will also remove all its spaces.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteVenue(false)}
      />
      <ConfirmDialog
        isOpen={spacePendingDelete !== null}
        title="Remove space"
        message={spacePendingDelete ? `Remove "${spacePendingDelete.name}"?` : ''}
        confirmText="Remove"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={() => { if (spacePendingDelete) handleDeleteSpace(spacePendingDelete); }}
        onCancel={() => setSpacePendingDelete(null)}
      />
    </div>
  );
};

// ─── New venue form ───────────────────────────────────────────────────────────

interface NewVenueFormProps {
  onSaved: () => void;
  onCancel: () => void;
}

const NewVenueForm: React.FC<NewVenueFormProps> = ({ onSaved, onCancel }) => {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [areaHint, setAreaHint] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !address.trim()) {
      showToast('Name and address are required', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.venues.create({
        name: name.trim(),
        address: address.trim(),
        map_link: mapLink.trim() || null,
        area_hint: areaHint.trim() || null,
      });
      showToast('Venue created', 'success');
      onSaved();
    } catch (err: any) {
      showToast(err.message || 'Failed to create', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-tea-border rounded-md p-4 space-y-4">
      <p className="label-caps text-tea-text-sec">New Venue</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Venue Name *">
          <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="Adrian's Flat" autoFocus />
        </Field>
        <Field label="Area Hint">
          <input type="text" value={areaHint} onChange={e => setAreaHint(e.target.value)} className={inputClass} placeholder="Da'an District, Taipei" />
        </Field>
      </div>
      <Field label="Address *">
        <input type="text" value={address} onChange={e => setAddress(e.target.value)} className={inputClass} placeholder="123 Heping East Road, Da'an" />
      </Field>
      <Field label="Map Link">
        <input type="url" value={mapLink} onChange={e => setMapLink(e.target.value)} className={inputClass} placeholder="https://maps.google.com/…" />
      </Field>
      <div className="flex justify-between gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-tea-text-sec hover:text-tea-text transition-colors">
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Create Venue
        </button>
      </div>
    </div>
  );
};

// ─── VenueManager (main export) ───────────────────────────────────────────────

export const VenueManager: React.FC = () => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    try {
      const data = await api.venues.list();
      setVenues(data);
    } catch {
      // silently fail — user will see empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-nav-gap space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-serif text-tea-text">Venues</h1>
          <p className="text-xs text-tea-text-sec mt-0.5">Tea houses and spaces available for events</p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-sm text-tea-text-sec hover:text-tea-text border border-tea-border px-3 py-1.5 rounded-md hover:border-tea-gold/40 transition-colors"
          >
            <Plus size={14} />
            Add venue
          </button>
        )}
      </div>

      {adding && (
        <NewVenueForm onSaved={() => { setAdding(false); load(); }} onCancel={() => setAdding(false)} />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-tea-text-dim" />
        </div>
      ) : venues.length === 0 && !adding ? (
        <div className="text-center py-16 space-y-2">
          <MapPin size={28} className="text-tea-text-dim mx-auto" />
          <p className="text-sm text-tea-text-sec">No venues yet</p>
          <p className="text-xs text-tea-text-dim">Add a venue to define where events are held and which spaces are available.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {venues.map(venue => (
            <VenueCard key={venue.id} venue={venue} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  );
};
