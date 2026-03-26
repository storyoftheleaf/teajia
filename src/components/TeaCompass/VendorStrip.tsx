import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, X, Plus, Camera, Check, Phone,
  MessageCircle, ExternalLink, Loader2,
  Contact, Image,
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
  const [contactMenuOpen, setContactMenuOpen] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [geoState, setGeoState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const newNameRef = useRef<HTMLInputElement>(null);
  const contactMenuRef = useRef<HTMLDivElement>(null);
  const businessCardRef = useRef<HTMLInputElement>(null);
  const storefrontRef = useRef<HTMLInputElement>(null);

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus new name input
  useEffect(() => {
    if (creatingNew) {
      setTimeout(() => newNameRef.current?.focus(), 50);
    }
  }, [creatingNew]);

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

  // Close contact menu on outside click
  useEffect(() => {
    if (!contactMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (contactMenuRef.current && !contactMenuRef.current.contains(e.target as Node)) {
        setContactMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contactMenuOpen]);

  const handleContactPhoto = async (
    inputRef: React.RefObject<HTMLInputElement | null>,
    key: 'businessCardUrl' | 'storefrontUrl'
  ) => {
    inputRef.current?.click();
  };

  const handleContactFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    key: 'businessCardUrl' | 'storefrontUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const compressed = await compressImage(file, 1200, 0.7);
      const compressedFile = new File([compressed], 'vendor-photo.jpg', { type: 'image/jpeg' });
      const imageUrl = await api.uploadImage(compressedFile);
      if (imageUrl) {
        updateDetail(key, imageUrl);
      }
    } catch { /* ignore */ }
    setContactMenuOpen(false);
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
        {/* Contact button — far left, only when vendor is selected */}
        {vendorName && !pickerOpen ? (
          <div className="relative flex-shrink-0" ref={contactMenuRef}>
            <button
              type="button"
              onClick={() => setContactMenuOpen((o) => !o)}
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                contactMenuOpen || hasDetails ? 'bg-tea-gold/15 text-tea-gold' : 'bg-tea-surface text-tea-text-dim hover:text-tea-text-sec'
              }`}
              aria-label="Vendor contact options"
            >
              <Contact size={16} strokeWidth={1.5} />
            </button>

            {/* Contact popover menu */}
            <AnimatePresence>
              {contactMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-1 z-20 bg-tea-surface rounded-lg p-1.5 shadow-lg border border-tea-border/30 min-w-[180px]"
                >
                  {/* Hidden file inputs */}
                  <input ref={businessCardRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => handleContactFileChange(e, 'businessCardUrl')} />
                  <input ref={storefrontRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => handleContactFileChange(e, 'storefrontUrl')} />

                  <button
                    type="button"
                    onClick={() => businessCardRef.current?.click()}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-left text-tea-text-sec hover:bg-tea-bg hover:text-tea-text transition-colors"
                  >
                    <Camera size={14} strokeWidth={1.5} />
                    <span className="text-[13px]">{vendorDetails?.businessCardUrl ? 'Update business card' : 'Business card'}</span>
                    {vendorDetails?.businessCardUrl && <Check size={12} className="ml-auto text-tea-gold" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => storefrontRef.current?.click()}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-left text-tea-text-sec hover:bg-tea-bg hover:text-tea-text transition-colors"
                  >
                    <Image size={14} strokeWidth={1.5} />
                    <span className="text-[13px]">{vendorDetails?.storefrontUrl ? 'Update storefront' : 'Storefront photo'}</span>
                    {vendorDetails?.storefrontUrl && <Check size={12} className="ml-auto text-tea-gold" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleGeoPin(); setContactMenuOpen(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-left text-tea-text-sec hover:bg-tea-bg hover:text-tea-text transition-colors"
                  >
                    <MapPin size={14} strokeWidth={1.5} />
                    <span className="text-[13px]">{vendorDetails?.lat != null ? 'Update location' : 'Drop pin'}</span>
                    {vendorDetails?.lat != null && <Check size={12} className="ml-auto text-tea-gold" />}
                  </button>
                  <div className="h-px bg-tea-border/30 my-1" />
                  <button
                    type="button"
                    onClick={() => { setDetailsOpen((o) => !o); setContactMenuOpen(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-left text-tea-text-sec hover:bg-tea-bg hover:text-tea-text transition-colors"
                  >
                    <Phone size={14} strokeWidth={1.5} />
                    <span className="text-[13px]">Contact details</span>
                    {(vendorDetails?.phone || vendorDetails?.whatsapp || vendorDetails?.wechat || vendorDetails?.line) && (
                      <Check size={12} className="ml-auto text-tea-gold" />
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <MapPin size={14} className="text-tea-text-dim flex-shrink-0" />
        )}
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
          <select
            value=""
            onChange={(e) => {
              const val = e.target.value;
              if (val === '__new__') {
                setCreatingNew(true);
                setPickerOpen(true);
                return;
              }
              if (!val) return;
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
            className="flex-1 bg-transparent text-tea-text-dim text-sm py-1 outline-none appearance-none cursor-pointer"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center' }}
          >
            <option value="" disabled>Select vendor...</option>
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
        )}
      </div>

      {/* ── New vendor input (only when creating) ── */}
      <AnimatePresence>
        {pickerOpen && creatingNew && (
          <motion.div
            initial={PANEL_INITIAL}
            animate={PANEL_ANIMATE}
            exit={PANEL_EXIT}
            transition={PANEL_TRANSITION}
            className="overflow-hidden"
          >
            <div className="pt-2 pb-1">
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
                  onClick={() => { setCreatingNew(false); setNewName(''); setPickerOpen(false); }}
                  className="text-tea-text-dim p-2"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Vendor details expandable (triggered by MapPin icon in strip row) ── */}
      {vendorName && !pickerOpen && (
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
                {/* Photos & location summary (if any) */}
                {(vendorDetails?.businessCardUrl || vendorDetails?.storefrontUrl || vendorDetails?.lat != null) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {vendorDetails?.businessCardUrl && (
                      <img src={vendorDetails.businessCardUrl} alt="Business card" className="w-10 h-10 rounded object-cover" />
                    )}
                    {vendorDetails?.storefrontUrl && (
                      <img src={vendorDetails.storefrontUrl} alt="Storefront" className="w-10 h-10 rounded object-cover" />
                    )}
                    {vendorDetails?.lat != null && vendorDetails?.lng != null && (
                      <a
                        href={`https://maps.google.com/?q=${vendorDetails.lat},${vendorDetails.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-tea-text-dim hover:text-tea-gold transition-colors"
                      >
                        <MapPin size={10} />
                        <span className="num">{vendorDetails.lat.toFixed(4)}, {vendorDetails.lng.toFixed(4)}</span>
                        <ExternalLink size={9} />
                      </a>
                    )}
                  </div>
                )}

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
      )}
    </div>
  );
};

export default VendorStrip;
