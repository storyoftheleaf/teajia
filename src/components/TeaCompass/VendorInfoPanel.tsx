import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Camera, Check, Phone, MessageCircle,
  ExternalLink, Loader2, Image, Store,
  Pencil,
} from 'lucide-react';
import { api, hasToken } from '../../lib/api';
import { compressImage } from '../../lib/imageCompressor';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import type { VendorDetails } from './types';

interface VendorInfoPanelProps {
  vendorName: string;
  vendorId?: string;
  /** Initial details pulled from entries for this vendor */
  vendorDetails?: VendorDetails;
  onDetailsChange: (details: VendorDetails) => void;
}

type UploadState = 'idle' | 'loading' | 'done';

export const VendorInfoPanel: React.FC<VendorInfoPanelProps> = ({
  vendorName,
  vendorId,
  vendorDetails,
  onDetailsChange,
}) => {
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load vendor details from API on first expand if we have an ID but no details
  useEffect(() => {
    if (loaded || !vendorId || !hasToken()) return;
    setLoaded(true);
    const hasInfo = vendorDetails && (vendorDetails.businessCardUrl || vendorDetails.storefrontUrl ||
      vendorDetails.lat != null || vendorDetails.phone);
    if (hasInfo) return; // Already have data from entries

    api.customers.get(vendorId).then((customer: any) => {
      if (!customer) return;
      const details: VendorDetails = {};
      if (customer.business_card_photo) details.businessCardUrl = customer.business_card_photo;
      if (customer.storefront_photo) details.storefrontUrl = customer.storefront_photo;
      if (customer.latitude != null) details.lat = customer.latitude;
      if (customer.longitude != null) details.lng = customer.longitude;
      if (customer.phone) details.phone = customer.phone;
      if (customer.whatsapp) details.whatsapp = customer.whatsapp;
      if (customer.wechat) details.wechat = customer.wechat;
      if (customer.line) details.line = customer.line;
      if (Object.values(details).some((v) => v != null)) {
        onDetailsChange({ ...details, ...vendorDetails });
      }
    }).catch(() => {});
  }, [vendorId, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save vendor details to API (debounced)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!vendorId || !hasToken() || !vendorDetails) return;
    const hasInfo = vendorDetails.businessCardUrl || vendorDetails.storefrontUrl ||
      vendorDetails.lat != null || vendorDetails.phone ||
      vendorDetails.whatsapp || vendorDetails.wechat || vendorDetails.line;
    if (!hasInfo) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const payload: Record<string, any> = {};
      if (vendorDetails.businessCardUrl) payload.business_card_photo = vendorDetails.businessCardUrl;
      if (vendorDetails.storefrontUrl) payload.storefront_photo = vendorDetails.storefrontUrl;
      if (vendorDetails.lat != null) payload.latitude = vendorDetails.lat;
      if (vendorDetails.lng != null) payload.longitude = vendorDetails.lng;
      if (vendorDetails.phone) payload.phone = vendorDetails.phone;
      if (vendorDetails.whatsapp) payload.whatsapp = vendorDetails.whatsapp;
      if (vendorDetails.wechat) payload.wechat = vendorDetails.wechat;
      if (vendorDetails.line) payload.line = vendorDetails.line;
      api.customers.update(vendorId, payload).catch(() => {});
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [vendorId, vendorDetails]);
  const [geoState, setGeoState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [storefrontState, setStorefrontState] = useState<UploadState>('idle');
  const [cardState, setCardState] = useState<UploadState>('idle');
  const storefrontRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLInputElement>(null);

  const d = vendorDetails || {};
  const hasPhotos = !!(d.businessCardUrl || d.storefrontUrl);
  const hasLocation = d.lat != null && d.lng != null;
  const hasContact = !!(d.phone || d.whatsapp || d.wechat || d.line);
  const hasAnyInfo = hasPhotos || hasLocation || hasContact;

  const updateDetail = useCallback(
    (key: keyof VendorDetails, value: string | number | undefined) => {
      onDetailsChange({ ...vendorDetails, [key]: value });
    },
    [vendorDetails, onDetailsChange]
  );

  const handleGeoPin = () => {
    if (!navigator.geolocation) return;
    setGeoState('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onDetailsChange({
          ...vendorDetails,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGeoState('done');
        setTimeout(() => setGeoState('idle'), 2000);
      },
      () => {
        setGeoState('error');
        setTimeout(() => setGeoState('idle'), 2000);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    key: 'businessCardUrl' | 'storefrontUrl',
    setState: (s: UploadState) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setState('loading');
    try {
      const compressed = await compressImage(file, 1200, 0.7);
      const compressedFile = new File([compressed], 'vendor-photo.jpg', { type: 'image/jpeg' });
      const imageUrl = await api.uploadImage(compressedFile);
      if (imageUrl) {
        // Auto-GPS for storefront photos
        if (key === 'storefrontUrl' && d.lat == null && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              onDetailsChange({
                ...vendorDetails,
                [key]: imageUrl,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              });
            },
            () => updateDetail(key, imageUrl),
            { enableHighAccuracy: true, timeout: 10000 }
          );
        } else {
          updateDetail(key, imageUrl);
        }
        setState('done');
        setTimeout(() => setState('idle'), 1500);
      } else {
        setState('idle');
      }
    } catch {
      setState('idle');
    }
  };

  // ── View mode (default) ──
  if (!editing && !hasAnyInfo) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex items-center gap-2 w-full py-2 px-3 rounded-lg bg-tea-surface/60 text-tea-text-dim text-xs hover:text-tea-text-sec transition-colors"
      >
        <Store size={13} />
        <span>Add vendor info</span>
      </button>
    );
  }

  if (!editing) {
    return (
      <div className="rounded-lg bg-tea-surface/60 overflow-hidden">
        {/* Photos strip */}
        {hasPhotos && (
          <div className="flex gap-0">
            {d.storefrontUrl && (
              <img
                src={d.storefrontUrl}
                alt={`${vendorName} storefront`}
                className={`object-cover h-24 ${d.businessCardUrl ? 'flex-1' : 'w-full'}`}
              />
            )}
            {d.businessCardUrl && (
              <img
                src={d.businessCardUrl}
                alt={`${vendorName} card`}
                className={`object-cover h-24 ${d.storefrontUrl ? 'w-20 shrink-0' : 'w-full'}`}
              />
            )}
          </div>
        )}

        {/* Info row */}
        <div className="px-3 py-2 flex items-center gap-3 flex-wrap">
          {hasLocation && (
            <a
              href={`https://maps.google.com/?q=${d.lat},${d.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-ui-11 text-tea-text-sec hover:text-tea-gold transition-colors"
            >
              <MapPin size={11} />
              <span className="num">{d.lat!.toFixed(4)}, {d.lng!.toFixed(4)}</span>
              <ExternalLink size={9} />
            </a>
          )}

          {d.phone && (
            <a href={`tel:${d.phone}`} className="flex items-center gap-1 text-ui-11 text-tea-text-sec hover:text-tea-gold transition-colors">
              <Phone size={11} />
              <span>{d.phone}</span>
            </a>
          )}

          {d.whatsapp && (
            <span className="flex items-center gap-1 text-ui-11 text-tea-text-dim">
              <MessageCircle size={11} />
              WA: {d.whatsapp}
            </span>
          )}

          {d.wechat && (
            <span className="flex items-center gap-1 text-ui-11 text-tea-text-dim">
              WeChat: {d.wechat}
            </span>
          )}

          {d.line && (
            <span className="flex items-center gap-1 text-ui-11 text-tea-text-dim">
              LINE: {d.line}
            </span>
          )}

          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ml-auto flex items-center gap-1 text-ui-11 text-tea-text-dim hover:text-tea-text-sec transition-colors"
          >
            <Pencil size={10} />
            Edit
          </button>
        </div>
      </div>
    );
  }

  // ── Edit mode ──
  return (
    <div className="rounded-lg bg-tea-surface/60 p-3 space-y-3">
      {/* Hidden file inputs */}
      <input ref={storefrontRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => handlePhotoUpload(e, 'storefrontUrl', setStorefrontState)} />
      <input ref={cardRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => handlePhotoUpload(e, 'businessCardUrl', setCardState)} />

      {/* Photo buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => storefrontRef.current?.click()}
          disabled={storefrontState === 'loading'}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-lg bg-tea-bg text-tea-text-sec text-xs hover:text-tea-text transition-colors"
        >
          {storefrontState === 'loading' ? <Loader2 size={14} className="animate-spin" /> :
           storefrontState === 'done' ? <Check size={14} className="text-tea-gold" /> :
           d.storefrontUrl ? <img src={d.storefrontUrl} alt="" className="w-8 h-8 rounded object-cover" loading="lazy" /> :
           <Camera size={14} />}
          <span>{d.storefrontUrl ? 'Update storefront' : 'Storefront photo'}</span>
        </button>

        <button
          type="button"
          onClick={() => cardRef.current?.click()}
          disabled={cardState === 'loading'}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-lg bg-tea-bg text-tea-text-sec text-xs hover:text-tea-text transition-colors"
        >
          {cardState === 'loading' ? <Loader2 size={14} className="animate-spin" /> :
           cardState === 'done' ? <Check size={14} className="text-tea-gold" /> :
           d.businessCardUrl ? <img src={d.businessCardUrl} alt="" className="w-8 h-8 rounded object-cover" loading="lazy" /> :
           <Image size={14} />}
          <span>{d.businessCardUrl ? 'Update card' : 'Business card'}</span>
        </button>
      </div>

      {/* GPS button */}
      <button
        type="button"
        onClick={handleGeoPin}
        disabled={geoState === 'loading'}
        className="flex items-center gap-2 w-full py-2.5 rounded-lg bg-tea-bg text-tea-text-sec text-xs hover:text-tea-text transition-colors justify-center"
      >
        {geoState === 'loading' ? <Loader2 size={14} className="animate-spin" /> :
         geoState === 'done' ? <Check size={14} className="text-tea-gold" /> :
         geoState === 'error' ? <MapPin size={14} className="text-red-400" /> :
         <MapPin size={14} />}
        <span>
          {hasLocation ? `Location: ${d.lat!.toFixed(4)}, ${d.lng!.toFixed(4)}` :
           geoState === 'error' ? 'GPS failed — try again' :
           'Drop pin at current location'}
        </span>
      </button>

      {/* Contact fields */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Phone size={11} className="text-tea-text-dim shrink-0" />
          <input
            type="tel"
            value={d.phone || ''}
            onChange={(e) => updateDetail('phone', e.target.value || undefined)}
            placeholder="Phone"
            className="flex-1 input-warm text-base rounded-md px-3 py-2 placeholder:text-tea-text-sec/70 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
          />
        </div>
        <div className="flex items-center gap-2">
          <MessageCircle size={11} className="text-tea-text-dim shrink-0" />
          <input
            type="text"
            value={d.whatsapp || ''}
            onChange={(e) => updateDetail('whatsapp', e.target.value || undefined)}
            placeholder="WhatsApp"
            className="flex-1 input-warm text-base rounded-md px-3 py-2 placeholder:text-tea-text-sec/70 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
          />
        </div>
        <div className="flex items-center gap-2">
          <MessageCircle size={11} className="text-tea-text-dim shrink-0" />
          <input
            type="text"
            value={d.wechat || ''}
            onChange={(e) => updateDetail('wechat', e.target.value || undefined)}
            placeholder="WeChat"
            className="flex-1 input-warm text-base rounded-md px-3 py-2 placeholder:text-tea-text-sec/70 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
          />
        </div>
        <div className="flex items-center gap-2">
          <MessageCircle size={11} className="text-tea-text-dim shrink-0" />
          <input
            type="text"
            value={d.line || ''}
            onChange={(e) => updateDetail('line', e.target.value || undefined)}
            placeholder="LINE"
            className="flex-1 input-warm text-base rounded-md px-3 py-2 placeholder:text-tea-text-sec/70 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
          />
        </div>
      </div>

      {/* Done button */}
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="w-full py-2.5 rounded-lg bg-tea-gold text-tea-bg text-xs font-semibold uppercase tracking-[0.1em] transition-opacity hover:opacity-90"
      >
        Done
      </button>
    </div>
  );
};

export default VendorInfoPanel;
