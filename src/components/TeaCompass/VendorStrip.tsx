import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, X, Search, Plus, Camera, Check, Phone,
  MessageCircle, ChevronDown, ExternalLink, Loader2,
} from 'lucide-react';
import { api, hasToken } from '../../lib/api';
import { compressImage } from '../../lib/imageCompressor';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import type { VendorDetails } from './types';

/* ── Types ──────────────────────────────────────────────── */

interface Vendor {
  id: string;
  name: string;
  tags?: string;
}

interface VendorStripProps {
  vendorName?: string;
  vendorId?: string;
  vendorDetails?: VendorDetails;
  onVendorSelect: (vendorId: string | undefined, vendorName: string) => void;
  onClear: () => void;
  onDetailsChange: (details: VendorDetails) => void;
}

/* ── Helpers ────────────────────────────────────────────── */

const PANEL_INITIAL = { height: 0, opacity: 0 };
const PANEL_ANIMATE = { height: 'auto' as const, opacity: 1 };
const PANEL_EXIT = { height: 0, opacity: 0 };
const PANEL_TRANSITION = { duration: 0.2, ease: [0.32, 0.72, 0, 1] as const };

type UploadState = 'idle' | 'loading' | 'done';

/* ── Photo button (reusable) ────────────────────────────── */

