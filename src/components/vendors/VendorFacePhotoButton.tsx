import React, { useRef, useState } from 'react';
import { Camera, Crop, Loader2 } from 'lucide-react';
import type { ApiRequestInit } from '../../lib/api';
import { Button } from '../shared/Button';
import { usePhotoEditor } from '../shared/usePhotoEditor';
import { mediaUrl } from '../../lib/mediaUrl';
import { saveVendorFace, useRefreshVendorFaces } from './vendorFaces';

/**
 * Add or change a vendor's face photo. Opens the phone's camera or photo
 * library (no `capture` lock, so either works), then the shared photo editor
 * already centred on the face, to crop, drag and zoom; then uploads it and
 * saves it on the vendor. Says so when it fails, so a
 * photo that didn't land on a poor connection never looks saved.
 */
export const VendorFacePhotoButton: React.FC<{
  vendorId: string;
  vendorName: string;
  hasFace: boolean;
  onSaved?: (url: string) => void;
  /** `word` is a labelled button; `badge` is the small camera on a face tile. */
  look?: 'word' | 'badge' | 'inline';
  expectedAuth?: ApiRequestInit['expectedAuth'];
  className?: string;
}> = ({ vendorId, vendorName, hasFace, onSaved, look = 'word', className = '', expectedAuth }) => {
  const input = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const refresh = useRefreshVendorFaces();
  const { editPhoto, photoEditor } = usePhotoEditor({ outputSize: 800, title: `${vendorName}'s face`, confirmLabel: 'Save face' });

  const pick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const framed = await editPhoto(file);
    if (!framed) return;
    setSaving(true);
    setError('');
    try {
      const url = await saveVendorFace(vendorId, framed, expectedAuth, { framed: true });
      refresh(vendorId);
      onSaved?.(url);
    } catch {
      setError("The photo didn't save. Check the connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const photo = look === 'inline' ? 'photo' : 'face photo';
  const label = saving ? 'Saving photo…' : (hasFace ? 'Change ' : 'Add ') + photo;
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
          variant={look === 'inline' ? 'quiet' : 'secondary'}
          size={look === 'inline' ? 'sm' : undefined}
          onClick={() => input.current?.click()}
          disabled={saving}
          icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} strokeWidth={1.5} />}
        >
          {label}
        </Button>
      )}
      {error && <span role="alert" className="mt-1 text-ui-12 text-tea-text-sec">{error}</span>}
      {photoEditor}
    </span>
  );
};

/**
 * Reframe the photo a vendor already shows: opens it in the shared photo
 * editor to crop in, drag and zoom, and saves the result as their face. Works
 * on the face grid's tiles directly, so nothing has to be opened first.
 */
export const VendorFaceAdjustButton: React.FC<{
  vendorId: string;
  vendorName: string;
  photo: string;
  onSaved?: (url: string) => void;
  /** `badge` is the small round button on a face tile; `inline` a quiet word. */
  look?: 'badge' | 'inline';
  expectedAuth?: ApiRequestInit['expectedAuth'];
  className?: string;
}> = ({ vendorId, vendorName, photo, onSaved, look = 'badge', expectedAuth, className = '' }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const refresh = useRefreshVendorFaces();
  const { editPhoto, photoEditor } = usePhotoEditor({ outputSize: 800, title: `${vendorName}'s face`, confirmLabel: 'Save face' });

  const adjust = async () => {
    const framed = await editPhoto(mediaUrl(photo));
    if (!framed) return;
    setSaving(true);
    setError('');
    try {
      const url = await saveVendorFace(vendorId, framed, expectedAuth, { framed: true });
      refresh(vendorId);
      onSaved?.(url);
    } catch {
      setError("The new framing didn't save. Check the connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const label = saving ? 'Saving photo…' : 'Crop and reposition';
  return (
    <span className={`inline-flex flex-col items-start ${className}`}>
      {look === 'badge' ? (
        <Button
          type="button"
          variant="icon"
          onClick={() => void adjust()}
          disabled={saving}
          aria-label={`${label}: ${vendorName}`}
          title={label}
          className="rounded-full bg-tea-surface border-tea-border hover:border-tea-gold"
          icon={saving ? <Loader2 size={15} className="animate-spin" /> : <Crop size={15} strokeWidth={1.5} />}
        />
      ) : (
        <Button
          type="button" variant="quiet" size="sm" onClick={() => void adjust()} disabled={saving}
          icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Crop size={14} strokeWidth={1.5} />}
        >
          {saving ? 'Saving photo…' : 'Crop and reposition'}
        </Button>
      )}
      {error && <span role="alert" className="mt-1 text-ui-12 text-tea-text-sec">{error}</span>}
      {photoEditor}
    </span>
  );
};
