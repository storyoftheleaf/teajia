import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { mediaUrl } from '../../lib/mediaUrl';
import { Button } from '../shared/Button';
import { PhotographCrop, PhotographShapeChoice, PhotographThumb, PhotographZoom, type ZoomPhotograph } from '../shared/Photographs';
import { PHOTO_QUIET } from '../shared/photoWords';
import type { FamilyPhotographFrame, FamilyPhotographShape } from '../../lib/familyContract';
import { SoldOutLine } from '../people/PersonTastings';
import { personPath, type TeaRowPhotograph } from './useTeaFamily';

// What sits under the tea's plaque: one quiet row of photographs, the way the
// work hangs beside its label. Nothing is written on the row. Tapping a
// photograph opens it, and the zoom is the one place that says who took it and,
// on the reader's own, offers "Use as my cover" and "Remove from my page".

/** How many show before the row offers the rest. A row, never a wall. */
const ROW_LIMIT = 8;

export function TeaPhotographRow({
  photographs, teaName, onChooseCover, onRemove, onShape, onShare, addPhoto, inline = false,
}: {
  photographs: TeaRowPhotograph[];
  addPhoto?: ReactNode;
  /** Sit inside another strip (the shop's thumbnails) instead of a row of its own. */
  inline?: boolean;
  teaName: string;
  onChooseCover: (photographId: string | null) => void;
  onShare?: (photographId: string, choice: 'page' | 'private') => Promise<void>;
  onRemove: (photographId: string) => Promise<void>;
  onShape: (photographId: string, shape: FamilyPhotographShape, frame: FamilyPhotographFrame | null) => Promise<void> | void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [removeFailed, setRemoveFailed] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const [sharing, setSharing] = useState(false);
  if (photographs.length === 0) return null;

  const toZoom = (p: TeaRowPhotograph): ZoomPhotograph => ({
    id: p.id,
    smallSrc: mediaUrl(p.small_url),
    fullSrc: mediaUrl(p.full_url),
    width: p.width,
    height: p.height,
    shape: p.shape,
    frame: p.frame,
    alt: p.mine ? `Your photograph of ${teaName}` : `${teaName}, photographed by ${p.author?.name ?? 'the family'}`,
  });
  const shown = showAll ? photographs : photographs.slice(0, ROW_LIMIT);
  const more = photographs.length - shown.length;
  const open = photographs.find(p => p.id === openId) ?? null;
  const href = open?.author ? personPath(open.author.page_id) : null;
  const close = () => { setOpenId(null); setRemoveFailed(false); setShareFailed(false); };

  return (
    <div className={inline ? 'contents' : 'mx-5 mt-3 lg:mx-6'} data-testid="tea-photographs">
      <ul className={inline ? 'photo-row photo-row--inline' : 'photo-row'} aria-label={`Photographs of ${teaName}`}>
        {shown.map(photo => (
          <li key={photo.id} data-mine={photo.mine ? 'true' : undefined} data-cover={photo.isCover ? 'true' : undefined} data-lead={photo.isLead ? 'true' : undefined}>
            <PhotographThumb photo={toZoom(photo)} onOpen={setOpenId} testId="tea-photograph" />
          </li>
        ))}
        {more > 0 && (
          <li className="flex self-stretch">
            <Button variant="quiet" size="sm" type="button" onClick={() => setShowAll(true)} data-testid="tea-photographs-more">{more} more</Button>
          </li>
        )}
        {addPhoto && <li>{addPhoto}</li>}
      </ul>

      <PhotographZoom photo={open ? toZoom(open) : null} onClose={close}>
        {open && !open.mine && open.author && (
          <p className="photo-zoom__credit" data-testid="photograph-credit">
            Photograph by{' '}
            {href ? <Link to={href} onClick={close}>{open.author.name}</Link> : open.author.name}
          </p>
        )}
        {open?.mine && (
          <>
            <PhotographShapeChoice shape={open.shape} onChoose={shape => onShape(open.id, shape, null)} />
            <div className="photo-zoom__actions">
              <PhotographCrop photo={toZoom(open)} onSave={(shape, frame) => onShape(open.id, shape, frame)} />
              {onShare && open.shareState !== 'offered' && (
                <Button variant="plain" type="button" className={PHOTO_QUIET} disabled={sharing}
                  onClick={async () => {
                    setShareFailed(false);
                    setSharing(true);
                    try { await onShare(open.id, open.shareState === 'page' ? 'private' : 'page'); }
                    catch { setShareFailed(true); }
                    finally { setSharing(false); }
                  }}>
                  {open.shareState === 'page' ? 'Make private' : 'Share on my page and this listing'}
                </Button>
              )}
              {open.isCover ? (
                <Button variant="plain" type="button" className={PHOTO_QUIET} onClick={() => onChooseCover(null)} data-testid="cover-clear">Stop using as my cover</Button>
              ) : (
                <Button variant="plain" type="button" className={PHOTO_QUIET} onClick={() => onChooseCover(open.id)} data-testid="cover-choose">Use as my cover</Button>
              )}
              <Button
                variant="plain"
                type="button"
                className={`${PHOTO_QUIET} photo-zoom__last`}
                data-testid="photograph-remove"
                onClick={() => {
                  setRemoveFailed(false);
                  onRemove(open.id).then(close, () => setRemoveFailed(true));
                }}
              >
                Remove from my page
              </Button>
            </div>
            {shareFailed && <p role="alert" className="photo-zoom__note">Sharing could not be updated. Try again.</p>}
            {removeFailed && <p role="alert" className="photo-zoom__note">That did not go through. Try again.</p>}
          </>
        )}
      </PhotographZoom>
    </div>
  );
}

