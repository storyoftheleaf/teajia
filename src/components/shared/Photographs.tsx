import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button';
import { SquareCropModal } from './SquareCropModal';
import type { FamilyPhotographFrame } from '../../lib/familyContract';
import { aspectOfShape, framedPictureStyle, photographShape, shapeOfAspect, type PhotographShape } from '../../lib/photographShape';

// The two parts every family photograph is shown with, wherever it appears:
// a small thumbnail with nothing written on or under it, and the zoom it opens,
// which is the one place that says who took it and what can be done with it.
// Both crop to one of the three shapes (square, 2:3, 3:2).

export interface ZoomPhotograph {
  id: string;
  /** The small copy, for the thumbnail. */
  smallSrc: string;
  /** The large copy, asked for only when the zoom opens. */
  fullSrc: string;
  width: number;
  height: number;
  alt: string;
  /** The shape its author chose. Square when nothing was chosen. */
  shape?: PhotographShape | null;
  /** The part of the picture its author framed. The middle when nothing was framed. */
  frame?: FamilyPhotographFrame | null;
}

/** One thumbnail. `size` picks the row height: 'tasting' is the smallest, 'page' the largest. */
export function PhotographThumb({ photo, size = 'row', onOpen, testId, label }: {
  photo: ZoomPhotograph;
  size?: 'tasting' | 'row' | 'page';
  onOpen: (id: string) => void;
  testId?: string;
  label?: string;
}) {
  return (
    <Button
      variant="plain"
      type="button"
      onClick={() => onOpen(photo.id)}
      aria-label={label ?? `Open ${photo.alt}`}
      data-testid={testId}
      data-shape={photographShape(photo.shape)}
      data-size={size}
      className="photo-thumb"
    >
      <img src={photo.smallSrc} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" style={framedPictureStyle(photo.frame)} />
    </Button>
  );
}

/**
 * The zoom. The photograph, cropped to its shape, with whatever the caller puts
 * under it: the credit, and the actions that belong to this photograph.
 */
export function PhotographZoom({ photo, onClose, children }: {
  photo: ZoomPhotograph | null;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const open = Boolean(photo);
  useEffect(() => {
    if (!open) return;
    // While the crop editor is open over the zoom, Escape belongs to the editor.
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !document.querySelector('[data-photograph-cropping]')) onClose(); };
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!photo) return null;
  // A takeover, set on the body: it covers the order bar, the nav and the tasting
  // alike, so no other layer shows through or takes the tap.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.alt}
      className="photo-zoom z-takeover"
      data-testid="photograph-zoom"
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <Button variant="icon" type="button" ref={closeRef} onClick={onClose} aria-label="Close" className="photo-zoom__close">
        <X className="h-5 w-5" aria-hidden="true" />
      </Button>
      <figure className="photo-zoom__figure" data-shape={photographShape(photo.shape)}>
        <div className="photo-zoom__picture">
          <img src={photo.fullSrc} alt={photo.alt} data-testid="photograph-zoom-image" style={framedPictureStyle(photo.frame)} />
        </div>
        {children && <figcaption className="photo-zoom__under">{children}</figcaption>}
      </figure>
    </div>,
    document.body,
  );
}

/**
 * "Crop", shown in the zoom on a person's own photograph. It opens the same
 * editor Curate frames its photographs with: square to begin with, 2:3 or 3:2
 * a tap away, drag and pinch to choose the part that shows. The stored picture
 * is never changed; only the frame is saved.
 */
export function PhotographCrop({ photo, onSave }: {
  photo: ZoomPhotograph;
  onSave: (shape: PhotographShape, frame: FamilyPhotographFrame) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const shape = photographShape(photo.shape);
  const frame = photo.frame ?? null;
  const initialFrame = useMemo(
    () => (frame ? { crop: frame.crop, zoom: frame.zoom, rotation: 0, areaPercent: frame.area, aspect: aspectOfShape(shape) } : null),
    [frame, shape],
  );
  return (
    <>
      <Button variant="secondary" size="sm" type="button" data-testid="photograph-crop" onClick={() => setOpen(true)}>Crop</Button>
      {open && <span hidden data-photograph-cropping="" />}
      <SquareCropModal
        isOpen={open}
        source={open ? photo.fullSrc : null}
        initialFrame={initialFrame}
        allowAspectSelection
        allowRotation={false}
        layer="takeover"
        title="Crop photograph"
        confirmLabel="Save"
        outputSize={240}
        onClose={() => setOpen(false)}
        onConfirm={async (_preview, framed) => {
          await onSave(shapeOfAspect(framed.aspect), { crop: framed.crop, zoom: framed.zoom, area: framed.areaPercent });
          setOpen(false);
        }}
      />
    </>
  );
}
