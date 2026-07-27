import React from 'react';
import { X, Loader2, Plus, ChevronDown, Upload } from 'lucide-react';
import { EventFormData, EventStatus, EventFormat, GatheringType } from '../../../../types/events';
import { Field, inputClass, textareaClass, selectClass, STATUS_OPTIONS } from '../shared';
import SectionHeader from './SectionHeader';

export interface BasicInfoSectionProps {
  slug: string;
  title: string;
  subtitle: string | undefined;
  description: string | undefined;
  eventDate: string;
  durationHours: number;
  totalCapacity: number;
  claimWindowMinutes: number;
  status: EventStatus;
  format: EventFormat | undefined;
  gatheringType: GatheringType | undefined;
  flyerImageUrl: string | undefined;
  requiresApproval: boolean;
  repeatDates: string[];
  uploading: boolean;
  isOpen: boolean;
  titleRef: React.RefObject<HTMLInputElement>;
  dateRef: React.RefObject<HTMLInputElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onToggle: () => void;
  onUpdateField: (field: keyof EventFormData, value: any) => void;
  onSlugChange: (value: string) => void;
  onDurationChange: (hours: number) => void;
  onRepeatDatesChange: React.Dispatch<React.SetStateAction<string[]>>;
  onRequiresApprovalChange: (value: boolean) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({
  slug,
  title,
  subtitle,
  description,
  eventDate,
  durationHours,
  totalCapacity,
  claimWindowMinutes,
  status,
  format,
  gatheringType,
  flyerImageUrl,
  requiresApproval,
  repeatDates,
  uploading,
  isOpen,
  titleRef,
  dateRef,
  fileInputRef,
  onToggle,
  onUpdateField,
  onSlugChange,
  onDurationChange,
  onRepeatDatesChange,
  onRequiresApprovalChange,
  onImageUpload,
}) => {
  return (
    <div className="border-b border-tea-border">
      <SectionHeader label="Basic Info" isOpen={isOpen} onToggle={onToggle} />
      {isOpen && (
        <div className="pb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {/* Left */}
            <div className="space-y-4">
              <Field label="Slug">
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => onSlugChange(e.target.value)}
                  className={inputClass}
                  placeholder="auto-generated-from-title"
                />
                <p className="text-ui-10 text-tea-text-dim mt-1">Must be unique. Used in public event URLs.</p>
              </Field>
              <Field label="Title" required>
                <input
                  ref={titleRef}
                  type="text"
                  value={title}
                  onChange={(e) => onUpdateField('title', e.target.value)}
                  className={inputClass}
                  placeholder="Spring Tea Tasting"
                  required
                  aria-required="true"
                  maxLength={80}
                />
                <div className={`text-right text-ui-10 mt-0.5 ${(title || '').length > 70 ? 'text-tea-gold' : 'text-tea-text-dim'}`}>
                  {(title || '').length}/80
                </div>
              </Field>
              <Field label="Subtitle">
                <input
                  type="text"
                  value={subtitle || ''}
                  onChange={(e) => onUpdateField('subtitle', e.target.value)}
                  className={inputClass}
                  placeholder="A journey through Wuyi oolongs"
                  maxLength={120}
                />
                <div className={`text-right text-ui-10 mt-0.5 ${(subtitle || '').length > 100 ? 'text-tea-gold' : 'text-tea-text-dim'}`}>
                  {(subtitle || '').length}/120
                </div>
              </Field>
              <Field label="Description">
                <textarea
                  value={description || ''}
                  onChange={(e) => onUpdateField('description', e.target.value)}
                  className={textareaClass}
                  placeholder="Describe the event..."
                  rows={3}
                  maxLength={500}
                />
                <div className={`text-right text-ui-10 mt-0.5 ${(description || '').length > 450 ? 'text-tea-gold' : 'text-tea-text-dim'}`}>
                  {(description || '').length}/500
                </div>
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Start Date & Time" required>
                  <input
                    ref={dateRef}
                    type="datetime-local"
                    value={eventDate}
                    onChange={(e) => onUpdateField('eventDate', e.target.value)}
                    className={inputClass}
                    required
                    aria-required="true"
                  />
                </Field>
                <Field label="Duration">
                  <div className="relative">
                    <select
                      value={durationHours}
                      onChange={(e) => onDurationChange(parseFloat(e.target.value))}
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
                      onClick={() => onRepeatDatesChange([])}
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
                      onClick={() => { if (repeatDates.length === 0) onRepeatDatesChange(['']); }}
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
                          onChange={(e) => onRepeatDatesChange(prev => { const next = [...prev]; next[i] = e.target.value; return next; })}
                          className={`${inputClass} flex-1`}
                        />
                        <button
                          type="button"
                          aria-label="Remove date"
                          onClick={() => onRepeatDatesChange(prev => prev.filter((_, j) => j !== i))}
                          className="text-tea-text-sec hover:text-tea-text transition-colors tap-target"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => onRepeatDatesChange(prev => [...prev, ''])}
                      className="flex items-center gap-1 text-xs text-tea-gold hover:text-tea-gold-lt transition-colors"
                    >
                      <Plus size={12} /> Add date
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Capacity">
                  <input
                    type="number"
                    value={totalCapacity}
                    onChange={(e) => onUpdateField('totalCapacity', parseInt(e.target.value) || 12)}
                    className={inputClass}
                    min={1}
                  />
                </Field>
                <Field label="Claim Window (min)">
                  <input
                    type="number"
                    value={claimWindowMinutes}
                    onChange={(e) => onUpdateField('claimWindowMinutes', parseInt(e.target.value) || 60)}
                    className={inputClass}
                    min={5}
                  />
                </Field>
                <Field label="Status">
                  <div className="relative">
                    <select
                      value={status}
                      onChange={(e) => onUpdateField('status', e.target.value as EventStatus)}
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
              <Field label="Format">
                <select
                  value={format || 'private_tasting'}
                  onChange={e => onUpdateField('format', e.target.value as EventFormat)}
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
              <Field label="Gathering Type">
                <p className="text-ui-11 text-tea-text-dim mb-2">Intimacy &amp; access level</p>
                <div className="flex gap-4 pt-1" role="radiogroup" aria-label="Gathering Type">
                  {(['private', 'semi-private', 'open', 'bespoke'] as GatheringType[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={(gatheringType || 'private') === opt}
                      onClick={() => onUpdateField('gatheringType', opt)}
                      className={`text-ui-11 font-medium capitalize transition-colors pb-0.5 ${
                        (gatheringType || 'private') === opt
                          ? 'text-tea-gold border-b border-tea-gold'
                          : 'text-tea-text-sec hover:text-tea-text'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </Field>
              <label className="flex items-start gap-3 cursor-pointer group pt-1">
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(e) => onRequiresApprovalChange(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded-md border border-tea-border bg-tea-surface accent-tea-gold cursor-pointer"
                />
                <span className="space-y-0.5">
                  <span className="block text-sm text-tea-text group-hover:text-tea-text transition-colors">Requires approval before confirmed</span>
                  <span className="block text-ui-11 text-tea-text-dim">When off, guests are confirmed instantly (subject to capacity).</span>
                </span>
              </label>
            </div>
            {/* Right: Flyer */}
            <div className="space-y-4">
              <Field label="Flyer Image">
                {flyerImageUrl ? (
                  <div className="relative w-full rounded-md overflow-hidden border border-tea-border bg-tea-bg">
                    <img src={flyerImageUrl} alt="Flyer" className="w-full max-h-64 object-contain" loading="lazy" />
                    <button
                      type="button"
                      onClick={() => onUpdateField('flyerImageUrl', '')}
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
                <input ref={fileInputRef} type="file" accept="image/*" onChange={onImageUpload} className="hidden" />
              </Field>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(BasicInfoSection);
