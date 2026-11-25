import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import * as Dialog from '@radix-ui/react-dialog';
import Cropper, { Area } from 'react-easy-crop';
import { Check, Image as ImageIcon, Loader2, RectangleHorizontal, RectangleVertical, RotateCw, Ruler, Square, X, ZoomIn } from 'lucide-react';
import { cropToSquareBlob, fileOrUrlToObjectUrl, type SquarePhotoFrame } from '../../lib/cropImage';
import { clampPhotoFrameCrop, photoFrameSize } from '../../lib/photoFrameGeometry';
import { faceFramePercent, findFace } from '../../lib/faceFrame';

interface SquareCropModalProps {
  isOpen: boolean;
  source: File | Blob | string | null;
  title?: string;
  confirmLabel?: string;
  /** Output square edge in pixels. Default 1600, keep that for product
   *  photos; tea entry thumbnails can pass 800 for tighter storage. */
  outputSize?: number;
  /** JPEG quality 0–1. Default 0.88. */
  outputQuality?: number;
  initialFrame?: SquarePhotoFrame | null;
  allowAspectSelection?: boolean;
  /** The frame's shape, width over height. Alone it is fixed (a story frame's
   *  4:5); with allowAspectSelection it is the shape the editor opens on. */
  frameAspect?: number;
  /** 'takeover' when it opens over a full-screen layer such as the tasting. */
  layer?: 'popover' | 'takeover';
  loadError?: string;
  /** Open a new photo (one with no saved frame) on its face: centred, filling
   *  the frame, ready to nudge. On by default; a photo with no face opens whole. */
  centreFace?: boolean;
  /** With allowAspectSelection: also offer the photo's own shape, and open on
   *  it, so a photo can be straightened or tidied without being made square. */
  offerOriginalShape?: boolean;
  onViewOriginal?: () => void;
  onClose: () => void;
  onConfirm: (blob: Blob, frame: SquarePhotoFrame) => Promise<void> | void;
}

/** How far apart the ruler's small ticks are, in CSS pixels. Five small ticks to a tall one. */
const TICK = 8;

/**
 * A ruler you drag, with a fixed centre mark: the ticks move under the mark, so
 * a long drag makes a small, exact change. The real control underneath is an
 * ordinary range input, so arrow keys and screen readers work as they always did.
 */
function CropDial({ label, value, min, max, step, perTick, snapTo, hidden, disabled, onChange }: {
  label: string; value: number; min: number; max: number; step: number; perTick: number; snapTo: number;
  hidden: boolean; disabled: boolean; onChange: (value: number) => void;
}) {
  const drag = useRef<{ x: number; value: number } | null>(null);
  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next / step) * step));
  const offset = -((value - snapTo) / perTick) * TICK;
  return (
    <div
      className="crop-dial"
      data-hidden={hidden ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      data-testid={`crop-dial-${label.toLowerCase()}`}
      onPointerDown={event => {
        if (disabled) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, value };
      }}
      onPointerMove={event => {
        if (!drag.current) return;
        onChange(clamp(drag.current.value - ((event.clientX - drag.current.x) / TICK) * perTick));
      }}
      onPointerUp={() => {
        if (!drag.current) return;
        drag.current = null;
        // Close to the resting value, settle on it, the way a level finds true.
        if (Math.abs(value - snapTo) < perTick * 0.4) onChange(snapTo);
      }}
      onPointerCancel={() => { drag.current = null; }}
    >
      <span aria-hidden="true" className="crop-dial__ticks" style={{ backgroundPositionX: `calc(50% + ${offset}px), calc(50% + ${offset}px)` }} />
      <span aria-hidden="true" className="crop-dial__mark" />
      <input
        type="range" min={min} max={max} step={step} value={value} aria-label={label} disabled={disabled}
        tabIndex={hidden ? -1 : 0} className="crop-dial__input"
        onChange={event => onChange(Number(event.target.value))}
      />
    </div>
  );
}

/** The three shapes, each drawn as its own outline. */
const SHAPES = [
  { label: 'Square', ratio: 1, Icon: Square },
  { label: 'Portrait 2:3', ratio: 2 / 3, Icon: RectangleVertical },
  { label: 'Landscape 3:2', ratio: 3 / 2, Icon: RectangleHorizontal },
] as const;

