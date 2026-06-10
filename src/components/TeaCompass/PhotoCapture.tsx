import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Check, ChevronLeft, ChevronRight, Edit3, Maximize2, RefreshCw, Sparkles, Trash2, X } from 'lucide-react';
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
}

interface PendingPreview {
  localUrl: string;
  uploading: boolean;
  failed: boolean;
}

type ScanStep = 'camera' | 'scanning' | 'result' | 'denied';

function parseExtractResult(r: Record<string, any>): ExtractedTeaData {
  const data: ExtractedTeaData = {};
  if (r.name || r.givenName || r.given_name) data.name = r.name || r.givenName || r.given_name;
  if (r.chineseName || r.chinese_name) data.chineseName = r.chineseName || r.chinese_name;
  if (r.type || r.productType || r.product_type) data.type = r.type || r.productType || r.product_type;
  if (r.form) data.form = r.form;
  if (r.year) data.year = typeof r.year === 'number' ? r.year : parseInt(r.year, 10) || undefined;
  if (r.season) data.season = r.season;
  if (r.region || r.originRegion || r.origin_region) data.region = r.region || r.originRegion || r.origin_region;
  if (r.price || r.priceAmount || r.price_amount) {
    const pv = r.price || r.priceAmount || r.price_amount;
    data.price = typeof pv === 'number' ? pv : parseFloat(pv) || undefined;
  }
  if (r.grams || r.weight) {
    const gv = r.grams || r.weight;
    data.grams = typeof gv === 'number' ? gv : parseFloat(gv) || undefined;
  }
  const extras: string[] = [];
  if (r.awards) extras.push(`Awards: ${r.awards}`);
  if (r.elevation || r.altitude) extras.push(`Elevation: ${r.elevation || r.altitude}`);
  if (r.farm || r.garden) extras.push(`Farm: ${r.farm || r.garden}`);
  if (r.vendor) extras.push(`Vendor: ${r.vendor}`);
  if (r.description) extras.push(r.description);
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
}) => {
  const isLg = size === 'lg';
  const thumbCls = isLg ? 'w-[60px] h-[60px]' : 'w-14 h-14';
  const btnCls = isLg
    ? 'w-11 h-11 rounded-xl'  // 44×44 — meets WCAG 2.5.5 floor without tap-target padding
    : 'w-7 h-7 rounded-xl';
  const btnIcon = isLg ? 18 : 12;
  const btnGap = isLg ? 'gap-2' : 'gap-1';
  const stripGap = isLg ? 'gap-2' : 'gap-1.5';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);

  const [pendingPreviews, setPendingPreviews] = useState<PendingPreview[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
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

      const [imageUrl, result] = await Promise.all([
        api.uploadImage(file).catch(() => null),
        api.extractFromImage(file).catch(() => null),
      ]);

      if (imageUrl) setCapturedImageUrl(imageUrl);
      if (result) setExtractedPreview(parseExtractResult(result as Record<string, any>));
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

  const handleApply = () => {
    if (capturedImageUrl) onPhotoTaken(capturedImageUrl);
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
          className="w-8 h-8 flex items-center justify-center rounded-full bg-tea-text/10 text-tea-text hover:bg-tea-text/20 transition-colors"
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
              <p className="absolute -bottom-6 left-0 right-0 text-center text-ui-11 text-tea-text/50">
                Align the tea label within the frame
              </p>
            </div>
          </div>
        )}

        {/* Denied state */}
        {scanStep === 'denied' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <p className="text-tea-text/80 text-ui-14 font-medium">Camera access denied</p>
            <p className="text-tea-text/50 text-ui-12 leading-relaxed">
              Allow camera access in your browser's address bar or site settings, then try again.
            </p>
            <button
              type="button"
              onClick={closeScanner}
              className="mt-2 px-4 py-2 rounded-xl border border-tea-border text-tea-text/70 text-ui-12 hover:bg-tea-text/10 transition-colors"
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
                <p className="text-ui-13 text-tea-text-sec font-chinese">{extractedPreview.chineseName}</p>
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
                <p className="text-ui-11 text-tea-text-dim leading-relaxed line-clamp-2 pt-0.5">{extractedPreview.extraNotes}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRetake}
                className="flex items-center justify-center gap-1.5 flex-1 py-3 rounded-xl border border-tea-border text-tea-text-sec text-ui-13 font-medium hover:bg-tea-elevated transition-colors"
              >
                <RefreshCw size={13} />
                Retake
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="flex-[2] py-3 rounded-xl bg-tea-gold text-tea-bg text-ui-13 font-semibold hover:bg-tea-gold/90 transition-colors"
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
                className="mt-2 w-full text-center text-ui-12 text-tea-text-dim hover:text-tea-text-sec transition-colors"
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
            <p className="text-ui-13 text-tea-text-sec">Couldn't read the label.</p>
            <p className="text-ui-12 text-tea-text-dim">
              {capturedImageUrl
                ? 'No problem — the photo is saved. Keep it as-is, or retake for a cleaner read.'
                : 'Try moving closer, better lighting, or a flatter angle.'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRetake}
                className="flex items-center justify-center gap-1.5 flex-1 py-3 rounded-xl border border-tea-border text-tea-text-sec text-ui-13 font-medium hover:bg-tea-elevated transition-colors"
              >
                <RefreshCw size={13} />
                {capturedImageUrl ? 'Retake' : 'Try again'}
              </button>
              {/* The frame already uploaded — let a photo-only capture stand. */}
              {capturedImageUrl && (
                <button
                  type="button"
                  onClick={handleUsePhotoOnly}
                  className="flex-[2] py-3 rounded-xl bg-tea-gold text-tea-bg text-ui-13 font-semibold hover:bg-tea-gold/90 transition-colors"
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
          key="lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-toast flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.88)' }}
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-tea-text/10 text-tea-text hover:bg-tea-text/20 transition-colors"
          >
            <X size={18} />
          </button>
          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-tea-text/10 text-tea-text hover:bg-tea-text/20 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <motion.img
            key={lightboxIndex}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            src={allPhotos[lightboxIndex]}
            alt={`Photo ${lightboxIndex + 1}`}
            className="max-w-[92vw] max-h-[88vh] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {lightboxIndex < allPhotos.length - 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-tea-text/10 text-tea-text hover:bg-tea-text/20 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          )}
          {allPhotos.length > 1 && (
            <div className="absolute bottom-6 flex gap-1.5">
              {allPhotos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === lightboxIndex ? 'bg-tea-text' : 'bg-tea-text/30'}`}
                />
              ))}
            </div>
          )}
        </motion.div>,
        document.body
      )
    : null;

  // ── Inline row ─────────────────────────────────────────────────────────────
  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className={`flex items-center ${stripGap} ${isLg ? 'flex-1 min-w-0 flex-wrap' : 'shrink-0'}`}>
        {validPhotos.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setMenuPhotoIndex(i)}
            className={`${thumbCls} relative shrink-0 block rounded-xl overflow-hidden border border-tea-border focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/60 transition-shadow ${
              menuPhotoIndex === i ? 'ring-2 ring-tea-gold/60' : ''
            }`}
            aria-haspopup="menu"
            aria-expanded={menuPhotoIndex === i}
            aria-label="Photo actions"
            title="Tap for options"
          >
            <img
              src={url}
              alt={`Photo ${i + 1}`}
              className="w-full h-full object-cover pointer-events-none"
            />
          </button>
        ))}

        {/* Action menu — bottom sheet so it never clips at the viewport edge
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

        {pendingPreviews.map((preview, i) => (
          <div key={preview.localUrl} className="relative shrink-0">
            <img
              src={preview.localUrl}
              alt={`Uploading ${i + 1}`}
              className={`${thumbCls} rounded-xl object-cover ${preview.uploading ? 'opacity-60' : 'opacity-40'}`}
            />
            {preview.uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/20">
                <div className="w-4 h-4 border border-tea-border border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {preview.failed && (
              <button
                type="button"
                onClick={() => setPendingPreviews((prev) => prev.filter((p) => p.localUrl !== preview.localUrl))}
                className="absolute inset-0 flex items-center justify-center rounded-xl bg-tea-error/20 text-tea-error"
                aria-label="Upload failed"
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}

        <div className={`flex ${isLg ? 'flex-row ml-auto' : 'flex-col'} ${btnGap} shrink-0`}>
          {/* Sparkles = AI label scanner. Carries a subtle gold accent at
              rest so it reads as the "magic" primary action — distinct
              from the plain Camera button which is just a gallery picker. */}
          <button
            type="button"
            onClick={openScanner}
            className={`${btnCls} ${isLg ? '' : 'tap-target'} flex items-center justify-center border shrink-0 transition-all ${
              justExtracted
                ? 'border-tea-gold/50 text-tea-gold bg-tea-gold/15'
                : 'border-tea-gold/30 bg-tea-gold/[0.06] text-tea-gold hover:bg-tea-gold/[0.12] hover:border-tea-gold/50'
            }`}
            style={
              justExtracted
                ? undefined
                : { boxShadow: 'inset 0 1px 0 rgb(var(--tea-gold-rgb) / 0.10)' }
            }
            aria-label="Scan label"
            title="Scan label"
          >
            {justExtracted ? <Check size={btnIcon} /> : <Sparkles size={btnIcon} strokeWidth={1.5} />}
          </button>

          {/* Camera icon = plain gallery picker. Quieter visual weight so
              the eye lands on the Sparkles scan button first. */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`${btnCls} ${isLg ? '' : 'tap-target'} flex items-center justify-center bg-tea-elevated border border-tea-border text-tea-text-sec hover:text-tea-text hover:border-tea-gold/40 shrink-0 transition-colors`}
            aria-label="Add photo"
            title="Add photo"
          >
            <Camera size={btnIcon} strokeWidth={1.5} />
          </button>
        </div>
      </div>

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
