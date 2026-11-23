import React from 'react';
import type { FamilyPhotograph, FamilyPhotographFrame, FamilyPhotographShape } from '../../lib/familyContract';
import { Button } from '../shared/Button';
import { PhotographCrop, PhotographShapeChoice, PhotographThumb, PhotographZoom, type ZoomPhotograph } from '../shared/Photographs';
import { PHOTO_QUIET } from '../shared/photoWords';
import { mediaUrl } from '../../lib/mediaUrl';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

export const NOTES_NOTICE = 'Notes may be used to help describe the tea and help others learn about it.';

/**
 * Private photo upload and thumbnails for the Impression page.
 * Reframing and removal are available when the author opens a photo.
 */
export function TastingPhotographRow({ photos, busy, onAdd, onRemove, onShape }: {
  photos: FamilyPhotograph[];
  busy: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  /** Square is the default; "Crop" in the zoom frames it and offers 2:3 and 3:2. */
  onShape?: (id: string, shape: FamilyPhotographShape, frame: FamilyPhotographFrame | null) => Promise<void> | void;
}) {
  const labelId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const toZoom = (photo: FamilyPhotograph): ZoomPhotograph => ({
    id: photo.id,
    smallSrc: mediaUrl(photo.small_url),
    fullSrc: mediaUrl(photo.full_url),
    width: photo.small_width,
    height: photo.small_height,
    alt: 'Your photograph of this tea',
    shape: photo.shape,
    frame: photo.frame,
  });
  const open = photos.find(photo => photo.id === openId) ?? null;
  return <div className="tasting-impression-notes tasting-impression-photos" role="group" aria-labelledby={labelId}>
    <div className="tasting-photo-heading">
      <span id={labelId} className={TYPOGRAPHY_CLASSES.label}>Your photographs</span>
      <Button variant="secondary" size="sm" type="button" className="tap-target" disabled={busy} onClick={() => inputRef.current?.click()}>
        Add photographs
      </Button>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden data-testid="tasting-photo-input"
        onChange={event => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          if (files.length) onAdd(files);
        }} />
    </div>
    {(photos.length > 0 || busy) && (
      <div className="tasting-photo-box">
        {photos.map(photo => <PhotographThumb key={photo.id} photo={toZoom(photo)} size="tasting" onOpen={setOpenId} testId="tasting-photograph" />)}
        {busy && <p className={TYPOGRAPHY_CLASSES.accountMeta} role="status">Adding your photograph…</p>}
      </div>
    )}
    <PhotographZoom photo={open ? toZoom(open) : null} onClose={() => setOpenId(null)}>
      {open && onShape && <PhotographShapeChoice shape={open.shape} onChoose={shape => onShape(open.id, shape, null)} />}
      {open && (
        <div className="photo-zoom__actions">
          {onShape && <PhotographCrop photo={toZoom(open)} onSave={(shape, frame) => onShape(open.id, shape, frame)} />}
          <Button variant="plain" type="button" className={`${PHOTO_QUIET} photo-zoom__last`} data-testid="photograph-remove" onClick={() => { onRemove(open.id); setOpenId(null); }}>Remove from my page</Button>
        </div>
      )}
    </PhotographZoom>
  </div>;
}
