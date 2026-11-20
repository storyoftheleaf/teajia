import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button';
import { photographShape } from '../../lib/photographShape';

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
      data-shape={photographShape(photo.width, photo.height)}
      data-size={size}
      className="photo-thumb"
    >
      <img src={photo.smallSrc} alt={photo.alt} width={photo.width} height={photo.height} loading="lazy" />
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
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
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
      <figure className="photo-zoom__figure" data-shape={photographShape(photo.width, photo.height)}>
        <img src={photo.fullSrc} alt={photo.alt} data-testid="photograph-zoom-image" />
        {children && <figcaption className="photo-zoom__under">{children}</figcaption>}
      </figure>
    </div>,
    document.body,
  );
}
