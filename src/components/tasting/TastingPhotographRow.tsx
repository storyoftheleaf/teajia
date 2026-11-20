import React from 'react';
import type { FamilyPhotograph, FamilyPhotographFrame, FamilyPhotographShape } from '../../lib/familyContract';
import { Button } from '../shared/Button';
import { PhotographCrop, PhotographThumb, PhotographZoom, type ZoomPhotograph } from '../shared/Photographs';
import { mediaUrl } from '../../lib/mediaUrl';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

/** The short page Stage 7 writes. The link is a plain address so the tasting stays open behind it. */
export const HOW_WE_USE_PHOTOGRAPHS_PATH = '/photographs';
export const NOTES_NOTICE = 'Notes may be used to help describe the tea and help others learn about it.';

/**
 * "Your photographs": the same label and box as "Your notes", placed above it on
 * the Impression page. The camera in the header adds to it from every page.
 * The thumbnails are small and bare. Tapping one opens it, and "Remove from my
 * page" is offered there, in the zoom, never under the thumbnail.
 */
export function TastingPhotographRow({ photos, busy, onRemove, onShape }: {
  photos: FamilyPhotograph[];
  busy: boolean;
  onRemove: (id: string) => void;
  /** Square is the default; "Crop" in the zoom frames it and offers 2:3 and 3:2. */
  onShape?: (id: string, shape: FamilyPhotographShape, frame: FamilyPhotographFrame | null) => Promise<void> | void;
}) {
  const labelId = React.useId();
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
    <span id={labelId} className={`${TYPOGRAPHY_CLASSES.label} tasting-impression-photos-label`}>Your photographs</span>
    <div className="tasting-photo-box">
      {photos.length === 0 && !busy && <p className={TYPOGRAPHY_CLASSES.accountMeta}>Tap the camera at the top to add one.</p>}
      {photos.map(photo => <PhotographThumb key={photo.id} photo={toZoom(photo)} size="tasting" onOpen={setOpenId} testId="tasting-photograph" />)}
      {busy && <p className={TYPOGRAPHY_CLASSES.accountMeta} role="status">Adding your photograph…</p>}
      {/* The whole notice is this one link, inside the box the photographs sit in. */}
      <a className={`${TYPOGRAPHY_CLASSES.accountMeta} tasting-photo-box-link`} href={HOW_WE_USE_PHOTOGRAPHS_PATH} target="_blank" rel="noopener noreferrer">How we use photographs</a>
    </div>
    <PhotographZoom photo={open ? toZoom(open) : null} onClose={() => setOpenId(null)}>
      {open && (
        <div className="photo-zoom__actions">
          {onShape && <PhotographCrop photo={toZoom(open)} onSave={(shape, frame) => onShape(open.id, shape, frame)} />}
          <Button variant="quiet" size="sm" type="button" data-testid="photograph-remove" onClick={() => { onRemove(open.id); setOpenId(null); }}>Remove from my page</Button>
        </div>
      )}
    </PhotographZoom>
  </div>;
}
