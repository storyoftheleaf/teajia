import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Check, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../lib/api';
import { compressImage } from '../../lib/imageCompressor';

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
  /** Replace a previously added photo URL (used when local preview is swapped for server URL) */
  onPhotoReplaced?: (oldUrl: string, newUrl: string) => void;
  photos?: string[];
  onRemovePhoto?: (index: number) => void;
}

interface PendingPreview {
  localUrl: string;
  uploading: boolean;
  failed: boolean;
}

export const PhotoCapture: React.FC<PhotoCaptureProps> = ({
  onExtracted,
  onPhotoTaken,
  onPhotoReplaced,
  photos,
  onRemovePhoto,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  // Local previews shown immediately on file select, before server URL is ready
  const [pendingPreviews, setPendingPreviews] = useState<PendingPreview[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [justExtracted, setJustExtracted] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const validPhotos = (photos ?? []).filter(Boolean);
  // All photos for lightbox = saved + still-uploading previews
  const allPhotos = [
    ...validPhotos,
    ...pendingPreviews.filter((p) => !p.failed).map((p) => p.localUrl),
  ];

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      pendingPreviews.forEach((p) => URL.revokeObjectURL(p.localUrl));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset justExtracted flash
  useEffect(() => {
    if (!justExtracted) return;
    const t = setTimeout(() => setJustExtracted(false), 1500);
    return () => clearTimeout(t);
  }, [justExtracted]);

  // Lightbox keyboard navigation
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    // Show local preview immediately — no waiting for upload
    const localUrl = URL.createObjectURL(file);
    setPendingPreviews((prev) => [...prev, { localUrl, uploading: true, failed: false }]);

    try {
      const compressed = await compressImage(file);
      const compressedFile = new File([compressed], 'photo.jpg', { type: 'image/jpeg' });

      // Upload only — extraction is triggered separately via the ✦ button
      const imageUrl = await api.uploadImage(compressedFile).catch(() => null);

      if (imageUrl) {
        // Swap local preview for permanent server URL
        onPhotoTaken(imageUrl);
        if (onPhotoReplaced) onPhotoReplaced(localUrl, imageUrl);
        setPendingPreviews((prev) => prev.filter((p) => p.localUrl !== localUrl));
        URL.revokeObjectURL(localUrl);
      } else {
        // Upload failed — keep the local blob URL so the capture is not lost
        onPhotoTaken(localUrl);
        setPendingPreviews((prev) => prev.filter((p) => p.localUrl !== localUrl));
      }
    } catch {
      // Same fallback on unexpected error
      onPhotoTaken(localUrl);
      setPendingPreviews((prev) => prev.filter((p) => p.localUrl !== localUrl));
    }
  };

  // Run AI extraction on the most recent saved photo
  const handleExtract = async () => {
    const lastUrl = validPhotos[validPhotos.length - 1];
    if (!lastUrl || extracting) return;
    setExtracting(true);
    try {
      const res = await fetch(lastUrl);
      const blob = await res.blob();
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
      const result = await api.extractFromImage(file).catch(() => null);
      if (result) {
        const data: ExtractedTeaData = {};
        const r = result as Record<string, any>;
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
        onExtracted(data);
        setJustExtracted(true);
      }
    } finally {
      setExtracting(false);
    }
  };

  const lightbox = lightboxIndex !== null && allPhotos[lightboxIndex]
    ? createPortal(
        <motion.div
          key="lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.88)' }}
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X size={18} />
          </button>
          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
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
              className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
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
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === lightboxIndex ? 'bg-white' : 'bg-white/30'}`}
                />
              ))}
            </div>
          )}
        </motion.div>,
        document.body
      )
    : null;

  return (
    <>
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Hidden file input — no capture attr so iOS/Android shows camera+gallery sheet */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Saved photo thumbnails */}
        {validPhotos.map((url, i) => (
          <div key={url} className="relative shrink-0">
            <img
              src={url}
              alt={`Photo ${i + 1}`}
              className="w-8 h-8 rounded-lg object-cover cursor-pointer"
              onClick={() => setLightboxIndex(i)}
            />
            {onRemovePhoto && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemovePhoto(photos!.indexOf(url)); }}
                className="absolute -top-1 -right-1 w-3.5 h-3.5 flex items-center justify-center rounded-full bg-tea-surface border border-tea-border text-tea-text-dim hover:text-red-400 transition-colors"
                aria-label="Remove photo"
              >
                <X size={8} strokeWidth={2.5} />
              </button>
            )}
          </div>
        ))}

        {/* Pending upload previews (local only, still uploading) */}
        {pendingPreviews.map((preview, i) => (
          <div key={preview.localUrl} className="relative shrink-0">
            <img
              src={preview.localUrl}
              alt={`Uploading ${i + 1}`}
              className={`w-8 h-8 rounded-lg object-cover ${preview.uploading ? 'opacity-60' : 'opacity-40'}`}
            />
            {preview.uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/20">
                <div className="w-3 h-3 border border-white/60 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {preview.failed && (
              <button
                type="button"
                onClick={() => setPendingPreviews((prev) => prev.filter((p) => p.localUrl !== preview.localUrl))}
                className="absolute inset-0 flex items-center justify-center rounded-lg bg-red-500/20 text-red-400"
                aria-label="Upload failed, tap to dismiss"
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}

        {/* Extract button — only when there's at least one saved photo */}
        {validPhotos.length > 0 && (
          <button
            type="button"
            onClick={handleExtract}
            disabled={extracting}
            className={`w-8 h-8 flex items-center justify-center rounded-xl border shrink-0 transition-colors ${
              extracting
                ? 'border-tea-gold/40 text-tea-gold animate-pulse bg-tea-gold/5'
                : justExtracted
                  ? 'border-tea-gold/40 text-tea-gold bg-tea-gold/10'
                  : 'border-tea-border bg-tea-elevated text-tea-text-dim hover:text-tea-gold hover:border-tea-gold/40'
            }`}
            aria-label="Extract tea info from photo"
            title="Read label"
          >
            {justExtracted ? <Check size={14} strokeWidth={2} /> : <Sparkles size={14} strokeWidth={1.5} />}
          </button>
        )}

        {/* Camera / gallery button */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-tea-elevated border border-tea-border text-tea-text-dim hover:text-tea-text hover:border-tea-gold/40 shrink-0 transition-colors"
          aria-label="Add photo"
        >
          <Camera size={16} strokeWidth={1.5} />
        </button>
      </div>

      {lightbox}
    </>
  );
};

export default PhotoCapture;
