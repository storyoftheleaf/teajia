import React from 'react';
import { EventFormData, EventStatus, EventFormat, GatheringType } from '../../../types/events';

export function computeEndDate(startDate: string, hours: number): string {
  if (!startDate) return '';
  const d = new Date(startDate);
  d.setMinutes(d.getMinutes() + Math.round(hours * 60));
  return d.toISOString().slice(0, 16);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export const emptyForm: EventFormData = {
  slug: '',
  title: '',
  subtitle: '',
  description: '',
  eventDate: '',
  eventEndDate: '',
  totalCapacity: 12,
  claimWindowMinutes: 60,
  status: 'draft',
  format: 'private_tasting' as EventFormat,
  gatheringType: 'private' as GatheringType,
  flyerImageUrl: '',
  locationName: '',
  addressText: '',
  mapLink: '',
  guidelinesText: '',
  areaHint: '',
  venueGuide: { steps: [], parking_notes: '', transit_notes: '', arrival_notes: '' },
  sessionFlow: [],
};

export const STATUS_OPTIONS: EventStatus[] = ['draft', 'active', 'closed', 'archived'];

export const Field = ({
  label,
  children,
  className = '',
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
}) => (
  <div className={className}>
    <label className="label-caps text-tea-text-sec block mb-1.5">
      {label}
      {required && (
        <>
          {' '}
          <span aria-hidden="true">*</span>
          <span className="sr-only"> (required)</span>
        </>
      )}
    </label>
    {children}
  </div>
);

export const inputClass = 'w-full border-b border-tea-border bg-transparent focus:border-tea-gold outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg text-sm text-tea-text py-2 placeholder:text-tea-text-sec/50 [color-scheme:dark]';
export const textareaClass = 'w-full border-b border-tea-border bg-transparent focus:border-tea-gold outline-none focus-visible:ring-0 text-sm text-tea-text py-2 placeholder:text-tea-text-sec/50 resize-y min-h-[80px]';
export const selectClass = 'w-full border-b border-tea-border bg-transparent focus:border-tea-gold outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg text-sm text-tea-text py-2 appearance-none cursor-pointer [color-scheme:dark]';
