import { useState } from 'react';
import { Link } from 'react-router-dom';
import { mediaUrl } from '../../lib/mediaUrl';
import { Button } from '../shared/Button';
import { PhotographCrop, PhotographThumb, PhotographZoom, type ZoomPhotograph } from '../shared/Photographs';
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
  photographs, teaName, onChooseCover, onRemove, onShape,
}: {
  photographs: TeaRowPhotograph[];
  teaName: string;
  onChooseCover: (photographId: string | null) => void;
  onRemove: (photographId: string) => Promise<void>;
  onShape: (photographId: string, shape: FamilyPhotographShape, frame: FamilyPhotographFrame | null) => Promise<void> | void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [removeFailed, setRemoveFailed] = useState(false);
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
  const close = () => { setOpenId(null); setRemoveFailed(false); };

  return (
    <div className="mx-5 mt-3 lg:mx-6" data-testid="tea-photographs">
      <ul className="photo-row" aria-label={`Photographs of ${teaName}`}>
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
            <div className="photo-zoom__actions">
              <PhotographCrop photo={toZoom(open)} onSave={(shape, frame) => onShape(open.id, shape, frame)} />
              {open.isCover ? (
                <Button variant="secondary" size="sm" type="button" onClick={() => onChooseCover(null)} data-testid="cover-clear">Stop using as my cover</Button>
              ) : (
                <Button variant="secondary" size="sm" type="button" onClick={() => onChooseCover(open.id)} data-testid="cover-choose">Use as my cover</Button>
              )}
              <Button
                variant="quiet"
                size="sm"
                type="button"
                data-testid="photograph-remove"
                onClick={() => {
                  setRemoveFailed(false);
                  onRemove(open.id).then(close, () => setRemoveFailed(true));
                }}
              >
                Remove from my page
              </Button>
            </div>
            {removeFailed && <p role="alert" className="photo-zoom__note">That did not go through. Try again.</p>}
          </>
        )}
      </PhotographZoom>
    </div>
  );
}

/** "Gone from the shop." with its one action, under the plaque on a sold-out tea. */
export function SoldOutUnderPlate({ productId, name }: { productId: string; name: string }) {
  return (
    <div className="mx-5 mt-3 lg:mx-6">
      <SoldOutLine productId={productId} name={name} />
    </div>
  );
}
