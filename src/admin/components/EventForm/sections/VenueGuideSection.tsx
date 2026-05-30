import React from 'react';
import { X, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { VenueGuide, VenueGuideStep } from '../../../../types/events';
import { Field, inputClass } from '../shared';
import SectionHeader from './SectionHeader';

export interface VenueGuideSectionProps {
  venueGuide: VenueGuide;
  isOpen: boolean;
  venueStepUploading: number | null;
  venueStepFileRefs: React.MutableRefObject<Record<number, HTMLInputElement | null>>;
  onToggle: () => void;
  onAddVenueStep: () => void;
  onUpdateVenueStep: (idx: number, field: keyof VenueGuideStep, value: string) => void;
  onRemoveVenueStep: (idx: number) => void;
  onVenueStepImageUpload: (idx: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpdateVenueGuide: (next: VenueGuide) => void;
}

const VenueGuideSection: React.FC<VenueGuideSectionProps> = ({
  venueGuide,
  isOpen,
  venueStepUploading,
  venueStepFileRefs,
  onToggle,
  onAddVenueStep,
  onUpdateVenueStep,
  onRemoveVenueStep,
  onVenueStepImageUpload,
  onUpdateVenueGuide,
}) => {
  return (
    <div className="border-b border-tea-border">
      <SectionHeader label="Venue Guide" count={venueGuide.steps.length} isOpen={isOpen} onToggle={onToggle} />
      {isOpen && (
        <div className="pb-6 space-y-4">
          {venueGuide.steps.map((step, idx) => (
            <div key={idx} className="flex gap-3 items-start">
              <span className="text-ui-10 text-tea-text-sec mt-2 w-4 shrink-0">{idx + 1}.</span>
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={step.description}
                  onChange={(e) => onUpdateVenueStep(idx, 'description', e.target.value)}
                  className={inputClass}
                  placeholder="Step description"
                />
                {step.image_url ? (
                  <div className="relative w-full h-24 rounded-md overflow-hidden border border-tea-border">
                    <img src={step.image_url} alt={`Step ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                    <button
                      type="button"
                      onClick={() => onUpdateVenueStep(idx, 'image_url', '')}
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
                  onChange={(e) => onVenueStepImageUpload(idx, e)}
                  className="hidden"
                />
              </div>
              <button type="button" aria-label="Remove step" onClick={() => onRemoveVenueStep(idx)} className="text-tea-text-sec hover:text-tea-text p-1 mt-1 tap-target">
                <Trash2 size={12} />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={onAddVenueStep}
            className="flex items-center gap-1 text-xs text-tea-gold hover:text-tea-gold-lt transition-colors"
          >
            <Plus size={12} /> Add Step
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-tea-border">
            <Field label="Parking Notes">
              <input
                type="text"
                value={venueGuide.parking_notes || ''}
                onChange={(e) => onUpdateVenueGuide({ ...venueGuide, parking_notes: e.target.value })}
                className={inputClass}
                placeholder="Free parking available"
              />
            </Field>
            <Field label="Transit Notes">
              <input
                type="text"
                value={venueGuide.transit_notes || ''}
                onChange={(e) => onUpdateVenueGuide({ ...venueGuide, transit_notes: e.target.value })}
                className={inputClass}
                placeholder="Take the Blue Line"
              />
            </Field>
            <Field label="Arrival Notes">
              <input
                type="text"
                value={venueGuide.arrival_notes || ''}
                onChange={(e) => onUpdateVenueGuide({ ...venueGuide, arrival_notes: e.target.value })}
                className={inputClass}
                placeholder="Ring the bell"
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(VenueGuideSection);
