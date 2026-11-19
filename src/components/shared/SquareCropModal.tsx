import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import * as Dialog from '@radix-ui/react-dialog';
import Cropper, { Area } from 'react-easy-crop';
import { Loader2, RotateCw, X } from 'lucide-react';
import { cropToSquareBlob, fileOrUrlToObjectUrl, type SquarePhotoFrame } from '../../lib/cropImage';
import { clampPhotoFrameCrop, squareFrameSize } from '../../lib/photoFrameGeometry';

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
  loadError?: string;
  onViewOriginal?: () => void;
  onClose: () => void;
  onConfirm: (blob: Blob, frame: SquarePhotoFrame) => Promise<void> | void;
}

export const SquareCropModal: React.FC<SquareCropModalProps> = ({
  isOpen, source, title = 'Crop photo', confirmLabel = 'Save',
  outputSize, outputQuality, initialFrame, loadError, onViewOriginal, onClose, onConfirm,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [turns, setTurns] = useState(0);
  const [straighten, setStraighten] = useState(0);
  const rotation = turns + straighten;
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [viewportNode, setViewportNode] = useState<HTMLDivElement | null>(null);
  const scale = Math.min(1, viewport.width / (natural.width || 1), viewport.height / (natural.height || 1));
  const bounds = { mediaWidth: natural.width * scale, mediaHeight: natural.height * scale, viewportWidth: viewport.width, viewportHeight: viewport.height };
  const frameSize = squareFrameSize(bounds, rotation);
  const changeCrop = (point: { x: number; y: number }) => setCrop(clampPhotoFrameCrop(point, bounds, zoom, rotation));
  const changeZoom = (value: number) => { setZoom(value); setCrop(point => clampPhotoFrameCrop(point, bounds, value, rotation)); };
  const changeRotation = (value: number) => {
    const base = Math.round(value / 90) * 90;
    setTurns(base); setStraighten(value - base);
    setCrop(point => clampPhotoFrameCrop(point, bounds, zoom, value));
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
  }, [isOpen, source, initialFrame]);

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
        rotation,
      });
      await onConfirm(blob, { crop, zoom, rotation: ((rotation % 360) + 360) % 360, areaPercent: areaPercentRef.current });
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
    <Dialog.Content ref={dialogRef} aria-label={title} aria-describedby={undefined} onOpenAutoFocus={event => event.preventDefault()} className="fixed inset-0 z-popover flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-tea-bg border border-tea-border rounded-xl w-full max-w-lg shadow-2xl relative flex flex-col max-h-[90vh]">
        {/* Header, close on the left per project Cancel/Close rules.
            Just one icon-button on the right (Rotate) so the toolbar reads
            clearly; Reset moved to the slider row where it belongs. */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-tea-border">
          <button
            ref={closeRef}
            onClick={onClose}
            disabled={saving}
            className="text-tea-text-sec hover:text-tea-text transition-colors tap-target"
            aria-label="Close"
          >
            <X size={18} />
          </button>
          <Dialog.Title asChild><h3 className="text-base font-serif text-tea-text flex-1">{title}</h3></Dialog.Title>
          <button
            onClick={handleRotate}
            disabled={saving || !imageSrc || !imageLoaded}
            className="text-tea-text-sec hover:text-tea-text transition-colors text-ui-11 inline-flex items-center gap-1.5 tap-target disabled:opacity-40"
            aria-label="Rotate 90° clockwise"
            title="Rotate 90°"
          >
            <RotateCw size={14} />
            <span className="hidden sm:inline">Rotate</span>
          </button>
        </div>

        {/* Cropper viewport, square aspect ratio enforced. The image area
            shows three layered states:
              1. error: text on top of dim viewport
              2. loading: spinner until the underlying <img> reports onLoad
              3. ready: Cropper with full image
            Layering means a transient load failure (CORS, 404) can't leave
            the user staring at a blank square. */}
        <div ref={setViewportNode} className="relative w-full aspect-square bg-black/60 overflow-hidden">
          {imageSrc && frameSize > 0 && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              cropSize={frameSize > 0 ? { width: frameSize, height: frameSize } : undefined}
              aspect={1}
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

        {/* Zoom + Reset row, terse help, no run-on legalese */}
        <div className="px-5 py-3 border-t border-tea-border">
          <div className="flex items-center gap-3">
            <span className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-sec w-10 shrink-0">Zoom</span>
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
            <button
              type="button"
              onClick={handleReset}
              disabled={saving || !imageSrc || !!error}
              className="shrink-0 text-ui-11 text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-40"
              title="Reset zoom, position and rotation"
            >
              Reset
            </button>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-sec w-10 shrink-0">Rotate</span>
            <input type="range" min={-45} max={45} step={0.1} value={straighten}
              aria-label="Rotation" disabled={!imageSrc || !imageLoaded || saving}
              className="flex-1 accent-tea-gold"
              onChange={event => {
                const value = Number(event.target.value);
                setStraighten(value);
                setCrop(point => clampPhotoFrameCrop(point, bounds, zoom, turns + value));
              }} />
            <output className="text-ui-11 text-tea-text-sec tabular-nums" aria-label="Rotation angle">{Number(straighten.toFixed(1))}°</output>
          </div>
          <p className="text-ui-10 text-tea-text-sec mt-1.5">
            {onViewOriginal ? 'Original kept. Drag to frame · pinch or scroll to zoom' : 'Drag to position · pinch or scroll to zoom'}
          </p>
        </div>

        {/* Footer: Cancel left, Save right (project rule) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-tea-border">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors rounded-md tap-target"
          >
            Cancel
          </button>
          {onViewOriginal && <Button type="button" variant="ghost" className="btn-sm" disabled={saving} onClick={onViewOriginal}>View original</Button>}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || !imageSrc || !imageLoaded || !croppedAreaPixels || frameSize <= 0}
            className="btn-primary hover:opacity-90 tap-target"
          >
            {saving && <Loader2 className="animate-spin" size={13} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
};

export default SquareCropModal;
