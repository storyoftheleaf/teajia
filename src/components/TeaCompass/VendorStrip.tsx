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
      <div className="flex items-center gap-2 text-xs text-tea-text-sec">
        <MapPin size={12} className="text-tea-text-dim flex-shrink-0" />
        {vendorName ? (
          <>
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className="truncate hover:text-tea-gold transition-colors"
            >
              {vendorName}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="text-tea-text-dim hover:text-tea-text-sec transition-colors flex-shrink-0"
            >
              <X size={12} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            className="text-tea-text-dim hover:text-tea-text-sec transition-colors"
          >
            No vendor
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
              {/* Search input */}
              <div className="flex items-center gap-2 bg-tea-surface rounded-md px-2 py-1.5">
                <Search size={13} className="text-tea-text-dim shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search vendors..."
                  className="flex-1 bg-transparent text-tea-text text-xs placeholder:text-tea-text-dim border-none outline-none"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} className="text-tea-text-dim">
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Results */}
              <div className="max-h-44 overflow-y-auto space-y-0.5">
                {/* Recent vendors */}
                {filteredRecent.length > 0 && !query.trim() && (
                  <div className="pb-1">
                    <span className="text-[10px] text-tea-text-dim uppercase tracking-wider px-1">Recent</span>
                    {filteredRecent.map((v) => (
                      <button
                        key={`recent-${v.name}`}
                        type="button"
                        onClick={() => handleSelectVendor(v.id || undefined, v.name)}
                        className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${
                          vendorName === v.name
                            ? 'bg-tea-elevated text-tea-gold'
                            : 'bg-tea-surface hover:bg-tea-elevated text-tea-text-sec'
                        }`}
                      >
                        {v.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* API vendors */}
                {loadingVendors ? (
                  <div className="flex items-center justify-center py-3 text-tea-text-dim">
                    <Loader2 size={14} className="animate-spin" />
                  </div>
                ) : filteredVendors.length > 0 ? (
                  <div className="pb-1">
                    {query.trim() ? null : (
                      <span className="text-[10px] text-tea-text-dim uppercase tracking-wider px-1">All vendors</span>
                    )}
                    {filteredVendors.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleSelectVendor(v.id, v.name)}
                        className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${
                          vendorId === v.id
                            ? 'bg-tea-elevated text-tea-gold'
                            : 'bg-tea-surface hover:bg-tea-elevated text-tea-text-sec'
                        }`}
                      >
                        {v.name}
                      </button>
                    ))}
                  </div>
                ) : query.trim() ? (
                  <p className="text-[11px] text-tea-text-dim px-2 py-2">No matches</p>
                ) : null}
              </div>

              {/* New vendor */}
              {creatingNew ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={newNameRef}
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateVendor()}
                    placeholder="Vendor name"
                    className="flex-1 bg-tea-surface text-tea-text text-xs rounded-md px-2 py-1.5 placeholder:text-tea-text-dim border-none outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCreateVendor}
                    disabled={!newName.trim()}
                    className="pill text-[11px] px-2 py-1 text-tea-gold disabled:text-tea-text-dim"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreatingNew(false); setNewName(''); }}
                    className="text-tea-text-dim"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreatingNew(true)}
                  className="flex items-center gap-1.5 text-[11px] text-tea-text-dim hover:text-tea-text-sec transition-colors px-1"
                >
                  <Plus size={12} />
                  <span>New vendor</span>
                </button>
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
                        className="flex-1 bg-tea-surface text-tea-text text-[11px] rounded px-2 py-1 placeholder:text-tea-text-dim border-none outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageCircle size={11} className="text-tea-text-dim shrink-0" />
                      <input
                        type="text"
                        value={vendorDetails?.whatsapp || ''}
                        onChange={(e) => updateDetail('whatsapp', e.target.value || undefined)}
                        placeholder="WhatsApp"
                        className="flex-1 bg-tea-surface text-tea-text text-[11px] rounded px-2 py-1 placeholder:text-tea-text-dim border-none outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageCircle size={11} className="text-tea-text-dim shrink-0" />
                      <input
                        type="text"
                        value={vendorDetails?.wechat || ''}
                        onChange={(e) => updateDetail('wechat', e.target.value || undefined)}
                        placeholder="WeChat"
                        className="flex-1 bg-tea-surface text-tea-text text-[11px] rounded px-2 py-1 placeholder:text-tea-text-dim border-none outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageCircle size={11} className="text-tea-text-dim shrink-0" />
                      <input
                        type="text"
                        value={vendorDetails?.line || ''}
                        onChange={(e) => updateDetail('line', e.target.value || undefined)}
                        placeholder="LINE"
                        className="flex-1 bg-tea-surface text-tea-text text-[11px] rounded px-2 py-1 placeholder:text-tea-text-dim border-none outline-none"
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
