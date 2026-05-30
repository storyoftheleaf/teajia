import React from 'react';
import { Loader2, ChevronDown, MapPin, Bookmark } from 'lucide-react';
import { EventFormData, Venue, SavedLocation } from '../../../../types/events';
import { Field, inputClass, textareaClass, selectClass } from '../shared';
import SectionHeader from './SectionHeader';

export interface LocationSectionProps {
  areaHint: string | undefined;
  locationName: string | undefined;
  addressText: string | undefined;
  mapLink: string | undefined;
  guidelinesText: string | undefined;
  isOpen: boolean;
  venues: Venue[];
  editVenueId: string;
  editSpaceIds: string[];
  editVenueObj: Venue | undefined;
  editCombinedCapacity: number;
  savedLocations: SavedLocation[];
  selectedLocationId: string;
  showSaveLocation: boolean;
  savingLocation: boolean;
  onToggle: () => void;
  onUpdateField: (field: keyof EventFormData, value: any) => void;
  onLocationNameChange: (value: string) => void;
  onAddressTextChange: (value: string) => void;
  onOpenVenueManager: () => void;
  onVenueChange: (venueId: string) => void;
  onToggleSpace: (spaceId: string, capacity: number) => void;
  onSelectLocation: (locationId: string) => void;
  onShowSaveLocation: (show: boolean) => void;
  onSaveLocation: () => void;
}

const LocationSection: React.FC<LocationSectionProps> = ({
  areaHint,
  locationName,
  addressText,
  mapLink,
  guidelinesText,
  isOpen,
  venues,
  editVenueId,
  editSpaceIds,
  editVenueObj,
  editCombinedCapacity,
  savedLocations,
  selectedLocationId,
  showSaveLocation,
  savingLocation,
  onToggle,
  onUpdateField,
  onLocationNameChange,
  onAddressTextChange,
  onOpenVenueManager,
  onVenueChange,
  onToggleSpace,
  onSelectLocation,
  onShowSaveLocation,
  onSaveLocation,
}) => {
  return (
    <div className="border-b border-tea-border">
      <SectionHeader label="Location" isOpen={isOpen} onToggle={onToggle} />
      {isOpen && (
        <div className="pb-6 space-y-3">
          {/* Area hint (shown publicly before approval) */}
          <Field label="Area Hint (shown publicly before approval)">
            <input
              type="text"
              value={areaHint || ''}
              onChange={(e) => onUpdateField('areaHint', e.target.value)}
              className={inputClass}
              placeholder="Da'an District, Taipei"
            />
            <p className="text-ui-11 text-tea-text-dim mt-1.5">
              Guests need to know roughly where they're going before they RSVP.
              Without this (and no Location Name), they see no location at all on the public page.
            </p>
          </Field>

          {/* ── Venue picker ── */}
          <div className="pt-1 space-y-3">
            <div className="flex items-center justify-between">
              <label className="label-caps text-tea-text-sec">Venue</label>
              <button
                type="button"
                onClick={onOpenVenueManager}
                className="flex items-center gap-1 text-ui-10 text-tea-gold hover:text-tea-gold-lt transition-colors uppercase tracking-[0.15em]"
              >
                <MapPin size={10} /> Manage venues
              </button>
            </div>

            {venues.length === 0 ? (
              <div className="flex items-center justify-between py-1">
                <p className="text-xs text-tea-text-dim">No venues configured yet.</p>
                <button
                  type="button"
                  onClick={onOpenVenueManager}
                  className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-text border border-tea-border px-2.5 py-1.5 rounded-md hover:border-tea-gold/40 transition-colors"
                >
                  <MapPin size={11} /> Add venue
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <MapPin size={12} className="absolute left-0 top-1/2 -translate-y-1/2 text-tea-text-sec" />
                  <select
                    value={editVenueId}
                    onChange={(e) => onVenueChange(e.target.value)}
                    className={`${selectClass} pl-5`}
                  >
                    <option value="">No venue assigned…</option>
                    {venues.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-tea-text-sec pointer-events-none" />
                </div>

                {editVenueObj && editVenueObj.spaces.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="label-caps text-tea-text-sec">Spaces</p>
                      {editSpaceIds.length === 0 && (
                        <p className="text-ui-11 text-tea-gold">No spaces selected</p>
                      )}
                    </div>
                    {editSpaceIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {editVenueObj.spaces.filter(s => editSpaceIds.includes(s.id)).map(s => (
                          <span key={s.id} className="inline-flex items-center gap-1 text-ui-11 text-tea-gold">
                            {s.name} · {s.capacity}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="space-y-2">
                      {editVenueObj.spaces.map(space => {
                        const active = editSpaceIds.includes(space.id);
                        return (
                          <button
                            key={space.id}
                            type="button"
                            onClick={() => onToggleSpace(space.id, space.capacity)}
                            className={`w-full flex items-start gap-3 p-3 rounded-md border text-left transition-colors ${
                              active ? 'border-tea-gold bg-tea-gold/5 text-tea-text' : 'border-tea-border hover:border-tea-border text-tea-text-sec'
                            }`}
                          >
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
                    {editSpaceIds.length > 1 && (
                      <p className="text-ui-11 text-tea-text-sec">
                        Combined capacity: {editCombinedCapacity} seats
                      </p>
                    )}
                  </div>
                )}

                {editVenueObj && editVenueObj.spaces.length === 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-tea-text-dim">This venue has no spaces yet.</p>
                    <button
                      type="button"
                      onClick={onOpenVenueManager}
                      className="flex items-center gap-1.5 text-xs text-tea-gold hover:text-tea-gold-lt transition-colors"
                    >
                      <MapPin size={11} /> Add spaces
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="label-caps text-tea-text-sec">Manual Location</label>
            {locationName?.trim() && addressText?.trim() && !selectedLocationId && (
              <button
                type="button"
                onClick={() => onShowSaveLocation(true)}
                className="flex items-center gap-1 text-ui-10 text-tea-gold hover:text-tea-gold-lt transition-colors uppercase tracking-[0.15em]"
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
                onChange={(e) => onSelectLocation(e.target.value)}
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
            <div className="border-t border-tea-border pt-3 space-y-2">
              <p className="text-xs text-tea-text-sec">
                Save "{locationName}" as a reusable location?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => onShowSaveLocation(false)}
                  className="text-xs text-tea-text-sec hover:text-tea-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onSaveLocation}
                  disabled={savingLocation}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {savingLocation ? <Loader2 size={11} className="animate-spin" /> : <Bookmark size={11} />}
                  Save Location
                </button>
              </div>
            </div>
          )}

          <input
            type="text"
            value={locationName || ''}
            onChange={(e) => onLocationNameChange(e.target.value)}
            className={inputClass}
            placeholder="Location name"
          />
          <input
            type="text"
            value={addressText || ''}
            onChange={(e) => onAddressTextChange(e.target.value)}
            className={inputClass}
            placeholder="Address"
          />
          <input
            type="text"
            value={mapLink || ''}
            onChange={(e) => onUpdateField('mapLink', e.target.value)}
            className={inputClass}
            placeholder="Map link"
          />
          <Field label="Guidelines">
            <textarea
              value={guidelinesText || ''}
              onChange={(e) => onUpdateField('guidelinesText', e.target.value)}
              className={textareaClass}
              placeholder="Dress code, what to bring, etc."
              rows={3}
            />
          </Field>
        </div>
      )}
    </div>
  );
};

export default React.memo(LocationSection);