const PhotoButton: React.FC<{
  label: string;
  url?: string;
  onCapture: (url: string) => void;
}> = ({ label, url, onCapture }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>('idle');

  useEffect(() => {
    if (state !== 'done') return;
    const t = setTimeout(() => setState('idle'), 1500);
    return () => clearTimeout(t);
  }, [state]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setState('loading');
    try {
      const compressed = await compressImage(file, 1200, 0.7);
      const compressedFile = new File([compressed], 'vendor-photo.jpg', { type: 'image/jpeg' });
      const imageUrl = await api.uploadImage(compressedFile);
      if (imageUrl) {
        onCapture(imageUrl);
        setState('done');
      } else {
        setState('idle');
      }
    } catch {
      setState('idle');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />
      {url ? (
        <img
          src={url}
          alt={label}
          className="w-10 h-10 rounded object-cover shrink-0"
        />
      ) : null}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={state === 'loading'}
        className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md bg-tea-surface transition-colors shrink-0 ${
          state === 'loading' ? 'animate-pulse text-tea-text-dim' :
          state === 'done' ? 'text-tea-gold' :
          'text-tea-text-dim hover:text-tea-text-sec'
        }`}
      >
        {state === 'done' ? <Check size={12} /> : <Camera size={12} strokeWidth={1.5} />}
        <span>{url ? `Update ${label.toLowerCase()}` : label}</span>
      </button>
    </div>
  );
};

/* ── Main component ─────────────────────────────────────── */

export const VendorStrip: React.FC<VendorStripProps> = ({
  vendorName,
  vendorId,
  vendorDetails,
  onVendorSelect,
  onClear,
  onDetailsChange,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [geoState, setGeoState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const searchRef = useRef<HTMLInputElement>(null);
  const newNameRef = useRef<HTMLInputElement>(null);

  // Recent vendors from compass store
  const entries = useTeaCompassStore((s) => s.entries);
  const recentVendors = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of entries) {
      if (e.vendorName && !seen.has(e.vendorName)) {
        seen.set(e.vendorName, e.vendorId || '');
        if (seen.size >= 5) break;
      }
    }
    return Array.from(seen, ([name, id]) => ({ name, id }));
  }, [entries]);

  // Fetch vendor list from API (customers with tag containing 'vendor')
  useEffect(() => {
    if (!pickerOpen) return;
    if (vendors.length > 0) return;
    if (!hasToken()) return;

    setLoadingVendors(true);
    api.customers.list()
      .then((res: any) => {
        const list: Vendor[] = (res.customers || res || [])
          .filter((c: any) => c.tags?.includes('vendor') || c.tags?.includes('Vendor'))
          .map((c: any) => ({ id: c.id, name: c.name, tags: c.tags }));
        setVendors(list);
      })
      .catch(() => {})
      .finally(() => setLoadingVendors(false));
  }, [pickerOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus search when picker opens
  useEffect(() => {
    if (pickerOpen) {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [pickerOpen]);

  // Auto-focus new name input
  useEffect(() => {
    if (creatingNew) {
      setTimeout(() => newNameRef.current?.focus(), 50);
    }
  }, [creatingNew]);

  const filteredVendors = query.trim()
    ? vendors.filter((v) => v.name.toLowerCase().includes(query.toLowerCase()))
    : vendors;

  const filteredRecent = query.trim()
    ? recentVendors.filter((v) => v.name.toLowerCase().includes(query.toLowerCase()))
    : recentVendors;

  const handleSelectVendor = (id: string | undefined, name: string) => {
    onVendorSelect(id, name);
    setPickerOpen(false);
    setQuery('');
    setCreatingNew(false);
  };

  const handleCreateVendor = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    handleSelectVendor(undefined, trimmed);
    setNewName('');
  };

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

  const hasDetails = vendorDetails && (
    vendorDetails.businessCardUrl || vendorDetails.storefrontUrl ||
    vendorDetails.lat != null || vendorDetails.phone ||
    vendorDetails.whatsapp || vendorDetails.wechat || vendorDetails.line
  );

  return (
    <div className="space-y-0">
      {/* ── Strip row ── */}
      <div className="flex items-center gap-2 text-sm text-tea-text-sec py-1">
        <MapPin size={14} className="text-tea-text-dim flex-shrink-0" />
        {vendorName ? (
          <>
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className="truncate hover:text-tea-gold transition-colors py-1"
            >
              {vendorName}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="text-tea-text-dim hover:text-tea-text-sec transition-colors flex-shrink-0 p-1"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            className="text-tea-text-dim hover:text-tea-text-sec transition-colors py-1"
          >
            Tap to select vendor
          </button>
        )}
      </div>

      {/* ── Vendor picker panel ── */}
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            initial={PANEL_INITIAL}
            animate={PANEL_ANIMATE}
            exit={PANEL_EXIT}
            transition={PANEL_TRANSITION}
            className="overflow-hidden"
          >
            <div className="pt-2 pb-1 space-y-2">
              {/* Native select — triggers iOS wheel picker on mobile */}
              <select
                value={vendorId || vendorName || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__new__') {
                    setCreatingNew(true);
                    return;
                  }
                  if (!val) return;
                  // Check API vendors first, then recent
                  const apiVendor = vendors.find((v) => v.id === val);
                  if (apiVendor) {
                    handleSelectVendor(apiVendor.id, apiVendor.name);
                    return;
                  }
                  const recent = recentVendors.find((v) => v.name === val);
                  if (recent) {
                    handleSelectVendor(recent.id || undefined, recent.name);
                    return;
                  }
                  handleSelectVendor(undefined, val);
                }}
                className="w-full bg-tea-surface text-tea-text text-base rounded-lg px-3 py-3 border border-tea-border focus:border-tea-gold/50 outline-none transition-colors appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
              >
                <option value="" disabled>Select a vendor...</option>
                {recentVendors.length > 0 && (
                  <optgroup label="Recent">
                    {recentVendors.map((v) => (
                      <option key={`recent-${v.name}`} value={v.id || v.name}>{v.name}</option>
                    ))}
                  </optgroup>
                )}
                {vendors.length > 0 && (
                  <optgroup label="All Vendors">
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </optgroup>
                )}
                <option value="__new__">+ New vendor...</option>
              </select>

              {loadingVendors && (
                <div className="flex items-center justify-center py-2 text-tea-text-dim">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-xs ml-2">Loading vendors...</span>
                </div>
              )}

              {/* New vendor */}
              {creatingNew && (
                <div className="flex items-center gap-2">
                  <input
                    ref={newNameRef}
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateVendor()}
                    placeholder="Vendor name"
                    className="flex-1 bg-tea-surface text-tea-text text-base rounded-md px-3 py-2 placeholder:text-tea-text-dim border border-tea-border outline-none focus:border-tea-gold/50"
                  />
                  <button
                    type="button"
                    onClick={handleCreateVendor}
                    disabled={!newName.trim()}
                    className="bg-tea-gold text-tea-bg font-semibold text-xs uppercase tracking-[0.08em] px-4 py-2.5 rounded-lg disabled:opacity-40 transition-opacity"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreatingNew(false); setNewName(''); }}
                    className="text-tea-text-dim p-2"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── "Add details" expandable ── */}
      {vendorName && !pickerOpen && (
        <>
          <button
            type="button"
            onClick={() => setDetailsOpen((o) => !o)}
            className="flex items-center gap-1 text-xs text-tea-text-sec hover:text-tea-gold transition-colors mt-1"
          >
            <ChevronDown
              size={10}
              className={`transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
            />
            <span>{hasDetails ? 'Vendor details' : 'Add details'}</span>
          </button>

          <AnimatePresence>
            {detailsOpen && (
              <motion.div
                initial={PANEL_INITIAL}
            animate={PANEL_ANIMATE}
            exit={PANEL_EXIT}
            transition={PANEL_TRANSITION}
                className="overflow-hidden"
              >
                <div className="pt-2 pb-1 space-y-3">
                  {/* Business card photo */}
                  <PhotoButton
                    label="Business card"
                    url={vendorDetails?.businessCardUrl}
                    onCapture={(url) => updateDetail('businessCardUrl', url)}
                  />

                  {/* Storefront photo */}
                  <PhotoButton
                    label="Storefront"
                    url={vendorDetails?.storefrontUrl}
                    onCapture={(url) => updateDetail('storefrontUrl', url)}
                  />

                  {/* Map pin */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleGeoPin}
                      disabled={geoState === 'loading'}
                      className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md bg-tea-surface transition-colors shrink-0 ${
                        geoState === 'loading' ? 'animate-pulse text-tea-text-dim' :
                        geoState === 'done' ? 'text-tea-gold' :
                        geoState === 'error' ? 'text-red-400' :
                        'text-tea-text-dim hover:text-tea-text-sec'
                      }`}
                    >
                      {geoState === 'done' ? <Check size={12} /> :
                       geoState === 'loading' ? <Loader2 size={12} className="animate-spin" /> :
                       <MapPin size={12} strokeWidth={1.5} />}
                      <span>
                        {geoState === 'done' ? 'Saved' :
                         geoState === 'loading' ? 'Getting location...' :
                         geoState === 'error' ? 'Failed' :
                         vendorDetails?.lat != null ? 'Update location' : 'Drop pin'}
                      </span>
                    </button>
                    {vendorDetails?.lat != null && vendorDetails?.lng != null && (
                      <a
                        href={`https://maps.google.com/?q=${vendorDetails.lat},${vendorDetails.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-tea-text-dim hover:text-tea-gold transition-colors"
                      >
                        <span className="num">{vendorDetails.lat.toFixed(4)}, {vendorDetails.lng.toFixed(4)}</span>
                        <ExternalLink size={9} />
                      </a>
                    )}
                  </div>

                  {/* Contact fields */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Phone size={11} className="text-tea-text-dim shrink-0" />
                      <input
                        type="tel"
                        value={vendorDetails?.phone || ''}
                        onChange={(e) => updateDetail('phone', e.target.value || undefined)}
                        placeholder="Phone"
                        className="flex-1 bg-tea-surface text-tea-text text-base rounded-md px-3 py-2 placeholder:text-tea-text-dim border-none outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageCircle size={11} className="text-tea-text-dim shrink-0" />
                      <input
                        type="text"
                        value={vendorDetails?.whatsapp || ''}
                        onChange={(e) => updateDetail('whatsapp', e.target.value || undefined)}
                        placeholder="WhatsApp"
                        className="flex-1 bg-tea-surface text-tea-text text-base rounded-md px-3 py-2 placeholder:text-tea-text-dim border-none outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageCircle size={11} className="text-tea-text-dim shrink-0" />
                      <input
                        type="text"
                        value={vendorDetails?.wechat || ''}
                        onChange={(e) => updateDetail('wechat', e.target.value || undefined)}
                        placeholder="WeChat"
                        className="flex-1 bg-tea-surface text-tea-text text-base rounded-md px-3 py-2 placeholder:text-tea-text-dim border-none outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageCircle size={11} className="text-tea-text-dim shrink-0" />
                      <input
                        type="text"
                        value={vendorDetails?.line || ''}
                        onChange={(e) => updateDetail('line', e.target.value || undefined)}
                        placeholder="LINE"
                        className="flex-1 bg-tea-surface text-tea-text text-base rounded-md px-3 py-2 placeholder:text-tea-text-dim border-none outline-none"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

export default VendorStrip;
