import React, { useCallback, useEffect, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Loader2, RotateCw, X } from 'lucide-react';
import { cropToSquareBlob, fileOrUrlToObjectUrl } from '../../lib/cropImage';

interface SquareCropModalProps {
  isOpen: boolean;
  source: File | Blob | string | null;
  title?: string;
  confirmLabel?: string;
  /** Output square edge in pixels. Default 1600 — keep that for product
   *  photos; tea entry thumbnails can pass 800 for tighter storage. */
  outputSize?: number;
  /** JPEG quality 0–1. Default 0.88. */
  outputQuality?: number;
  onClose: () => void;
  onConfirm: (blob: Blob) => Promise<void> | void;
}

export const SquareCropModal: React.FC<SquareCropModalProps> = ({
  isOpen, source, title = 'Crop photo', confirmLabel = 'Save',
  outputSize, outputQuality, onClose, onConfirm,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Resolve source whenever the modal opens with a new source. For string
  // URLs we now pass straight through (see fileOrUrlToObjectUrl); for
  // File/Blob we still need an object URL so the Cropper has something to
  // load. Only blob: URLs we created here get revoked on cleanup — strings
  // we received as input are someone else's lifetime to manage.
  useEffect(() => {
    let cancelled = false;
    let createdBlobUrl: string | null = null;
    setImageSrc(null);
    setError(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setCroppedAreaPixels(null);
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
  }, [isOpen, source]);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setSaving(true);
    setError(null);
    try {
      const blob = await cropToSquareBlob(imageSrc, croppedAreaPixels, {
        size: outputSize,
        quality: outputQuality,
        rotation,
      });
      await onConfirm(blob);
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
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-tea-bg border border-tea-border rounded-2xl w-full max-w-lg shadow-2xl relative flex flex-col max-h-[90vh]">
        {/* Header — close on the left per project Cancel/Close rules.
            Just one icon-button on the right (Rotate) so the toolbar reads
            clearly; Reset moved to the slider row where it belongs. */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-tea-border">
          <button
            onClick={onClose}
            disabled={saving}
            className="text-tea-text-sec hover:text-tea-text transition-colors tap-target"
            aria-label="Close"
          >
            <X size={18} />
          </button>
          <h3 className="text-base font-serif text-tea-text flex-1">{title}</h3>
          <button
            onClick={handleRotate}
            disabled={saving || !imageSrc}
            className="text-tea-text-sec hover:text-tea-text transition-colors text-ui-11 inline-flex items-center gap-1.5 tap-target disabled:opacity-40"
            aria-label="Rotate 90° clockwise"
            title="Rotate 90°"
          >
            <RotateCw size={14} />
            <span className="hidden sm:inline">Rotate</span>
          </button>
        </div>

        {/* Cropper viewport — square aspect ratio enforced. The image area
            shows three layered states:
              1. error  — text on top of dim viewport
              2. loading— spinner until the underlying <img> reports onLoad
              3. ready  — Cropper with full image
            Layering means a transient load failure (CORS, 404) can't leave
            the user staring at a blank square. */}
        <div className="relative w-full aspect-square bg-black/60 overflow-hidden">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              minZoom={1}
              maxZoom={4}
              showGrid={true}
              objectFit="contain"
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
              onMediaLoaded={() => setImageLoaded(true)}
            />
          )}
          {/* Hidden probe — confirms the image actually fetches. If the
              Cropper's internal img can't load (CORS / 404), our onerror
              fires here and we surface a real error rather than a black
              square. */}
          {imageSrc && !imageLoaded && !error && (
            <img
              src={imageSrc}
              alt=""
              className="hidden"
              crossOrigin="anonymous"
              onError={() => setError('This photo couldn’t be loaded — the host may be offline or unreachable.')}
            />
          )}
          {(error || !imageSrc || !imageLoaded) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-6 text-center">
              {error ? (
                <span className="text-ui-12 text-red-400/90 max-w-[280px]">{error}</span>
              ) : (
                <Loader2 className="animate-spin text-tea-text-sec" size={22} />
              )}
            </div>
          )}
        </div>

        {/* Zoom + Reset row — terse help, no run-on legalese */}
        <div className="px-5 py-3 border-t border-tea-border">
          <div className="flex items-center gap-3">
            <span className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-sec w-10 shrink-0">Zoom</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              disabled={!imageSrc || saving || !!error}
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
          <p className="text-ui-10 text-tea-text-sec mt-1.5">
            Drag to position · pinch or scroll to zoom
          </p>
        </div>

        {/* Footer — Cancel left, Save right (project rule) */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-tea-border">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-ui-12 text-tea-text-sec hover:text-tea-text transition-colors rounded-md tap-target"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || !imageSrc || !croppedAreaPixels || !!error}
            className="px-5 py-2 text-ui-12 font-medium rounded-md bg-tea-gold text-tea-bg hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-2 tap-target"
          >
            {saving && <Loader2 className="animate-spin" size={13} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SquareCropModal;
