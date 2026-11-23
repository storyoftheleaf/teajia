import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RectangleHorizontal, RectangleVertical, Square, X } from 'lucide-react';
import { Button } from './Button';
import { SquareCropModal } from './SquareCropModal';
import { PHOTO_ACTION } from './photoWords';
import type { FamilyPhotographFrame } from '../../lib/familyContract';
import { aspectOfShape, framedPicture, photographShape, shapeOfAspect, type PhotographShape } from '../../lib/photographShape';

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

/** The picture, placed so the part its author framed fills the shape; turned when they straightened it. */
export function FramedImage({ photo, src, lazy, testId }: { photo: ZoomPhotograph; src: string; lazy?: boolean; testId?: string }) {
  const framed = framedPicture(photo.frame, photo.width, photo.height);
  const image = (
    <img src={src} alt={photo.alt} width={photo.width} height={photo.height} loading={lazy ? 'lazy' : undefined} data-testid={testId} style={framed?.picture} />
  );
  return framed?.stage ? <span className="photo-stage" style={framed.stage}>{image}</span> : image;
}

/** One thumbnail. `size` picks the row height: 'tasting' is the smallest, 'page' the largest. */
export function PhotographThumb({ photo, size = 'row', onOpen, testId, label, className }: {
  photo: ZoomPhotograph;
  size?: 'tasting' | 'row' | 'page';
  onOpen: (id: string) => void;
  testId?: string;
  label?: string;
  className?: string;
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
      className={['photo-thumb', className].filter(Boolean).join(' ')}
    >
      <FramedImage photo={photo} src={photo.smallSrc} lazy />
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
          <FramedImage photo={photo} src={photo.fullSrc} testId="photograph-zoom-image" />
        </div>
        {children && <figcaption className="photo-zoom__under">{children}</figcaption>}
      </figure>
    </div>,
    document.body,
  );
}

const SHAPE_ICONS = [
  { shape: 'square', says: 'Square', Icon: Square },
  { shape: 'upright', says: 'Portrait 2:3', Icon: RectangleVertical },
  { shape: 'across', says: 'Landscape 3:2', Icon: RectangleHorizontal },
] as const;

/**
 * The three shapes as icons, right under a person's own photograph. One tap
 * and it is that shape, showing the middle of the picture. "Crop" beside them
 * is for choosing the part that shows, and for straightening.
 */
export function PhotographShapeChoice({ shape, onChoose }: {
  shape: PhotographShape | null | undefined;
  onChoose: (shape: PhotographShape) => void;
}) {
  const current = photographShape(shape);
  return (
    <div className="photo-zoom__shapes" role="group" aria-label="Shape" data-testid="photograph-shapes">
      {SHAPE_ICONS.map(choice => (
        <Button
          key={choice.shape}
          variant="icon"
          type="button"
          className="photo-shape"
          aria-pressed={current === choice.shape}
          aria-label={choice.says}
          title={choice.says}
          data-testid={`photograph-shape-${choice.shape}`}
          onClick={() => { if (current !== choice.shape) onChoose(choice.shape); }}
        >
          <choice.Icon size={20} aria-hidden="true" />
        </Button>
      ))}
    </div>
  );
}

/**
 * "Crop", shown in the zoom on a person's own photograph. It opens the same
 * editor Curate frames its photographs with: square to begin with, 2:3 or 3:2
 * a tap away, drag and pinch to choose the part that shows, and a control to
 * straighten it. The stored picture is never changed; only the frame is saved.
 */
export function PhotographCrop({ photo, onSave }: {
  photo: ZoomPhotograph;
  onSave: (shape: PhotographShape, frame: FamilyPhotographFrame) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const shape = photographShape(photo.shape);
  const frame = photo.frame ?? null;
  const initialFrame = useMemo(
    () => (frame ? { crop: frame.crop, zoom: frame.zoom, rotation: frame.rotation ?? 0, areaPercent: frame.area, aspect: aspectOfShape(shape) } : null),
    [frame, shape],
  );
  return (
    <>
      {/* The one thing to do to this photograph, said as the people editor says it: a bronze word. */}
      <Button variant="plain" type="button" className={PHOTO_ACTION} data-testid="photograph-crop" onClick={() => setOpen(true)}>Crop</Button>
      {open && <span hidden data-photograph-cropping="" />}
      <SquareCropModal
        isOpen={open}
        source={open ? photo.fullSrc : null}
        initialFrame={initialFrame}
        allowAspectSelection
        layer="takeover"
        title="Crop photograph"
        confirmLabel="Save"
        outputSize={240}
        onClose={() => setOpen(false)}
        onConfirm={async (_preview, framed) => {
          await onSave(shapeOfAspect(framed.aspect), { crop: framed.crop, zoom: framed.zoom, rotation: framed.rotation, area: framed.areaPercent });
          setOpen(false);
        }}
      />
    </>
  );
}