export const SquareCropModal: React.FC<SquareCropModalProps> = ({
  isOpen, source, title = 'Crop photo', confirmLabel = 'Save',
  outputSize, outputQuality, initialFrame, allowAspectSelection = false, frameAspect = 1, layer = 'popover', loadError, centreFace = true, offerOriginalShape = false, onViewOriginal, onClose, onConfirm,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(1);
  const [turns, setTurns] = useState(0);
  const [straighten, setStraighten] = useState(0);
  const rotation = turns + straighten;
  /** Which of the two the ruler adjusts. Straighten first: a crooked picture is the thing most worth fixing. */
  const [dial, setDial] = useState<'rotate' | 'zoom'>('rotate');
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [viewportNode, setViewportNode] = useState<HTMLDivElement | null>(null);
  const scale = Math.min(1, viewport.width / (natural.width || 1), viewport.height / (natural.height || 1));
  const bounds = { mediaWidth: natural.width * scale, mediaHeight: natural.height * scale, viewportWidth: viewport.width, viewportHeight: viewport.height };
  const frameSize = photoFrameSize(bounds, rotation, aspect);
  const changeCrop = (point: { x: number; y: number }) => setCrop(clampPhotoFrameCrop(point, bounds, zoom, rotation, aspect));
  const changeZoom = (value: number) => { setZoom(value); setCrop(point => clampPhotoFrameCrop(point, bounds, value, rotation, aspect)); };
  const changeRotation = (value: number) => {
    const base = Math.round(value / 90) * 90;
    setTurns(base); setStraighten(value - base);
    setCrop(point => clampPhotoFrameCrop(point, bounds, zoom, value, aspect));
  };
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  // Mirror croppedAreaPixels into a ref so handleConfirm always reads the
  // freshest value. Without this, a quick zoom-then-Save tap could save
  // the pre-zoom pixels because react-easy-crop's onCropComplete fires
  // throttled and React's state update hadn't propagated to the click
  // handler's closure yet.
  const croppedAreaPixelsRef = useRef<Area | null>(null);
  const areaPercentRef = useRef<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  /** Where a new photo opens: on its face, when one was found. */
  const [faceArea, setFaceArea] = useState<Area | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const latest = useRef({ saving, onClose });
  latest.current = { saving, onClose };

  useEffect(() => {
    const element = viewportNode;
    if (!isOpen || !element) return;
    const update = () => {
      const { width, height } = element.getBoundingClientRect();
      setViewport(previous => previous.width === width && previous.height === height ? previous : { width, height });
    };
    update(); const observer = new ResizeObserver(update); observer.observe(element);
    return () => observer.disconnect();
  }, [isOpen, viewportNode]);

  useEffect(() => {
    if (!isOpen) return;
    const trigger = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    const wasInert = root?.inert ?? false;
    if (root) root.inert = true;
    const focus = requestAnimationFrame(() => closeRef.current?.focus());
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !latest.current.saving) { event.preventDefault(); latest.current.onClose(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') ?? []).filter(node => node.offsetParent !== null);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { cancelAnimationFrame(focus); document.removeEventListener('keydown', keydown); if (root) root.inert = wasInert; trigger?.focus(); };
  }, [isOpen]);

  // Resolve source whenever the modal opens with a new source. For string
  // URLs we now pass straight through (see fileOrUrlToObjectUrl); for
  // File/Blob we still need an object URL so the Cropper has something to
  // load. Only blob: URLs we created here get revoked on cleanup, strings
  // we received as input are someone else's lifetime to manage.
  useEffect(() => {
    let cancelled = false;
    let createdBlobUrl: string | null = null;
    setImageSrc(null);
    setNatural({ width: 0, height: 0 });
    setError(null);
    setCrop(initialFrame?.crop ?? { x: 0, y: 0 });
    setZoom(initialFrame?.zoom ?? 1);
    setAspect(allowAspectSelection ? initialFrame?.aspect ?? frameAspect : frameAspect);
    const angle = initialFrame?.rotation ?? 0;
    const base = Math.round(angle / 90) * 90;
    setTurns(base); setStraighten(angle - base);
    setDial('rotate');
    setCroppedAreaPixels(null);
    croppedAreaPixelsRef.current = null;
    areaPercentRef.current = null;
    setImageLoaded(false);
    setFaceArea(null);

    if (!isOpen || !source) return;

    fileOrUrlToObjectUrl(source)
      .then((url) => {
        if (cancelled) return;
        // We only own (and must revoke) blob URLs WE created from a File/Blob
        // input. URLs that were already strings are passed through unchanged.
        if (typeof source !== 'string' && url.startsWith('blob:')) {
          createdBlobUrl = url;
        }
        setImageSrc(url);
        // Measure the source before mounting Cropper. Its percentage restore must
        // start with the final square size, never a temporary rotated bounding box.
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = async () => {
          if (cancelled) return;
          // A new photo opens on its face. The Cropper mounts only once this
          // is settled, because it reads its opening frame once, on mount.
          const own = image.naturalWidth / (image.naturalHeight || 1);
          const opening = allowAspectSelection
            ? initialFrame?.aspect ?? (offerOriginalShape ? own : frameAspect)
            : frameAspect;
          if (allowAspectSelection && offerOriginalShape && !initialFrame) setAspect(own);
          const face = centreFace && !initialFrame ? await findFace(image) : null;
          if (cancelled) return;
          if (face) setFaceArea(faceFramePercent(face, { width: image.naturalWidth, height: image.naturalHeight }, opening));
          setNatural({ width: image.naturalWidth, height: image.naturalHeight });
          setImageLoaded(true);
        };
        image.onerror = () => { if (!cancelled) setError('This photo could not be loaded.'); };
        image.src = url;
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load image');
        }
      });

    return () => {
      cancelled = true;
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
    };
  }, [isOpen, source, initialFrame, allowAspectSelection, frameAspect, centreFace, offerOriginalShape]);

  // Open on the face: set zoom and position directly. (Handing the Cropper
  // percentages instead lets its first crop be clamped at zoom 1, which pulls
  // the face back toward the middle.)
  const faceApplied = useRef<Area | null>(null);
  useEffect(() => {
    if (!faceArea || faceApplied.current === faceArea || !bounds.mediaWidth || frameSize.width <= 0) return;
    faceApplied.current = faceArea;
    const areaWidth = (faceArea.width / 100) * bounds.mediaWidth;
    const nextZoom = Math.min(4, Math.max(1, frameSize.width / areaWidth));
    const centreX = ((faceArea.x + faceArea.width / 2) / 100 - 0.5) * bounds.mediaWidth;
    const centreY = ((faceArea.y + faceArea.height / 2) / 100 - 0.5) * bounds.mediaHeight;
    setZoom(nextZoom);
    setCrop(clampPhotoFrameCrop({ x: -centreX * nextZoom, y: -centreY * nextZoom }, bounds, nextZoom, rotation, aspect));
  });

  const onCropComplete = useCallback((areaPercent: Area, croppedPixels: Area) => {
    areaPercentRef.current = areaPercent;
    croppedAreaPixelsRef.current = croppedPixels;
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    // Read from the ref so we always get the latest crop area, even when
    // the user zooms and immediately taps Save.
    const pixels = croppedAreaPixelsRef.current ?? croppedAreaPixels;
    if (!imageSrc || !pixels || !areaPercentRef.current) return;
    setSaving(true);
    setError(null);
    try {
      const blob = await cropToSquareBlob(imageSrc, pixels, {
        size: outputSize,
        quality: outputQuality,
        rotation, aspect,
      });
      await onConfirm(blob, { crop, zoom, rotation: ((rotation % 360) + 360) % 360, areaPercent: areaPercentRef.current, aspect });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save crop');
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setTurns(0); setStraighten(0);
  };

  const handleRotate = () => {
    changeRotation(rotation + 90);
  };

  const controlsOff = !imageSrc || !imageLoaded || saving;
  const changed = zoom !== 1 || rotation !== 0 || crop.x !== 0 || crop.y !== 0;
  if (!isOpen) return null;

  return <Dialog.Root open={isOpen} onOpenChange={open => { if (!open && !saving) onClose(); }}><Dialog.Portal>
    <Dialog.Content ref={dialogRef} aria-label={title} aria-describedby={undefined} onOpenAutoFocus={event => event.preventDefault()} className={`fixed inset-0 ${layer === 'takeover' ? 'z-takeover' : 'z-popover'} flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200`}>
      <div className="bg-tea-bg border border-tea-border rounded-xl w-full max-w-lg shadow-2xl relative flex flex-col max-h-[90vh]">
        <div className="flex items-center gap-2 border-b border-tea-border py-1 pl-5 pr-2">
          <Dialog.Title asChild><h3 className="flex-1 text-base font-serif text-tea-text">{title}</h3></Dialog.Title>
          {changed && <Button type="button" variant="quiet" size="sm" className="crop-reset" onClick={handleReset} disabled={saving || !imageSrc || !!error} title="Reset zoom, position and rotation">Reset</Button>}
          <Button type="button" variant="icon" onClick={handleRotate} disabled={saving || !imageSrc || !imageLoaded} aria-label="Rotate 90° clockwise" title="Turn a quarter">
            <RotateCw size={18} aria-hidden="true" />
          </Button>
        </div>

        {/* The photograph. Three layered states: an error in words, a spinner
            until the picture reports its size, then the picture itself, so a
            failed load can never leave a blank box. */}
        <div ref={setViewportNode} className="relative w-full aspect-square bg-black/60 overflow-hidden">
          {imageSrc && frameSize.width > 0 && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              cropSize={frameSize.width > 0 ? frameSize : undefined}
              aspect={aspect}
              minZoom={1}
              maxZoom={4}
              showGrid={true}
              objectFit="contain"
              onCropChange={changeCrop}
              onZoomChange={changeZoom}
              onRotationChange={changeRotation}
              onCropComplete={onCropComplete}
              onCropAreaChange={onCropComplete}
              initialCroppedAreaPercentages={initialFrame?.areaPercent}
              onMediaLoaded={() => setImageLoaded(true)}
            />
          )}
          {(error || loadError || !imageSrc || !imageLoaded) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-6 text-center">
              {error || loadError ? (
                <span className="text-ui-12 text-tea-error/90 max-w-[280px]">{error || loadError}</span>
              ) : (
                <Loader2 className="animate-spin text-tea-text-sec" size={22} />
              )}
            </div>
          )}
        </div>

        {/* One row of icons along the foot of the photograph: Cancel on the
            left, the three shapes in the middle, Save on the right. */}
        <div className="crop-bar" data-testid="crop-bar">
          <Button ref={closeRef} type="button" variant="icon" onClick={onClose} disabled={saving} aria-label="Cancel" title="Cancel">
            <X size={20} aria-hidden="true" />
          </Button>
          {allowAspectSelection && <div role="group" aria-label="Photo frame shape" className="crop-bar__shapes">
            {[...(offerOriginalShape && natural.width ? [{ label: 'Original shape', ratio: natural.width / natural.height, Icon: ImageIcon }] : []), ...SHAPES].map(option => <Button
              key={option.label} type="button" variant="icon" aria-pressed={aspect === option.ratio} aria-label={option.label} title={option.label}
              disabled={saving} className="crop-bar__shape"
              onClick={() => { setAspect(option.ratio); setCrop(point => clampPhotoFrameCrop(point, bounds, zoom, rotation, option.ratio)); }}>
              <option.Icon size={20} aria-hidden="true" />
            </Button>)}
          </div>}
          <Button
            type="button" variant="icon" onClick={handleConfirm} aria-label={confirmLabel} title={confirmLabel} className="crop-bar__save"
            disabled={saving || !imageSrc || !imageLoaded || !croppedAreaPixels || frameSize.width <= 0}
          >
            {saving ? <Loader2 className="animate-spin" size={20} aria-hidden="true" /> : <Check size={20} aria-hidden="true" />}
          </Button>
        </div>

        {/* The way a phone's own photo editor does it: two round values, Straighten
            first, and one ruler under them that adjusts whichever is chosen. Drag
            the ruler; the centre mark stays put. Pinching the photograph zooms too. */}
        <div className="crop-tools">
          <div className="crop-values" role="group" aria-label="Adjust">
            <Button type="button" variant="icon" className="crop-value" aria-pressed={dial === 'rotate'} aria-label="Straighten" title="Straighten" disabled={controlsOff} onClick={() => setDial('rotate')}>
              {straighten ? <span>{Math.round(straighten)}</span> : <Ruler size={18} aria-hidden="true" />}
            </Button>
            <Button type="button" variant="icon" className="crop-value" aria-pressed={dial === 'zoom'} aria-label="Enlarge" title="Enlarge" disabled={controlsOff} onClick={() => setDial('zoom')}>
              {zoom > 1 ? <span>{zoom.toFixed(1)}×</span> : <ZoomIn size={18} aria-hidden="true" />}
            </Button>
          </div>
          <div className="crop-dial-stack">
            <CropDial
              label="Rotation" hidden={dial !== 'rotate'} value={straighten} min={-45} max={45} step={0.1} perTick={1} snapTo={0} disabled={controlsOff}
              onChange={value => {
                setStraighten(value);
                setCrop(point => clampPhotoFrameCrop(point, bounds, zoom, turns + value, aspect));
              }} />
            <CropDial label="Zoom" hidden={dial !== 'zoom'} value={zoom} min={1} max={4} step={0.01} perTick={0.05} snapTo={1} disabled={controlsOff || !!error} onChange={changeZoom} />
          </div>
          {onViewOriginal && <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-2">
            <p className="text-ui-10 text-tea-text-sec">Original kept.</p>
            <Button type="button" variant="ghost" className="btn-sm" disabled={saving} onClick={onViewOriginal}>View original</Button>
          </div>}
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
};

export default SquareCropModal;
