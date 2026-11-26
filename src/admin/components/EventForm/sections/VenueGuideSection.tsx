import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { VenueGuide, VenueGuideStep } from '../../../../types/events';
import { Field, inputClass } from '../shared';
import SectionHeader from './SectionHeader';
import { WayStepPhoto } from '../../../../components/events/WayStepPhoto';

export interface VenueGuideSectionProps {
  venueGuide: VenueGuide;
  isOpen: boolean;
  onToggle: () => void;
  onAddVenueStep: () => void;
  onUpdateVenueStep: (idx: number, field: keyof VenueGuideStep, value: string) => void;
  onRemoveVenueStep: (idx: number) => void;
  /** Uploads a step photograph already framed in the shared photo editor. */
  uploadVenueStepPhoto: (file: File) => Promise<string>;
  onVenueStepPhotoFailed: (message: string) => void;
  onUpdateVenueGuide: (next: VenueGuide) => void;
}

const VenueGuideSection: React.FC<VenueGuideSectionProps> = ({
  venueGuide,
  isOpen,
  onToggle,
  onAddVenueStep,
  onUpdateVenueStep,
  onRemoveVenueStep,
  uploadVenueStepPhoto,
  onVenueStepPhotoFailed,
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
                {/* Every step photograph opens in the shared photo editor first. */}
                <WayStepPhoto
                  step={idx + 1}
                  imageUrl={step.image_url}
                  compact
                  upload={uploadVenueStepPhoto}
                  onError={onVenueStepPhotoFailed}
                  onChange={(url) => onUpdateVenueStep(idx, 'image_url', url)}
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
