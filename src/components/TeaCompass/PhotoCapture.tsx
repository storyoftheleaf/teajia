import React, { useRef, useState, useEffect } from 'react';
import { Camera, Check } from 'lucide-react';
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
}

type CaptureState = 'idle' | 'loading' | 'done';

export const PhotoCapture: React.FC<PhotoCaptureProps> = ({ onExtracted, onPhotoTaken }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<CaptureState>('idle');

  // Reset done state back to idle after a brief flash
  useEffect(() => {
    if (state !== 'done') return;
    const timer = setTimeout(() => setState('idle'), 1500);
    return () => clearTimeout(timer);
  }, [state]);

  const handleCapture = () => {
    if (state === 'loading') return;
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected
    e.target.value = '';

    setState('loading');

    try {
      // Compress the image
      const compressed = await compressImage(file);
      const compressedFile = new File([compressed], 'photo.jpg', { type: 'image/jpeg' });

      // Run extraction and upload in parallel
      const [extractResult, imageUrl] = await Promise.all([
        api.extractFromImage(compressedFile).catch(() => null),
        api.uploadImage(compressedFile).catch(() => null),
      ]);

      // Notify parent of photo URL
      if (imageUrl) {
        onPhotoTaken(imageUrl);
      }

      // Map the Gemini extraction response to our fields
      if (extractResult) {
        const data: ExtractedTeaData = {};
        const r = extractResult as Record<string, any>;

        if (r.name || r.givenName || r.given_name) {
          data.name = r.name || r.givenName || r.given_name;
        }
        if (r.chineseName || r.chinese_name) {
          data.chineseName = r.chineseName || r.chinese_name;
        }
        if (r.type || r.productType || r.product_type) {
          data.type = r.type || r.productType || r.product_type;
        }
        if (r.form) {
          data.form = r.form;
        }
        if (r.year) {
          data.year = typeof r.year === 'number' ? r.year : parseInt(r.year, 10) || undefined;
        }
        if (r.season) {
          data.season = r.season;
        }
        if (r.region || r.originRegion || r.origin_region) {
          data.region = r.region || r.originRegion || r.origin_region;
        }
        if (r.price || r.priceAmount || r.price_amount) {
          const pv = r.price || r.priceAmount || r.price_amount;
          data.price = typeof pv === 'number' ? pv : parseFloat(pv) || undefined;
        }
        if (r.grams || r.weight || r.stockGrams || r.stock_grams) {
          const gv = r.grams || r.weight || r.stockGrams || r.stock_grams;
          data.grams = typeof gv === 'number' ? gv : parseFloat(gv) || undefined;
        }

        // Collect any extra info into extraNotes
        const extras: string[] = [];
        if (r.awards) extras.push(`Awards: ${r.awards}`);
        if (r.elevation || r.altitude) extras.push(`Elevation: ${r.elevation || r.altitude}`);
        if (r.farm || r.garden || r.plantation) extras.push(`Farm: ${r.farm || r.garden || r.plantation}`);
        if (r.vendor) extras.push(`Vendor: ${r.vendor}`);
        if (r.description) extras.push(r.description);
        if (r.processingNotes || r.processing_notes) extras.push(r.processingNotes || r.processing_notes);
        if (extras.length > 0) data.extraNotes = extras.join(' · ');

        onExtracted(data);
      }

      setState('done');
    } catch (err) {
      console.error('Photo capture failed:', err);
      setState('idle');
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={handleCapture}
        className={`w-8 h-8 flex items-center justify-center rounded-xl bg-tea-elevated border border-tea-border text-tea-text-dim hover:text-tea-text hover:border-tea-gold/40 shrink-0 transition-colors ${
          state === 'loading' ? 'animate-pulse' : ''
        } ${state === 'done' ? 'text-tea-gold' : ''}`}
        aria-label="Capture photo"
        disabled={state === 'loading'}
      >
        {state === 'done' ? (
          <Check size={16} strokeWidth={2} />
        ) : (
          <Camera size={16} strokeWidth={1.5} />
        )}
      </button>
    </>
  );
};

export default PhotoCapture;
