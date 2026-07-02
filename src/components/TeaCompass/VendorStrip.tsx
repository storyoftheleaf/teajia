import React, { useCallback, useEffect, useRef, useState } from 'react';
import { mediaUrl } from '../../lib/mediaUrl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, X, Plus, Camera, Check, Phone,
  MessageCircle, ExternalLink,
  Contact, Image, Link, Loader2, AlertCircle,
} from 'lucide-react';
import { api, hasToken } from '../../lib/api';
import { compressImage } from '../../lib/imageCompressor';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import type { VendorDetails } from './types';

/* ── Location parsing ───────────────────────────────────────
 * Pull WGS-84 coordinates out of a pasted map link OR a plain "lat, lng"
 * string. Lets a shop's location be recorded by pasting from whatever map
 * app works locally — Google Maps is blocked in mainland China, so we can't
 * assume it. Handles Google / Apple / OSM / Amap links and bare pairs. */
export function parseLatLng(raw: string): { lat: number; lng: number } | null {
  if (!raw) return null;
  let s = raw.trim();
  try { s = decodeURIComponent(s); } catch { /* leave as-is if not encoded */ }
  const ok = (lat: number, lng: number) =>
    Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

  // Amap puts longitude first: position=LNG,LAT — check before generic lat,lng.
  const amap = s.match(/position=(-?\d+\.\d+),(-?\d+\.\d+)/i);
  if (amap) { const lng = parseFloat(amap[1]), lat = parseFloat(amap[2]); if (ok(lat, lng)) return { lat, lng }; }

  // Google place URLs encode the pin as !3dLAT!4dLNG.
  const g3d = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (g3d) { const lat = parseFloat(g3d[1]), lng = parseFloat(g3d[2]); if (ok(lat, lng)) return { lat, lng }; }

  // OSM share links: mlat=LAT ... mlon=LNG.
  const osm = s.match(/mlat=(-?\d+\.\d+)[^]*?mlon=(-?\d+\.\d+)/i);
  if (osm) { const lat = parseFloat(osm[1]), lng = parseFloat(osm[2]); if (ok(lat, lng)) return { lat, lng }; }

  // Common LAT,LNG carriers: @lat,lng or q=/ll=/sll=/center=/coordinate=lat,lng.
  const kv = s.match(/(?:[?&](?:q|ll|sll|center|coordinate)=|@)(-?\d+\.\d+),\s*(-?\d+\.\d+)/i);
  if (kv) { const lat = parseFloat(kv[1]), lng = parseFloat(kv[2]); if (ok(lat, lng)) return { lat, lng }; }

  // Bare "lat, lng" pair anywhere (last resort).
  const bare = s.match(/(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/);
  if (bare) { const lat = parseFloat(bare[1]), lng = parseFloat(bare[2]); if (ok(lat, lng)) return { lat, lng }; }

  return null;
}

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
  linkedCustomerId?: string;
  onLinkedCustomerChange?: (customerId: string | undefined) => void;
  /** Hide the contact icon — use when onDetailsChange is a no-op and would silently drop edits */
  showContactMenu?: boolean;
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
          src={mediaUrl(url)}
          alt={label}
          className="w-10 h-10 rounded object-cover shrink-0"
        />
      ) : null}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={state === 'loading'}
        className={`flex items-center gap-1.5 text-ui-11 px-2 py-1 rounded-md bg-tea-surface transition-colors shrink-0 ${
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
  linkedCustomerId,
  onLinkedCustomerChange,
  showContactMenu = true,
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [contactMenuOpen, setContactMenuOpen] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [geoState, setGeoState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [locInput, setLocInput] = useState('');
  const [locError, setLocError] = useState(false);
  // Photo upload feedback — which photo is uploading, and whether the last try failed.
  const [photoUploading, setPhotoUploading] = useState<null | 'businessCardUrl' | 'storefrontUrl'>(null);
  const [photoError, setPhotoError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const newNameRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);
  const contactMenuRef = useRef<HTMLDivElement>(null);
  const businessCardRef = useRef<HTMLInputElement>(null);
  const storefrontRef = useRef<HTMLInputElement>(null);

  // Feature 28: linked customer suggestion
  const [suggestedCustomer, setSuggestedCustomer] = useState<Vendor | null>(null);
  const [suggestDismissed, setSuggestDismissed] = useState(false);
  const [linkedCustomerName, setLinkedCustomerName] = useState<string | undefined>(undefined);

  // Load linked customer name when ID changes
  useEffect(() => {
    if (!linkedCustomerId) { setLinkedCustomerName(undefined); return; }
    const found = vendors.find(v => v.id === linkedCustomerId);
    if (found) { setLinkedCustomerName(found.name); return; }
    // Fetch on demand if not in list yet
    if (!hasToken()) return;
    api.customers.get(linkedCustomerId)
      .then((c: { name?: string } | null) => { if (c?.name) setLinkedCustomerName(c.name); })
      .catch(() => {});
  }, [linkedCustomerId, vendors]);

  // Auto-suggest: fuzzy-match vendorName against vendor customers
  useEffect(() => {
    if (!vendorName || !vendorName.trim() || linkedCustomerId || suggestDismissed || vendors.length === 0) {
      setSuggestedCustomer(null);
      return;
    }
    const q = vendorName.toLowerCase().trim();
    const match = vendors.find(v =>
      v.name.toLowerCase().includes(q) || q.includes(v.name.toLowerCase())
    );
    setSuggestedCustomer(match ?? null);
  }, [vendorName, vendors, linkedCustomerId, suggestDismissed]);

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

  // Load vendor details from customers API when selecting a known vendor
  const handleSelectVendor = async (id: string | undefined, name: string) => {
    onVendorSelect(id, name);
    setPickerOpen(false);
    setCreatingNew(false);

    // Pre-populate vendor details from customer record
    if (id && hasToken()) {
      try {
        const customer = await api.customers.get(id);
        if (customer) {
          const loaded: VendorDetails = {};
          if (customer.business_card_photo) loaded.businessCardUrl = customer.business_card_photo;
          if (customer.storefront_photo) loaded.storefrontUrl = customer.storefront_photo;
          if (customer.latitude != null) loaded.lat = customer.latitude;
          if (customer.longitude != null) loaded.lng = customer.longitude;
          if (customer.phone) loaded.phone = customer.phone;
          if (customer.whatsapp) loaded.whatsapp = customer.whatsapp;
          if (customer.wechat) loaded.wechat = customer.wechat;
          if (customer.line) loaded.line = customer.line;
          // Only apply if we got any data and current details are empty
          const hasLoaded = Object.values(loaded).some((v) => v != null);
          if (hasLoaded) {
            onDetailsChange({ ...loaded, ...vendorDetails });
          }
        }
      } catch { /* offline or no record — fine */ }
    }
  };

  const handleCreateVendor = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setNewName('');
    // Create a real customer record NOW, tagged vendor — without an id the
    // debounced details save below is guarded off, so a vendor typed fresh at
    // a fair had NO server home: their storefront photo/location lived only in
    // client-only entry state. Selection happens immediately (capture never
    // waits on the network); the id is attached when the create lands.
    handleSelectVendor(undefined, trimmed);
    if (!hasToken()) return;
    try {
      const { id } = await api.customers.create({ name: trimmed, tags: 'vendor', source: 'compass' });
      if (id) {
        setVendors((prev) => [{ id, name: trimmed, tags: 'vendor' }, ...prev]);
        onVendorSelect(id, trimmed);
      }
    } catch {
      // Offline — vendor stays name-only. Details are preserved on the entry
      // (client-only fields survive hydrate) and can be re-linked later.
    }
  };

  const updateDetail = useCallback(
    (key: keyof VendorDetails, value: string | number | undefined) => {
      onDetailsChange({ ...vendorDetails, [key]: value });
    },
    [vendorDetails, onDetailsChange]
  );

  // Load vendor details from the customer record when the capture card mounts
  // with a vendor already linked (e.g. after a reload). Previously details only
  // loaded on an explicit re-pick from the vendor list, so a saved storefront
  // photo/location looked "gone" until the vendor was selected again.
  const detailsLoadedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!vendorId || !hasToken()) return;
    if (detailsLoadedForRef.current === vendorId) return;
    detailsLoadedForRef.current = vendorId;
    const hasAny = vendorDetails && Object.values(vendorDetails).some((v) => v != null);
    if (hasAny) return; // local details win — don't clobber unsaved edits
    api.customers.get(vendorId).then((customer: any) => {
      if (!customer) return;
      const loaded: VendorDetails = {};
      if (customer.business_card_photo) loaded.businessCardUrl = customer.business_card_photo;
      if (customer.storefront_photo) loaded.storefrontUrl = customer.storefront_photo;
      if (customer.latitude != null) loaded.lat = customer.latitude;
      if (customer.longitude != null) loaded.lng = customer.longitude;
      if (customer.phone) loaded.phone = customer.phone;
      if (customer.whatsapp) loaded.whatsapp = customer.whatsapp;
      if (customer.wechat) loaded.wechat = customer.wechat;
      if (customer.line) loaded.line = customer.line;
      if (Object.values(loaded).some((v) => v != null)) {
        onDetailsChange({ ...loaded, ...vendorDetails });
      }
    }).catch(() => { /* offline — local state stands */ });
  }, [vendorId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced save of vendor details to customers API
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest pending save + dirty flag, so unmount can FLUSH instead of dropping
  // it — typing a location and closing the card within 2s used to discard the
  // save silently.
  const pendingSaveRef = useRef<(() => void) | null>(null);
  const saveDirtyRef = useRef(false);
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    if (!vendorId || !hasToken() || !vendorDetails) return;
    const hasInfo = vendorDetails.businessCardUrl || vendorDetails.storefrontUrl ||
      vendorDetails.lat != null || vendorDetails.phone ||
      vendorDetails.whatsapp || vendorDetails.wechat || vendorDetails.line;
    if (!hasInfo) return;

    const doSave = () => {
      saveDirtyRef.current = false;
      const payload: Record<string, any> = {};
      if (vendorDetails.businessCardUrl) payload.business_card_photo = vendorDetails.businessCardUrl;
      if (vendorDetails.storefrontUrl) payload.storefront_photo = vendorDetails.storefrontUrl;
      if (vendorDetails.lat != null) payload.latitude = vendorDetails.lat;
      if (vendorDetails.lng != null) payload.longitude = vendorDetails.lng;
      if (vendorDetails.phone) payload.phone = vendorDetails.phone;
      if (vendorDetails.whatsapp) payload.whatsapp = vendorDetails.whatsapp;
      if (vendorDetails.wechat) payload.wechat = vendorDetails.wechat;
      if (vendorDetails.line) payload.line = vendorDetails.line;
      api.customers.update(vendorId, payload)
        .then(() => setSaveError(false))
        .catch(() => setSaveError(true)); // no longer silent
    };

    saveDirtyRef.current = true;
    pendingSaveRef.current = doSave;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(doSave, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [vendorId, vendorDetails]);

  // Unmount flush — fire any still-pending save instead of dropping it.
  useEffect(() => () => {
    if (saveDirtyRef.current && pendingSaveRef.current) pendingSaveRef.current();
  }, []);

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

  // Parse a pasted map link / coordinate pair and store it. Clears on success;
  // flags an error so the field can say "couldn't read that link" on failure.
  const commitLocation = () => {
    if (!locInput.trim()) { setLocError(false); return; }
    const parsed = parseLatLng(locInput);
    if (parsed) {
      onDetailsChange({ ...vendorDetails, lat: parsed.lat, lng: parsed.lng });
      setLocInput('');
      setLocError(false);
    } else {
      setLocError(true);
    }
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

  // Close search dropdown on outside click
  useEffect(() => {
    if (!searchOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        searchRef.current && !searchRef.current.contains(e.target as Node) &&
        searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)
      ) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [searchOpen]);

  const handleContactFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    key: 'businessCardUrl' | 'storefrontUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setPhotoError(false);
    setPhotoUploading(key);
    try {
      const compressed = await compressImage(file, 1200, 0.7);
      const compressedFile = new File([compressed], 'vendor-photo.jpg', { type: 'image/jpeg' });
      const imageUrl = await api.uploadImage(compressedFile);
      if (!imageUrl) throw new Error('upload returned no url');
      // For storefront photos, auto-capture GPS if we don't already have coordinates.
      // Awaited so the "uploading" state stays until the photo is actually stored.
      if (key === 'storefrontUrl' && vendorDetails?.lat == null && navigator.geolocation) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              onDetailsChange({ ...vendorDetails, [key]: imageUrl, lat: pos.coords.latitude, lng: pos.coords.longitude });
              resolve();
            },
            () => { updateDetail(key, imageUrl); resolve(); }, // GPS failed — still save the photo
            { enableHighAccuracy: true, timeout: 10000 }
          );
        });
      } else {
        updateDetail(key, imageUrl);
      }
    } catch {
      // No longer silent — the user needs to know the photo didn't save (the China
      // network trap was masking exactly this). Menu stays open so they can retry.
      setPhotoError(true);
    } finally {
      setPhotoUploading(null);
    }
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
        {/* Contact button */}
        {showContactMenu && <div className="relative flex-shrink-0" ref={contactMenuRef}>
          <button
            type="button"
            onClick={() => setContactMenuOpen((o) => !o)}
            className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
              contactMenuOpen || hasDetails ? 'bg-tea-gold/15 text-tea-gold rounded-md' : 'bg-tea-surface text-tea-text-sec hover:text-tea-text'
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
                className="absolute top-full left-0 mt-1 z-20 bg-tea-surface rounded-xl p-1.5 shadow-lg border border-tea-border min-w-[180px]"
              >
                {/* Hidden file inputs */}
                  <input ref={businessCardRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => handleContactFileChange(e, 'businessCardUrl')} />
                  <input ref={storefrontRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => handleContactFileChange(e, 'storefrontUrl')} />

                  <button
                    type="button"
                    onClick={() => businessCardRef.current?.click()}
                    disabled={photoUploading != null}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-left text-tea-text-sec hover:bg-tea-bg hover:text-tea-text transition-colors disabled:opacity-60"
                  >
                    <Camera size={14} strokeWidth={1.5} />
                    <span className="text-ui-13">{photoUploading === 'businessCardUrl' ? 'Uploading…' : vendorDetails?.businessCardUrl ? 'Update business card' : 'Business card'}</span>
                    {photoUploading === 'businessCardUrl' ? (
                      <Loader2 size={14} className="ml-auto animate-spin text-tea-gold" />
                    ) : vendorDetails?.businessCardUrl ? (
                      <img src={mediaUrl(vendorDetails.businessCardUrl)} alt="Business card" className="ml-auto w-7 h-7 rounded object-cover border border-tea-border" loading="lazy" />
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => storefrontRef.current?.click()}
                    disabled={photoUploading != null}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-left text-tea-text-sec hover:bg-tea-bg hover:text-tea-text transition-colors disabled:opacity-60"
                  >
                    <Image size={14} strokeWidth={1.5} />
                    <span className="text-ui-13">{photoUploading === 'storefrontUrl' ? 'Uploading…' : vendorDetails?.storefrontUrl ? 'Update storefront' : 'Storefront photo'}</span>
                    {photoUploading === 'storefrontUrl' ? (
                      <Loader2 size={14} className="ml-auto animate-spin text-tea-gold" />
                    ) : vendorDetails?.storefrontUrl ? (
                      <img src={mediaUrl(vendorDetails.storefrontUrl)} alt="Storefront" className="ml-auto w-7 h-7 rounded object-cover border border-tea-border" loading="lazy" />
                    ) : null}
                  </button>
                  {photoError && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 text-ui-11 text-tea-error">
                      <AlertCircle size={12} />
                      <span>Photo didn't save — check your connection and try again.</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => { handleGeoPin(); setContactMenuOpen(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-left text-tea-text-sec hover:bg-tea-bg hover:text-tea-text transition-colors"
                  >
                    <MapPin size={14} strokeWidth={1.5} />
                    <span className="text-ui-13">{vendorDetails?.lat != null ? 'Update location' : 'Drop pin'}</span>
                    {vendorDetails?.lat != null && <Check size={12} className="ml-auto text-tea-gold" />}
                  </button>
                  <div className="h-px bg-tea-border my-1" />
                  <button
                    type="button"
                    onClick={() => { setDetailsOpen((o) => !o); setContactMenuOpen(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-left text-tea-text-sec hover:bg-tea-bg hover:text-tea-text transition-colors"
                  >
                    <Phone size={14} strokeWidth={1.5} />
                    <span className="text-ui-13">Contact details</span>
                    {(vendorDetails?.phone || vendorDetails?.whatsapp || vendorDetails?.wechat || vendorDetails?.line) && (
                      <Check size={12} className="ml-auto text-tea-gold" />
                    )}
                  </button>
                </motion.div>
            )}
          </AnimatePresence>
        </div>}
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
          <div className="flex-1 min-w-0 relative">
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  handleSelectVendor(undefined, searchQuery.trim());
                  setSearchQuery('');
                  setSearchOpen(false);
                }
                if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); }
              }}
              placeholder="Select vendor..."
              className="w-full bg-transparent text-tea-text-dim text-sm py-1 outline-none placeholder:text-tea-text-dim"
            />
            <AnimatePresence>
              {searchOpen && (
                <motion.div
                  ref={searchDropdownRef}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full left-0 right-0 z-30 mt-1 bg-tea-surface rounded-xl shadow-lg border border-tea-border overflow-hidden"
                  style={{ minWidth: '200px' }}
                >
                  {/* New vendor — always first */}
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (searchQuery.trim()) {
                        handleSelectVendor(undefined, searchQuery.trim());
                        setSearchQuery('');
                      } else {
                        setCreatingNew(true);
                        setPickerOpen(true);
                      }
                      setSearchOpen(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left text-ui-13 text-tea-gold hover:bg-tea-gold/[0.08] transition-colors"
                  >
                    <Plus size={12} strokeWidth={2.5} />
                    {searchQuery.trim() ? `New vendor "${searchQuery.trim()}"` : 'New vendor…'}
                  </button>

                  {/* Filtered vendor list */}
                  {(() => {
                    const q = searchQuery.toLowerCase();
                    const seen = new Set<string>();
                    const rows: { id?: string; name: string; isRecent?: boolean }[] = [];

                    for (const v of recentVendors) {
                      if (!seen.has(v.name) && (!q || v.name.toLowerCase().includes(q))) {
                        seen.add(v.name);
                        rows.push({ id: v.id || undefined, name: v.name, isRecent: true });
                      }
                    }
                    for (const v of vendors) {
                      if (!seen.has(v.name) && (!q || v.name.toLowerCase().includes(q))) {
                        seen.add(v.name);
                        rows.push({ id: v.id, name: v.name });
                      }
                    }

                    if (rows.length === 0) return null;
                    return (
                      <div className="border-t border-tea-border max-h-48 overflow-y-auto">
                        {rows.map((v) => (
                          <button
                            key={v.id ?? v.name}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectVendor(v.id, v.name);
                              setSearchQuery('');
                              setSearchOpen(false);
                            }}
                            className="flex items-center justify-between w-full px-3 py-2 text-left text-ui-13 text-tea-text-sec hover:bg-tea-gold/[0.06] hover:text-tea-text transition-colors"
                          >
                            <span>{v.name}</span>
                            {v.isRecent && <span className="text-ui-10 text-tea-text-dim shrink-0 ml-2">recent</span>}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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
                  className="flex-1 input-warm text-base rounded-md px-3 py-2 placeholder:text-tea-text-dim outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
                />
                <button
                  type="button"
                  onClick={handleCreateVendor}
                  disabled={!newName.trim()}
                  className="bg-tea-gold text-tea-bg font-semibold text-xs uppercase tracking-[0.08em] px-4 py-2.5 rounded-md disabled:opacity-40 transition-opacity"
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

      {/* ── Supplier link — single row, three mutually exclusive states ── */}
      {onLinkedCustomerChange && (
        <AnimatePresence mode="wait">
          {linkedCustomerId ? (
            <motion.div
              key="linked"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1.5 mt-1 text-ui-11 text-tea-text-dim"
            >
              <Link size={10} className="shrink-0" />
              <a
                href={`/admin/people?customer=${linkedCustomerId}`}
                className="flex-1 truncate hover:text-tea-text-sec transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                {linkedCustomerName || linkedCustomerId}
              </a>
              <button
                type="button"
                onClick={() => { onLinkedCustomerChange(undefined); setSuggestDismissed(false); }}
                className="hover:text-tea-text-sec transition-colors shrink-0"
                aria-label="Unlink supplier"
              >
                <X size={10} />
              </button>
            </motion.div>
          ) : suggestedCustomer && !suggestDismissed ? (
            <motion.div
              key="suggest"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2 mt-1 text-ui-11"
            >
              <span className="flex-1 text-tea-text-dim truncate">
                Matches <span className="text-tea-text-sec">{suggestedCustomer.name}</span>
              </span>
              <button
                type="button"
                onClick={() => { onLinkedCustomerChange(suggestedCustomer.id); setSuggestDismissed(true); setSuggestedCustomer(null); }}
                className="text-tea-gold font-medium hover:text-tea-gold/70 transition-colors shrink-0"
              >
                Link
              </button>
              <button
                type="button"
                onClick={() => { setSuggestDismissed(true); setSuggestedCustomer(null); }}
                className="text-tea-text-sec hover:text-tea-text-sec transition-colors shrink-0"
                aria-label="Dismiss"
              >
                <X size={10} />
              </button>
            </motion.div>
          ) : vendorId ? (
            <motion.button
              key="manual"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              type="button"
              onClick={() => onLinkedCustomerChange(vendorId)}
              className="mt-1 flex items-center gap-1 text-ui-11 text-tea-text-dim/50 hover:text-tea-text-dim transition-colors"
            >
              <Link size={10} />
              Link supplier profile
            </motion.button>
          ) : null}
        </AnimatePresence>
      )}

      {/* ── Vendor details expandable (triggered by contact icon) ── */}
      {!pickerOpen && (
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
                {saveError && (
                  <p className="flex items-center gap-1.5 text-ui-11 text-tea-error">
                    <AlertCircle size={12} />
                    Details didn't reach the server — kept on this phone, retrying as you edit.
                  </p>
                )}
                {/* Photos & location summary (if any) */}
                {(vendorDetails?.businessCardUrl || vendorDetails?.storefrontUrl || vendorDetails?.lat != null) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {vendorDetails?.businessCardUrl && (
                      <img src={mediaUrl(vendorDetails.businessCardUrl)} alt="Business card" className="w-10 h-10 rounded object-cover" loading="lazy" />
                    )}
                    {vendorDetails?.storefrontUrl && (
                      <img src={mediaUrl(vendorDetails.storefrontUrl)} alt="Storefront" className="w-10 h-10 rounded object-cover" loading="lazy" />
                    )}
                    {vendorDetails?.lat != null && vendorDetails?.lng != null && (
                      // OpenStreetMap rather than Google Maps — Google is blocked in
                      // mainland China, so its link is dead exactly where this gets used.
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${vendorDetails.lat}&mlon=${vendorDetails.lng}#map=16/${vendorDetails.lat}/${vendorDetails.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-ui-11 text-tea-text-dim hover:text-tea-gold transition-colors"
                      >
                        <MapPin size={12} />
                        <span className="num">{vendorDetails.lat.toFixed(4)}, {vendorDetails.lng.toFixed(4)}</span>
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                )}

                {/* Contact fields */}
                <div className="space-y-1.5">
                  {/* Location — paste a map link or coordinates from any maps app.
                      Works without Google Maps (blocked in China); the GPS pin
                      button elsewhere remains the at-the-shop shortcut. */}
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-tea-text-dim shrink-0" />
                    <input
                      type="text"
                      value={locInput}
                      onChange={(e) => { setLocInput(e.target.value); if (locError) setLocError(false); }}
                      onBlur={commitLocation}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitLocation(); } }}
                      placeholder="Paste map link or 'lat, lng'"
                      className="flex-1 input-warm text-base rounded-md px-3 py-2 placeholder:text-tea-text-dim outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
                    />
                  </div>
                  {locError && (
                    <p className="text-ui-11 text-tea-error pl-6">Couldn't read coordinates from that — try a "lat, lng" pair.</p>
                  )}
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-tea-text-dim shrink-0" />
                    <input
                      type="tel"
                      value={vendorDetails?.phone || ''}
                      onChange={(e) => updateDetail('phone', e.target.value || undefined)}
                      placeholder="Phone"
                      className="flex-1 input-warm text-base rounded-md px-3 py-2 placeholder:text-tea-text-dim outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageCircle size={14} className="text-tea-text-dim shrink-0" />
                    <input
                      type="text"
                      value={vendorDetails?.whatsapp || ''}
                      onChange={(e) => updateDetail('whatsapp', e.target.value || undefined)}
                      placeholder="WhatsApp"
                      className="flex-1 input-warm text-base rounded-md px-3 py-2 placeholder:text-tea-text-dim outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageCircle size={14} className="text-tea-text-dim shrink-0" />
                    <input
                      type="text"
                      value={vendorDetails?.wechat || ''}
                      onChange={(e) => updateDetail('wechat', e.target.value || undefined)}
                      placeholder="WeChat"
                      className="flex-1 input-warm text-base rounded-md px-3 py-2 placeholder:text-tea-text-dim outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageCircle size={14} className="text-tea-text-dim shrink-0" />
                    <input
                      type="text"
                      value={vendorDetails?.line || ''}
                      onChange={(e) => updateDetail('line', e.target.value || undefined)}
                      placeholder="LINE"
                      className="flex-1 input-warm text-base rounded-md px-3 py-2 placeholder:text-tea-text-dim outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
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
