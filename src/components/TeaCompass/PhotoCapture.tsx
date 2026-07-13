import React, { useCallback, useEffect, useRef, useState } from 'react';
import { mediaUrl } from '../../lib/mediaUrl';
import { createPortal } from 'react-dom';
import { Camera, Check, ChevronLeft, ChevronRight, Edit3, ImagePlus, Maximize2, RefreshCw, Sparkles, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../lib/api';
import { compressImage } from '../../lib/imageCompressor';
import { SquareCropModal } from '../shared/SquareCropModal';
import { BottomSheet, SheetOption } from '../shared/BottomSheet';

export interface ExtractedTeaData {
  name?: string;
  chineseName?: string;
  type?: string;
  form?: string;
  year?: number;
  season?: string;
  region?: string;
  price?: number;
  grams?: number;
  extraNotes?: string;
}

interface PhotoCaptureProps {
  onExtracted: (data: ExtractedTeaData) => void;
  onPhotoTaken: (url: string) => void;
  onPhotoReplaced?: (oldUrl: string, newUrl: string) => void;
  photos?: string[];
  onRemovePhoto?: (index: number) => void;
  /** 'lg' renders the inline strip with larger thumbs + 44×44 action buttons,
   *  used by the teaware capture card where the top of the form needs breathing room. */
  size?: 'default' | 'lg';
  /** 'hero' renders the full-width 4:3 camera tile that leads the capture
   *  card: tap anywhere to open the camera before a photo exists; after a
   *  photo, it fills the tile with scan/add actions overlaid bottom-right. */
  variant?: 'strip' | 'hero';
}

interface PendingPreview {
  localUrl: string;
  uploading: boolean;
  failed: boolean;
}

type ScanStep = 'camera' | 'scanning' | 'result' | 'denied';

/** Structured scan failures from the worker. The old callers swallowed every
 *  failure with .catch(() => null), so "no key", "provider down" and
 *  "unreadable label" all looked identical. Now each gets its own quiet
 *  state; an empty result on a leaf photo is NOT an error and stays silent. */
type ScanErrorCode = 'no_ai_provider' | 'provider_error' | 'extract_failed';

function classifyScanError(err: unknown): ScanErrorCode {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (msg.includes('no_ai_provider')) return 'no_ai_provider';
  if (msg.includes('extract_failed')) return 'extract_failed';
  // Anything else (provider_error, network, timeout) reads as the scanner
  // being unreachable right now.
  return 'provider_error';
}

const SCAN_ERROR_COPY: Record<ScanErrorCode, string> = {
  no_ai_provider: 'Scanner unavailable',
  provider_error: 'Scanner unavailable, try again shortly',
  extract_failed: "Couldn't read this label",
};

function parseExtractResult(r: Record<string, any>): ExtractedTeaData {
  const data: ExtractedTeaData = {};
  if (r.name || r.givenName || r.given_name) data.name = r.name || r.givenName || r.given_name;
  if (r.chineseName || r.chinese_name) data.chineseName = r.chineseName || r.chinese_name;
  if (r.type || r.productType || r.product_type) data.type = r.type || r.productType || r.product_type;
  if (r.form) data.form = r.form;
  if (r.year) data.year = typeof r.year === 'number' ? r.year : parseInt(r.year, 10) || undefined;
  if (r.season) data.season = r.season;
  // Region first, falling back to country when no specific region is on the label.
  if (r.region || r.originRegion || r.origin_region || r.originCountry || r.origin_country)
    data.region = r.region || r.originRegion || r.origin_region || r.originCountry || r.origin_country;
  // Price: the worker/Gemini contract returns `costAmount`; earlier keys kept for compat.
  // Guard against 0 — the model emits 0 when no price is visible, which must not auto-fill.
  const priceRaw = r.price ?? r.priceAmount ?? r.price_amount ?? r.costAmount ?? r.cost_amount;
  if (priceRaw !== undefined && priceRaw !== null && priceRaw !== '' && priceRaw !== 0) {
    data.price = typeof priceRaw === 'number' ? priceRaw : parseFloat(priceRaw) || undefined;
  }
  // Grams: the worker/Gemini contract returns `quantityPurchased` (always grams).
  const gramsRaw = r.grams ?? r.weight ?? r.quantityPurchased ?? r.quantity_purchased;
  if (gramsRaw !== undefined && gramsRaw !== null && gramsRaw !== '' && gramsRaw !== 0) {
    data.grams = typeof gramsRaw === 'number' ? gramsRaw : parseFloat(gramsRaw) || undefined;
  }
  const extras: string[] = [];
  if (r.awards) extras.push(`Awards: ${r.awards}`);
  if (r.elevation || r.altitude) extras.push(`Elevation: ${r.elevation || r.altitude}`);
  if (r.farm || r.garden) extras.push(`Farm: ${r.farm || r.garden}`);
  if (r.productName || r.product_name) extras.push(`Cultivar: ${r.productName || r.product_name}`);
  if (r.vendor) extras.push(`Vendor: ${r.vendor}`);
  if (r.description) extras.push(r.description);
  if (r.notes) extras.push(r.notes);
  if (extras.length > 0) data.extraNotes = extras.join(' · ');
  return data;
}

export const PhotoCapture: React.FC<PhotoCaptureProps> = ({
  onExtracted,
  onPhotoTaken,
  onPhotoReplaced,
  photos,
  onRemovePhoto,
  size = 'default',
  variant = 'strip',
}) => {
  const isLg = size === 'lg';
  // Uniform tiles so thumbnails and the scan / camera actions read as one tidy
  // horizontal row (44×44 meets the WCAG 2.5.5 tap floor without extra padding).
  const thumbCls = isLg ? 'w-[60px] h-[60px]' : 'w-11 h-11';
  const btnCls = 'min-h-11 rounded-md px-3';
  const btnIcon = isLg ? 18 : 16;
  const btnGap = 'gap-1.5';
  const stripGap = 'gap-2';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);

  const [pendingPreviews, setPendingPreviews] = useState<PendingPreview[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const lightboxCloseRef = useRef<HTMLButtonElement>(null);
  const lightboxTriggerRef = useRef<HTMLButtonElement>(null);
  // Index of the photo whose action menu (Enlarge / Edit / Delete) is open.
  // Mutually exclusive across photos so only one menu shows at a time.
  const [menuPhotoIndex, setMenuPhotoIndex] = useState<number | null>(null);
  // URL of the photo currently open in the SquareCropModal — when set, the
  // editor swaps the user's crop back via api.uploadImage + onPhotoReplaced.
  const [editingPhotoUrl, setEditingPhotoUrl] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [justExtracted, setJustExtracted] = useState(false);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanStep, setScanStep] = useState<ScanStep>('camera');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [extractedPreview, setExtractedPreview] = useState<ExtractedTeaData | null>(null);

  // Quiet scan-failure state, surfaced under the photo area. Cleared when a
  // new scan starts. lastScanFile lets extract_failed offer a Retry without
  // re-taking the photo. Never blocks capture; the form stays usable.
  const [scanError, setScanError] = useState<ScanErrorCode | null>(null);
  const [lastScanFile, setLastScanFile] = useState<File | null>(null);
  const [retryingScan, setRetryingScan] = useState(false);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
    window.requestAnimationFrame(() => lightboxTriggerRef.current?.focus());
  }, []);

  const lightboxOpen = lightboxIndex !== null;
  useEffect(() => {
    if (!lightboxOpen) return;
    window.requestAnimationFrame(() => lightboxCloseRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeLightbox();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(lightboxRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeLightbox, lightboxOpen]);

  const runExtract = useCallback(
    async (file: File): Promise<{ data: ExtractedTeaData | null; error: ScanErrorCode | null }> => {
      try {
        const result = await api.extractFromImage(file, { skipUpload: true });
        return { data: result ? parseExtractResult(result as Record<string, any>) : null, error: null };
      } catch (err) {
        return { data: null, error: classifyScanError(err) };
      }
    },
    []
  );

  const handleRetryScan = useCallback(async () => {
    if (!lastScanFile || retryingScan) return;
    setRetryingScan(true);
    const { data, error } = await runExtract(lastScanFile);
    setRetryingScan(false);
    setScanError(error);
    if (!error && data && Object.keys(data).length > 0) {
      onExtracted(data);
      setJustExtracted(true);
    }
  }, [lastScanFile, retryingScan, runExtract, onExtracted]);

  const validPhotos = (photos ?? []).filter(Boolean);
  const allPhotos = [
    ...validPhotos,
    ...pendingPreviews.filter((p) => !p.failed).map((p) => p.localUrl),
  ];

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  useEffect(() => {
    return () => { pendingPreviews.forEach((p) => URL.revokeObjectURL(p.localUrl)); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!justExtracted) return;
    const t = setTimeout(() => setJustExtracted(false), 1500);
    return () => clearTimeout(t);
  }, [justExtracted]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') setLightboxIndex((i) => i !== null ? Math.min(i + 1, allPhotos.length - 1) : null);
      if (e.key === 'ArrowLeft') setLightboxIndex((i) => i !== null ? Math.max(i - 1, 0) : null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, allPhotos.length]);

  // Start camera on the given video element
  const startCamera = useCallback(async (el: HTMLVideoElement) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanStep('denied');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      el.srcObject = stream;
      await el.play();
    } catch {
      setScanStep('denied');
    }
  }, []);

  // Ref callback — fires the instant the <video> element mounts into the portal DOM
  const videoRefCallback = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el;
    if (el) startCamera(el);
  }, [startCamera]);

  const openScanner = () => {
    setCapturedDataUrl(null);
    setCapturedImageUrl(null);
    setExtractedPreview(null);
    setScanError(null);
    setScanStep('camera');
    setScannerOpen(true);
  };

  const closeScanner = () => {
    stopStream();
    setScannerOpen(false);
  };

  const handleCapture = async () => {
    const el = videoElRef.current;
    if (!el) return;

    const canvas = document.createElement('canvas');
    canvas.width = el.videoWidth || 1280;
    canvas.height = el.videoHeight || 720;
    canvas.getContext('2d')?.drawImage(el, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedDataUrl(dataUrl);
    setScanStep('scanning');
    stopStream();

    canvas.toBlob(async (blob) => {
      if (!blob) { setScanStep('result'); return; }
      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
      setScanError(null);
      setLastScanFile(file);

      const [imageUrl, extract] = await Promise.all([
        api.uploadImage(file).catch(() => null),
        // uploadImage already stores the photo, so skip the extract
        // endpoint's own R2 write; each scan stores one object, not two.
        runExtract(file),
      ]);

      if (imageUrl) setCapturedImageUrl(imageUrl);
      if (extract.data) setExtractedPreview(extract.data);
      setScanError(extract.error);
      setScanStep('result');
    }, 'image/jpeg', 0.9);
  };

  const handleRetake = () => {
    setCapturedDataUrl(null);
    setCapturedImageUrl(null);
    setExtractedPreview(null);
    setScanStep('camera');
    // videoRefCallback will re-fire if the <video> element remounts;
    // if it stays in the DOM (just un-hidden), restart camera manually
    if (videoElRef.current) startCamera(videoElRef.current);
  };

  // Upload failed at scan time but we still hold the frame as a data URL —
  // re-upload in the background and attach the photo when it lands. Previously
  // "Apply to form" filled the fields and silently dropped the photo whenever
  // the upload leg lost the race against a flaky connection.
  const retryUploadFromDataUrl = (dataUrl: string) => {
    void (async () => {
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
        const url = await api.uploadImage(file);
        if (url) onPhotoTaken(url);
      } catch { /* connection still down — fields are applied, photo lost this round */ }
    })();
  };

  const handleApply = () => {
    if (capturedImageUrl) onPhotoTaken(capturedImageUrl);
    else if (capturedDataUrl) retryUploadFromDataUrl(capturedDataUrl);
    if (extractedPreview) onExtracted(extractedPreview);
    closeScanner();
    setJustExtracted(true);
  };

  // Keep the photo even when the label couldn't be read (or was read wrong).
  // The frame already uploaded as `capturedImageUrl`, so a source photo of the
  // bag + leaves is a complete-enough capture on its own — no name required.
  const handleUsePhotoOnly = () => {
    if (capturedImageUrl) {
      onPhotoTaken(capturedImageUrl);
      setJustExtracted(true);
    } else if (capturedDataUrl) {
      retryUploadFromDataUrl(capturedDataUrl);
      setJustExtracted(true);
    }
    closeScanner();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const localUrl = URL.createObjectURL(file);
    setPendingPreviews((prev) => [...prev, { localUrl, uploading: true, failed: false }]);

    try {
      // Initial capture stays large — 1600px / quality 0.7 — so the in-app
      // editor has plenty of pixels to work with for crop, rotation and
      // future adjustments. Once the user commits an edit the editor saves
      // back at 800px square, but we want the unedited source generous.
      const compressed = await compressImage(file, 1600, 0.7);
      const compressedFile = new File([compressed], 'photo.jpg', { type: 'image/jpeg' });
      const imageUrl = await api.uploadImage(compressedFile).catch(() => null);

      if (imageUrl) {
        onPhotoTaken(imageUrl);
        if (onPhotoReplaced) onPhotoReplaced(localUrl, imageUrl);
        setPendingPreviews((prev) => prev.filter((p) => p.localUrl !== localUrl));
        URL.revokeObjectURL(localUrl);

        // Gallery-added photos get the same label read as the scanner.
        // Fire-and-forget: the form fills only empty fields the user hasn't
        // touched (handleExtracted's contract), so a wrong read costs
        // nothing. The photo is already saved either way; a failure only
        // sets the quiet scan-error line, never blocks the capture.
        setScanError(null);
        setLastScanFile(compressedFile);
        void runExtract(compressedFile).then(({ data, error }) => {
          setScanError(error);
          if (!error && data && Object.keys(data).length > 0) {
            onExtracted(data);
            setJustExtracted(true);
          }
        });
      } else {
        // Upload failed — never persist a blob: URL into the entry (it dies on
        // refresh and syncs a broken link). Surface a retry/dismiss instead.
        markPreviewFailed(localUrl);
      }
    } catch {
      markPreviewFailed(localUrl);
    }
  };

  // Flip a pending preview into its failed state so the user can dismiss or
  // re-pick. The failed thumbnail UI (X overlay) is rendered below.
  const markPreviewFailed = (localUrl: string) => {
    setPendingPreviews((prev) =>
      prev.map((p) => (p.localUrl === localUrl ? { ...p, uploading: false, failed: true } : p))
    );
  };

  // ── Scanner modal ──────────────────────────────────────────────────────────
  const scannerModal = scannerOpen ? createPortal(
    <div className="fixed inset-0 z-modal flex flex-col bg-black">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-tea-gold/80" />
          <span className="text-ui-12 uppercase tracking-[0.14em] text-tea-gold/80 font-medium">
            {scanStep === 'camera'   && 'Point at label'}
            {scanStep === 'scanning' && 'Reading label…'}
            {scanStep === 'result'   && (extractedPreview ? 'Found this' : 'Nothing found')}
            {scanStep === 'denied'   && 'Camera unavailable'}
          </span>
        </div>
        <button
          type="button"
          onClick={closeScanner}
          className="tap-target flex h-11 w-11 items-center justify-center rounded-full bg-tea-text/10 text-tea-text hover:bg-tea-text/20 transition-colors"
          aria-label="Close label scanner"
        >
          <X size={16} />
        </button>
      </div>

      {/* Camera / captured frame area */}
      <div className="relative flex-1 min-h-0 overflow-hidden bg-black">

        {/* Live video — ref callback starts camera when this element mounts */}
        {scanStep === 'camera' && (
          <video
            ref={videoRefCallback}
            muted
            playsInline
            autoPlay
            className="w-full h-full object-cover"
          />
        )}

        {/* Frozen captured frame during scan + result */}
        {capturedDataUrl && scanStep !== 'camera' && (
          <img
            src={capturedDataUrl}
            alt="Captured"
            className="w-full h-full object-cover"
          />
        )}

        {/* Scan-line animation */}
        {scanStep === 'scanning' && (
          <>
            <div className="absolute inset-0 bg-tea-gold/8 pointer-events-none" />
            <motion.div
              className="absolute left-0 right-0 h-[2px] pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, var(--tea-gold) 50%, transparent 100%)',
                boxShadow: '0 0 12px 3px rgba(184,146,78,0.5)',
              }}
              animate={{ top: ['0%', '100%'] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
            />
          </>
        )}

        {/* Viewfinder corners */}
        {scanStep === 'camera' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-[70%] aspect-[4/3]">
              {(['top-0 left-0', 'top-0 right-0', 'bottom-0 right-0', 'bottom-0 left-0'] as const).map((corner, i) => (
                <span
                  key={corner}
                  className={`absolute w-8 h-8 ${corner}`}
                  style={{
                    borderColor: 'var(--tea-gold)',
                    borderTopWidth: i === 0 || i === 1 ? 2 : 0,
                    borderBottomWidth: i === 2 || i === 3 ? 2 : 0,
                    borderLeftWidth: i === 0 || i === 3 ? 2 : 0,
                    borderRightWidth: i === 1 || i === 2 ? 2 : 0,
                  }}
                />
              ))}
              <p className="absolute -bottom-6 left-0 right-0 text-center text-ui-12 text-tea-text/50">
                Align the tea label within the frame
              </p>
            </div>
          </div>
        )}

        {/* Denied state */}
        {scanStep === 'denied' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <p className="text-tea-text/80 text-ui-16 font-medium">Camera access denied</p>
            <p className="text-tea-text/50 text-ui-12 leading-relaxed">
              Allow camera access in your browser's address bar or site settings, then try again.
            </p>
            <button
              type="button"
              onClick={closeScanner}
              className="tap-target mt-2 min-h-11 px-4 py-2 rounded-xl border border-tea-border text-tea-text/70 text-ui-12 hover:bg-tea-text/10 transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Result sheet — slides up */}
      <AnimatePresence>
        {scanStep === 'result' && extractedPreview && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="shrink-0 bg-tea-surface rounded-t-xl px-4 pt-4 pb-6"
          >
            <div className="w-8 h-1 rounded-full bg-tea-border mx-auto mb-4" />
            <div className="space-y-1 mb-4">
              {extractedPreview.name && (
                <p className="text-ui-16 text-tea-text font-serif leading-snug">{extractedPreview.name}</p>
              )}
              {extractedPreview.chineseName && (
                <p className="text-ui-16 text-tea-text-sec font-chinese">{extractedPreview.chineseName}</p>
              )}
              {(extractedPreview.type || extractedPreview.year || extractedPreview.season || extractedPreview.region) && (
                <p className="text-ui-12 text-tea-text-dim">
                  {[extractedPreview.type, extractedPreview.year, extractedPreview.season, extractedPreview.region].filter(Boolean).join(' · ')}
                </p>
              )}
              {(extractedPreview.price != null || extractedPreview.grams != null) && (
                <p className="text-ui-12 text-tea-text-dim tabular-nums">
                  {[
                    extractedPreview.price != null && `NT$${extractedPreview.price}`,
                    extractedPreview.grams != null && `${extractedPreview.grams}g`,
                  ].filter(Boolean).join(' · ')}
                </p>
              )}
              {extractedPreview.extraNotes && (
                <p className="text-ui-12 text-tea-text-dim leading-relaxed line-clamp-2 pt-0.5">{extractedPreview.extraNotes}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRetake}
                className="tap-target flex min-h-11 items-center justify-center gap-1.5 flex-1 py-3 rounded-xl border border-tea-border text-tea-text-sec text-ui-12 font-medium hover:bg-tea-elevated transition-colors"
              >
                <RefreshCw size={13} />
                Retake
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="tap-target min-h-11 flex-[2] py-3 rounded-xl bg-tea-gold text-tea-bg text-ui-12 font-semibold hover:bg-tea-gold/90 transition-colors"
              >
                Apply to form
              </button>
            </div>
            {/* Escape hatch — wrong read shouldn't force a retake. Keep the
                photo, drop the extracted fields. */}
            {capturedImageUrl && (
              <button
                type="button"
                onClick={handleUsePhotoOnly}
                className="tap-target mt-2 min-h-11 w-full text-center text-ui-12 text-tea-text-dim hover:text-tea-text-sec transition-colors"
              >
                Keep photo only
              </button>
            )}
          </motion.div>
        )}

        {scanStep === 'result' && !extractedPreview && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="shrink-0 bg-tea-surface rounded-t-xl px-4 pt-4 pb-6 text-center space-y-3"
          >
            <div className="w-8 h-1 rounded-full bg-tea-border mx-auto mb-2" />
            <p className="text-ui-16 text-tea-text-sec">
              {scanError && scanError !== 'extract_failed'
                ? SCAN_ERROR_COPY[scanError]
                : "Couldn't read the label."}
            </p>
            <p className="text-ui-12 text-tea-text-dim">
              {capturedImageUrl
                ? 'No problem, the photo is saved. Keep it as-is, or retake for a cleaner read.'
                : capturedDataUrl
                  ? "The photo hasn't reached the server yet. You can still keep it; it uploads in the background."
                  : 'Try moving closer, better lighting, or a flatter angle.'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRetake}
                className="tap-target flex min-h-11 items-center justify-center gap-1.5 flex-1 py-3 rounded-xl border border-tea-border text-tea-text-sec text-ui-12 font-medium hover:bg-tea-elevated transition-colors"
              >
                <RefreshCw size={13} />
                {capturedImageUrl ? 'Retake' : 'Try again'}
              </button>
              {/* Uploaded — or still local with a background retry — either way
                  a photo-only capture can stand. */}
              {(capturedImageUrl || capturedDataUrl) && (
                <button
                  type="button"
                  onClick={handleUsePhotoOnly}
                  className="tap-target min-h-11 flex-[2] py-3 rounded-xl bg-tea-gold text-tea-bg text-ui-12 font-semibold hover:bg-tea-gold/90 transition-colors"
                >
                  Use this photo
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shutter button */}
      {scanStep === 'camera' && (
        <div className="shrink-0 flex items-center justify-center py-8">
          <button
            type="button"
            onClick={handleCapture}
            className="w-16 h-16 rounded-full border-4 border-tea-border bg-tea-text/20 hover:bg-tea-text/30 active:scale-95 transition-all flex items-center justify-center"
            aria-label="Capture"
          >
            <div className="w-10 h-10 rounded-full bg-tea-text/90" />
          </button>
        </div>
      )}
    </div>,
    document.body
  ) : null;

  // ── Lightbox ───────────────────────────────────────────────────────────────
  const lightbox = lightboxIndex !== null && allPhotos[lightboxIndex]
    ? createPortal(
        <motion.div
          ref={lightboxRef}
          key="lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-modal flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.88)' }}
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
        >
          <button
            ref={lightboxCloseRef}
            type="button"
            onClick={closeLightbox}
            className="tap-target absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-tea-text/10 text-tea-text hover:bg-tea-text/20 transition-colors"
            aria-label="Close photo viewer"
          >
            <X size={18} />
          </button>
          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              className="tap-target absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-tea-text/10 text-tea-text hover:bg-tea-text/20 transition-colors"
              aria-label="Previous photo"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <motion.img
            key={lightboxIndex}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            src={mediaUrl(allPhotos[lightboxIndex])}
            alt={`Photo ${lightboxIndex + 1}`}
            className="max-w-[92vw] max-h-[88vh] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {lightboxIndex < allPhotos.length - 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              className="tap-target absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-tea-text/10 text-tea-text hover:bg-tea-text/20 transition-colors"
              aria-label="Next photo"
            >
              <ChevronRight size={20} />
            </button>
          )}
          {allPhotos.length > 1 && (
            <div className="absolute bottom-4 flex max-w-[90vw] flex-wrap justify-center">
              {allPhotos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                  className="tap-target flex h-11 w-11 items-center justify-center rounded-full"
                  aria-label={`View photo ${i + 1}`}
                  aria-current={i === lightboxIndex ? 'true' : undefined}
                >
                  <span className={`h-1.5 w-1.5 rounded-full transition-colors ${i === lightboxIndex ? 'bg-tea-text' : 'bg-tea-text/30'}`} />
                </button>
              ))}
            </div>
          )}
        </motion.div>,
        document.body
      )
    : null;

  // ── Quiet scan-failure line ─────────────────────────────────────────────
  // Rendered under the photo area in both variants. Three distinct states:
  // scanner unavailable (no provider), scanner unreachable (provider error),
  // and unreadable label (with Retry). An empty read stays silent.
  const scanErrorLine = scanError ? (
    <div className="flex items-center gap-2 pt-1.5" role="status">
      <span className="text-ui-12 text-tea-text-dim italic">{SCAN_ERROR_COPY[scanError]}</span>
      {scanError === 'extract_failed' && lastScanFile && (
        <button
          type="button"
          onClick={handleRetryScan}
          disabled={retryingScan}
          className="tap-target min-h-11 text-ui-12 text-tea-text-sec underline decoration-dashed underline-offset-2 transition-colors hover:text-tea-text disabled:opacity-50"
        >
          {retryingScan ? 'Retrying' : 'Retry'}
        </button>
      )}
    </div>
  ) : null;

  // ── Hero tile pieces ──────────────────────────────────────────────────────
  // The newest upload-in-flight owns the tile while it lands; otherwise the
  // most recent stored photo does. Earlier shots drop to a thumb row below.
  const heroPending = pendingPreviews.filter((p) => !p.failed).slice(-1)[0] ?? null;
  const heroValidUrl = !heroPending && validPhotos.length > 0 ? validPhotos[validPhotos.length - 1] : null;
  const heroExtraCount =
    validPhotos.length + pendingPreviews.length - (heroPending || heroValidUrl ? 1 : 0);

  const heroArea = (
    <div className="w-full">
      <div className="relative w-full aspect-[4/3] overflow-hidden rounded-xl bg-tea-elevated">
        {heroPending ? (
          <>
            <img
              src={heroPending.localUrl}
              alt="Uploading photo"
              className={`h-full w-full object-cover ${heroPending.uploading ? 'opacity-60' : 'opacity-40'}`}
            />
            {heroPending.uploading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border border-tea-border border-t-transparent" />
              </div>
            )}
            {heroPending.failed && (
              <button
                type="button"
                onClick={() =>
                  setPendingPreviews((prev) => prev.filter((p) => p.localUrl !== heroPending.localUrl))
                }
                className="absolute inset-0 flex items-center justify-center text-tea-error"
                aria-label="Upload failed, tap to dismiss"
              >
                <X size={20} />
              </button>
            )}
          </>
        ) : heroValidUrl ? (
          <button
            type="button"
            onClick={(event) => {
              lightboxTriggerRef.current = event.currentTarget;
              setMenuPhotoIndex(validPhotos.length - 1);
            }}
            className="block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/60"
            aria-haspopup="menu"
            aria-label="Photo actions"
            title="Tap for options"
          >
            <img
              src={mediaUrl(heroValidUrl)}
              alt="Capture photo"
              className="pointer-events-none h-full w-full object-cover"
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={openScanner}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-tea-text-sec transition-colors hover:text-tea-text focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/60"
            aria-label="Open camera"
          >
            <Camera size={30} strokeWidth={1.25} className="text-tea-gold" />
            <span className="text-ui-11 uppercase tracking-[0.16em]">Photo</span>
          </button>
        )}

        {/* Overlay actions, bottom-right of the tile. Before a photo only the
            camera-roll glyph shows (the tile itself is the camera); after a
            photo the scan action joins it for retake/rescan. */}
        <div className="absolute bottom-2.5 right-2.5 flex gap-2">
          {(heroValidUrl || heroPending) && (
            <button
              type="button"
              onClick={openScanner}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-tea-bg/70 text-tea-gold backdrop-blur-sm transition-colors hover:bg-tea-bg/90"
              aria-label="Scan label"
              title="Scan label"
            >
              {justExtracted ? <Check size={18} /> : <Sparkles size={18} strokeWidth={1.5} />}
            </button>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-tea-bg/70 text-tea-text-sec backdrop-blur-sm transition-colors hover:bg-tea-bg/90 hover:text-tea-text"
            aria-label="Add from camera roll"
            title="Add from camera roll"
          >
            <ImagePlus size={18} strokeWidth={1.5} />
          </button>
        </div>

        {allPhotos.length > 1 && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-tea-bg/70 px-2 py-0.5 text-ui-10 tabular-nums text-tea-text-sec backdrop-blur-sm">
            {allPhotos.length} photos
          </span>
        )}
      </div>

      {/* Earlier shots + uploads in flight, as small thumbs under the hero. */}
      {heroExtraCount > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {validPhotos.map((url, i) =>
            url === heroValidUrl ? null : (
              <button
                key={url}
                type="button"
                onClick={(event) => {
                  lightboxTriggerRef.current = event.currentTarget;
                  setMenuPhotoIndex(i);
                }}
                className={`w-[60px] h-[60px] relative shrink-0 block rounded-md overflow-hidden border border-tea-border focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/60 transition-shadow ${
                  menuPhotoIndex === i ? 'ring-2 ring-tea-gold/60' : ''
                }`}
                aria-haspopup="menu"
                aria-expanded={menuPhotoIndex === i}
                aria-label="Photo actions"
                title="Tap for options"
              >
                <img
                  src={mediaUrl(url)}
                  alt={`Photo ${i + 1}`}
                  className="w-full h-full object-cover pointer-events-none"
                />
              </button>
            )
          )}
          {pendingPreviews.map((preview, i) =>
            preview === heroPending ? null : (
              <div key={preview.localUrl} className="relative shrink-0">
                <img
                  src={preview.localUrl}
                  alt={`Uploading ${i + 1}`}
                  className={`w-[60px] h-[60px] rounded-md object-cover ${preview.uploading ? 'opacity-60' : 'opacity-40'}`}
                />
                {preview.uploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-md">
                    <div className="w-4 h-4 border border-tea-border border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {preview.failed && (
                  <button
                    type="button"
                    onClick={() => setPendingPreviews((prev) => prev.filter((p) => p.localUrl !== preview.localUrl))}
                    className="absolute inset-0 flex items-center justify-center rounded-md text-tea-error"
                    aria-label="Upload failed"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            )
          )}
        </div>
      )}

      {scanErrorLine}
    </div>
  );

  // ── Inline row ─────────────────────────────────────────────────────────────
  // Wrapped in a recessed tray so the thumbnails + scan/camera actions read as
  // one contained unit instead of loose buttons floating on the page.
  const stripRow = (
    <>
      <div className={`flex w-full min-w-0 flex-wrap items-center ${stripGap}`}>
        {validPhotos.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={(event) => {
              lightboxTriggerRef.current = event.currentTarget;
              setMenuPhotoIndex(i);
            }}
            className={`${thumbCls} relative shrink-0 block rounded-md overflow-hidden border border-tea-border focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/60 transition-shadow ${
              menuPhotoIndex === i ? 'ring-2 ring-tea-gold/60' : ''
            }`}
            aria-haspopup="menu"
            aria-expanded={menuPhotoIndex === i}
            aria-label="Photo actions"
            title="Tap for options"
          >
            <img
              src={mediaUrl(url)}
              alt={`Photo ${i + 1}`}
              className="w-full h-full object-cover pointer-events-none"
            />
          </button>
        ))}

        {pendingPreviews.map((preview, i) => (
          <div key={preview.localUrl} className="relative shrink-0">
            <img
              src={preview.localUrl}
              alt={`Uploading ${i + 1}`}
              className={`${thumbCls} rounded-md object-cover ${preview.uploading ? 'opacity-60' : 'opacity-40'}`}
            />
            {preview.uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/20">
                <div className="w-4 h-4 border border-tea-border border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {preview.failed && (
              <button
                type="button"
                onClick={() => setPendingPreviews((prev) => prev.filter((p) => p.localUrl !== preview.localUrl))}
                className="absolute inset-0 flex items-center justify-center rounded-md bg-tea-error/20 text-tea-error"
                aria-label="Upload failed"
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}


        <div className={`flex min-w-0 flex-1 flex-row justify-end ${btnGap}`}>
          {/* Sparkles = AI label scanner. Quiet at rest (gold-scarcity) —
              gold only lights up on the just-scanned success tick. */}
          <button
            type="button"
            onClick={openScanner}
            className={`${btnCls} curate-action shrink-0 border transition-all ${
              justExtracted
                ? 'border-tea-gold/50 text-tea-gold bg-tea-gold/15'
                : 'bg-tea-surface border-tea-border text-tea-text-sec hover:text-tea-text hover:border-tea-gold/30'
            }`}
            aria-label="Scan label"
            title="Scan label"
            data-curate-action
          >
            {justExtracted ? <Check size={btnIcon} /> : <Sparkles size={btnIcon} strokeWidth={1.5} />}
            <span>{justExtracted ? 'Label read' : 'Scan label'}</span>
          </button>

          {/* Camera icon = plain gallery picker. Quieter visual weight so
              the eye lands on the Sparkles scan button first. */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`${btnCls} curate-action shrink-0 border border-tea-border bg-tea-surface text-tea-text-sec hover:border-tea-gold/30 hover:text-tea-text`}
            aria-label="Add photo"
            title="Add photo"
            data-curate-action
          >
            <Camera size={btnIcon} strokeWidth={1.5} />
            <span>Add photo</span>
          </button>
        </div>
      </div>
      {scanErrorLine}
    </>
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {variant === 'hero' ? heroArea : stripRow}

      {/* Action menu: a bottom sheet so it never clips at the viewport edge
          and gives big thumb-friendly rows. Renders once outside the
          thumbnail loop so we can address any photo by index. */}
      <BottomSheet
          open={menuPhotoIndex !== null}
          onOpenChange={(open) => { if (!open) setMenuPhotoIndex(null); }}
          title="Photo"
          description="Choose what to do with this photo"
        >
          <div className="flex flex-col gap-0.5 px-1">
            <SheetOption
              label="View full size"
              leading={<Maximize2 size={18} strokeWidth={1.75} className="text-tea-text-sec" />}
              onSelect={() => {
                if (menuPhotoIndex !== null) setLightboxIndex(menuPhotoIndex);
                setMenuPhotoIndex(null);
              }}
            />
            <SheetOption
              label="Edit photo"
              hint="Crop, rotate, reposition"
              leading={<Edit3 size={18} strokeWidth={1.75} className="text-tea-text-sec" />}
              onSelect={() => {
                if (menuPhotoIndex !== null) {
                  const targetUrl = validPhotos[menuPhotoIndex];
                  if (targetUrl) setEditingPhotoUrl(targetUrl);
                }
                setMenuPhotoIndex(null);
              }}
            />
            {onRemovePhoto && (
              <SheetOption
                label="Delete"
                hint="Remove this photo from the entry"
                leading={<Trash2 size={18} strokeWidth={1.75} className="text-tea-error" />}
                onSelect={() => {
                  if (menuPhotoIndex !== null) {
                    const targetUrl = validPhotos[menuPhotoIndex];
                    if (targetUrl && photos) {
                      onRemovePhoto(photos.indexOf(targetUrl));
                    }
                  }
                  setMenuPhotoIndex(null);
                }}
              />
            )}
          </div>
        </BottomSheet>

      {scannerModal}
      {lightbox}

      {/* In-app photo editor — wraps react-easy-crop via SquareCropModal.
          Output goes back through api.uploadImage and replaces the original
          via onPhotoReplaced so callers don't need to know the new URL. */}
      <SquareCropModal
        isOpen={!!editingPhotoUrl}
        source={editingPhotoUrl}
        title="Edit photo"
        confirmLabel={savingEdit ? 'Saving…' : 'Save'}
        outputSize={800}
        outputQuality={0.7}
        onClose={() => { if (!savingEdit) setEditingPhotoUrl(null); }}
        onConfirm={async (blob) => {
          if (!editingPhotoUrl) return;
          setSavingEdit(true);
          try {
            const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
            const newUrl = await api.uploadImage(file).catch(() => null);
            if (newUrl) {
              onPhotoReplaced?.(editingPhotoUrl, newUrl);
            }
          } finally {
            setSavingEdit(false);
            setEditingPhotoUrl(null);
          }
        }}
      />
    </>
  );
};

export default PhotoCapture;
