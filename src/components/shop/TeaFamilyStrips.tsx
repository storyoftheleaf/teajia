import { Link } from 'react-router-dom';
import type { FamilyPhotograph, FamilySharedPhotograph } from '../../lib/familyContract';
import { mediaUrl } from '../../lib/mediaUrl';
import { Button } from '../shared/Button';
import { GroupHead } from '../people/immersive';
import { SoldOutLine } from '../people/PersonTastings';
import { PHOTOGRAPH_DRAG_TYPE, personPath } from './useTeaFamily';

// What sits under the tea's plate and below the reading. Small and quiet: a row
// of thumbnails, never a wall. Everything wraps; nothing scrolls sideways.

/**
 * The reader's own photographs of this tea. Tapping one, or dragging it onto
 * the plate, makes it their cover for this tea. Only they ever see it.
 */
export function OwnPhotographRow({
  photographs, coverId, teaName, onChoose,
}: {
  photographs: FamilyPhotograph[];
  coverId: string | null;
  teaName: string;
  onChoose: (photographId: string | null) => void;
}) {
  if (photographs.length === 0) return null;
  return (
    <div className="mx-5 mt-3 lg:mx-6" data-testid="own-photographs">
      <p className="m-0 font-sans text-ui-10 uppercase tracking-[0.22em] text-tea-text-dim">Your photographs</p>
      <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
        {photographs.map((photo, index) => {
          const isCover = photo.id === coverId;
          return (
            <li
              key={photo.id}
              draggable
              onDragStart={event => {
                event.dataTransfer.setData(PHOTOGRAPH_DRAG_TYPE, photo.id);
                event.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <Button
                variant="plain"
                type="button"
                onClick={() => onChoose(isCover ? null : photo.id)}
                aria-pressed={isCover}
                aria-label={`${isCover ? 'Your picture of' : 'Use as your picture of'} ${teaName}, photograph ${index + 1}`}
                data-testid="own-photograph"
                className={`tap-target block h-14 w-14 overflow-hidden bg-tea-surface p-0 ${isCover ? 'ring-1 ring-tea-text-sec' : 'opacity-90 hover:opacity-100'}`}
              >
                <img src={mediaUrl(photo.small_url)} alt="" width={photo.small_width} height={photo.small_height} loading="lazy" className="pointer-events-none h-full w-full object-cover" />
              </Button>
            </li>
          );
        })}
      </ul>
      {coverId && (
        <p className="m-0 mt-2 flex flex-wrap items-center gap-x-3 font-body text-ui-13 italic text-tea-text-sec" data-testid="own-cover-note">
          <span>Your photograph, seen only by you.</span>
          <Button variant="plain" type="button" onClick={() => onChoose(null)} className="tap-target font-sans text-ui-10 not-italic uppercase tracking-[0.18em] text-tea-text-sec hover:text-tea-text">
            Back to the original
          </Button>
        </p>
      )}
    </div>
  );
}

/** "Gone from the shop." with its one action, under the plate on a sold-out tea. */
export function SoldOutUnderPlate({ productId, name }: { productId: string; name: string }) {
  return (
    <div className="mx-5 mt-3 lg:mx-6">
      <SoldOutLine productId={productId} name={name} />
    </div>
  );
}

/** "From the family": other people's shared photographs of this same tea, small, each credited. */
export function FromTheFamily({ photographs, teaName }: { photographs: FamilySharedPhotograph[]; teaName: string }) {
  if (photographs.length === 0) return null;
  return (
    <section aria-label="From the family" className="mx-5 mt-4 lg:mx-10" data-testid="from-the-family">
      <GroupHead label="From the family" />
      <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-3 gap-y-4 p-0">
        {photographs.map(photo => {
          const href = personPath(photo.author.page_id);
          return (
            <li key={photo.id} className="w-24" data-testid="family-photograph">
              {/* The small copy, always: a strip never asks for the large file. */}
              <img src={mediaUrl(photo.small_url)} alt={`${teaName}, photographed by ${photo.author.name}`} width={photo.small_width} height={photo.small_height} loading="lazy" className="h-24 w-24 object-cover" />
              {href ? (
                <Link to={href} className="tap-target mt-1 block break-words font-body text-ui-13 italic leading-[1.3] text-tea-text-sec hover:text-tea-text">{photo.author.name}</Link>
              ) : (
                <span className="mt-1 block break-words font-body text-ui-13 italic leading-[1.3] text-tea-text-sec">{photo.author.name}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
