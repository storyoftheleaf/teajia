import React from 'react';
import type { FamilyPhotograph } from '../../lib/familyContract';
import { Button } from '../shared/Button';
import { mediaUrl } from '../../lib/mediaUrl';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

/** The short page Stage 7 writes. The link is a plain address so the tasting stays open behind it. */
export const HOW_WE_USE_PHOTOGRAPHS_PATH = '/photographs';
export const PHOTOGRAPH_NOTICE = 'Photographs you add may be shown on Teajia, with your name.';
export const NOTES_NOTICE = 'Notes may be used to help describe the tea and help others learn about it.';

/**
 * "Your photographs": the same label and box as "Your notes", placed above it on
 * the Impression page. The camera in the header adds to it from every page.
 */
export function TastingPhotographRow({ photos, busy, onRemove }: {
  photos: FamilyPhotograph[];
  busy: boolean;
  onRemove: (id: string) => void;
}) {
  const labelId = React.useId();
  return <div className="tasting-impression-notes tasting-impression-photos" role="group" aria-labelledby={labelId}>
    <span id={labelId} className={`${TYPOGRAPHY_CLASSES.label} tasting-impression-photos-label`}>Your photographs</span>
    <div className="tasting-photo-box">
      {photos.length === 0 && !busy && <p className={TYPOGRAPHY_CLASSES.accountMeta}>Tap the camera at the top to add one.</p>}
      {photos.map(photo => <figure className="tasting-photo" key={photo.id}>
        <img src={mediaUrl(photo.small_url)} alt="Your photograph of this tea" width={photo.small_width} height={photo.small_height} loading="lazy" />
        <Button variant="plain" type="button" className="tap-target" onClick={() => onRemove(photo.id)}>Remove from my page</Button>
      </figure>)}
      {busy && <p className={TYPOGRAPHY_CLASSES.accountMeta} role="status">Adding your photograph…</p>}
    </div>
    <p className={`${TYPOGRAPHY_CLASSES.accountMeta} tasting-impression-notice`}>
      {PHOTOGRAPH_NOTICE}{' '}
      <a href={HOW_WE_USE_PHOTOGRAPHS_PATH} target="_blank" rel="noopener noreferrer">How we use photographs</a>
    </p>
  </div>;
}
