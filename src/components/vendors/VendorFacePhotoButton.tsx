import React, { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Button } from '../shared/Button';
import { saveVendorFace, useRefreshVendorFaces } from './vendorFaces';

/**
 * Add or change a vendor's face photo. Opens the phone's camera or photo
 * library (no `capture` lock, so either works), squares and shrinks the
 * picture, uploads it and saves it on the vendor. Says so when it fails, so a
 * photo that didn't land on a poor connection never looks saved.
 */
export const VendorFacePhotoButton: React.FC<{
  vendorId: string;
  vendorName: string;
  hasFace: boolean;
  onSaved?: (url: string) => void;
  /** `word` is a labelled button; `badge` is the small camera on a face tile. */
  look?: 'word' | 'badge';
  className?: string;
}> = ({ vendorId, vendorName, hasFace, onSaved, look = 'word', className = '' }) => {
  const input = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const refresh = useRefreshVendorFaces();

  const pick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setSaving(true);
    setError('');
    try {
      const url = await saveVendorFace(vendorId, file);
      refresh(vendorId);
      onSaved?.(url);
    } catch {
      setError("The photo didn't save. Check the connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const label = saving ? 'Saving photo…' : hasFace ? 'Change face photo' : 'Add face photo';
  return (
    <span className={`inline-flex flex-col items-start ${className}`}>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={pick} aria-hidden="true" tabIndex={-1} />
      {look === 'badge' ? (
        <Button
          type="button"
          variant="icon"
          onClick={() => input.current?.click()}
          disabled={saving}
          aria-label={`${label}: ${vendorName}`}
          title={label}
          className="rounded-full bg-tea-surface border-tea-border hover:border-tea-gold"
          icon={saving ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} strokeWidth={1.5} />}
        />
      ) : (
        <Button
          type="button"
          variant="secondary"
          onClick={() => input.current?.click()}
          disabled={saving}
          icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} strokeWidth={1.5} />}
        >
          {label}
        </Button>
      )}
      {error && <span role="alert" className="mt-1 text-ui-12 text-tea-text-sec">{error}</span>}
    </span>
  );
};
