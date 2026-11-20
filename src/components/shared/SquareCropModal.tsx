import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import * as Dialog from '@radix-ui/react-dialog';
import Cropper, { Area } from 'react-easy-crop';
import { Check, Loader2, RectangleHorizontal, RectangleVertical, RotateCw, Square, X } from 'lucide-react';
import { cropToSquareBlob, fileOrUrlToObjectUrl, type SquarePhotoFrame } from '../../lib/cropImage';
import { clampPhotoFrameCrop, photoFrameSize } from '../../lib/photoFrameGeometry';

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
  /** 'takeover' when it opens over a full-screen layer such as the tasting. */
  layer?: 'popover' | 'takeover';
  loadError?: string;
  onViewOriginal?: () => void;
  onClose: () => void;
  onConfirm: (blob: Blob, frame: SquarePhotoFrame) => Promise<void> | void;
}

/** The three shapes, each drawn as its own outline. */
const SHAPES = [
  { label: 'Square', ratio: 1, Icon: Square },
  { label: 'Portrait 2:3', ratio: 2 / 3, Icon: RectangleVertical },
  { label: 'Landscape 3:2', ratio: 3 / 2, Icon: RectangleHorizontal },
] as const;

export const SquareCropModal: React.FC<SquareCropModalProps> = ({
  isOpen, source, title = 'Crop photo', confirmLabel = 'Save',
  outputSize, outputQuality, initialFrame, allowAspectSelection = false, layer = 'popover', loadError, onViewOriginal, onClose, onConfirm,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(1);
  const [turns, setTurns] = useState(0);
  const [straighten, setStraighten] = useState(0);
  const rotation = turns + straighten;
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
    setAspect(allowAspectSelection ? initialFrame?.aspect ?? 1 : 1);
    const angle = initialFrame?.rotation ?? 0;
    const base = Math.round(angle / 90) * 90;
    setTurns(base); setStraighten(angle - base);
    setCroppedAreaPixels(null);
    croppedAreaPixelsRef.current = null;
    areaPercentRef.current = null;
    setImageLoaded(false);

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
        image.onload = () => {
          if (cancelled) return;
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
  }, [isOpen, source, initialFrame, allowAspectSelection]);

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

  if (!isOpen) return null;

  return <Dialog.Root open={isOpen} onOpenChange={open => { if (!open && !saving) onClose(); }}><Dialog.Portal>
    <Dialog.Content ref={dialogRef} aria-label={title} aria-describedby={undefined} onOpenAutoFocus={event => event.preventDefault()} className={`fixed inset-0 ${layer === 'takeover' ? 'z-takeover' : 'z-popover'} flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200`}>
      <div className="bg-tea-bg border border-tea-border rounded-xl w-full max-w-lg shadow-2xl relative flex flex-col max-h-[90vh]">
        <div className="px-5 py-3 border-b border-tea-border">
          <Dialog.Title asChild><h3 className="text-base font-serif text-tea-text">{title}</h3></Dialog.Title>
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
            {SHAPES.map(option => <Button
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

        {/* Rotate first: a crooked picture is the thing most worth fixing. Zoom under it. */}
        <div className="px-5 py-3 border-t border-tea-border">
          <div className="flex items-center gap-3">
            <span className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-sec w-12 shrink-0">Rotate</span>
            <input type="range" min={-45} max={45} step={0.1} value={straighten}
              aria-label="Rotation" disabled={!imageSrc || !imageLoaded || saving}
              className="flex-1 accent-tea-gold"
              onChange={event => {
                const value = Number(event.target.value);
                setStraighten(value);
                setCrop(point => clampPhotoFrameCrop(point, bounds, zoom, turns + value, aspect));
              }} />
            <output className="w-10 shrink-0 text-right text-ui-11 text-tea-text-sec tabular-nums" aria-label="Rotation angle">{Number(straighten.toFixed(1))}°</output>
            <Button type="button" variant="icon" onClick={handleRotate} disabled={saving || !imageSrc || !imageLoaded} aria-label="Rotate 90° clockwise" title="Turn a quarter">
              <RotateCw size={16} aria-hidden="true" />
            </Button>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-sec w-12 shrink-0">Zoom</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => changeZoom(Number(e.target.value))}
              disabled={!imageSrc || !imageLoaded || saving || !!error}
              className="flex-1 accent-tea-gold"
              aria-label="Zoom"
            />
            <Button type="button" variant="quiet" size="sm" onClick={handleReset} disabled={saving || !imageSrc || !!error} title="Reset zoom, position and rotation">Reset</Button>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-ui-10 text-tea-text-sec">
              {onViewOriginal ? 'Original kept. Drag to frame · pinch to zoom' : 'Drag to position · pinch to zoom'}
            </p>
            {onViewOriginal && <Button type="button" variant="ghost" className="btn-sm" disabled={saving} onClick={onViewOriginal}>View original</Button>}
          </div>
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
};

export default SquareCropModal;
