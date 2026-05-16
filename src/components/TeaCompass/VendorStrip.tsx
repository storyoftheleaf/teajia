import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, X, Plus, Camera, Check, Phone,
  MessageCircle, ExternalLink,
  Contact, Image, Link,
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
          src={url}
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

  // Debounced save of vendor details to customers API
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
    try {
      const compressed = await compressImage(file, 1200, 0.7);
      const compressedFile = new File([compressed], 'vendor-photo.jpg', { type: 'image/jpeg' });
      const imageUrl = await api.uploadImage(compressedFile);
      if (imageUrl) {
        // For storefront photos, auto-capture GPS if we don't already have coordinates
        if (key === 'storefrontUrl' && vendorDetails?.lat == null && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              onDetailsChange({
                ...vendorDetails,
                [key]: imageUrl,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              });
            },
            () => {
              // GPS failed — still save the photo
              updateDetail(key, imageUrl);
            },
            { enableHighAccuracy: true, timeout: 10000 }
          );
        } else {
          updateDetail(key, imageUrl);
        }
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
        {/* Contact button */}
        {showContactMenu && <div className="relative flex-shrink-0" ref={contactMenuRef}>
          <button
            type="button"
            onClick={() => setContactMenuOpen((o) => !o)}
            className={`flex items-center justify-center w-8 h-8 rounded-xl transition-colors ${
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
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-left text-tea-text-sec hover:bg-tea-bg hover:text-tea-text transition-colors"
                  >
                    <Camera size={14} strokeWidth={1.5} />
                    <span className="text-ui-13">{vendorDetails?.businessCardUrl ? 'Update business card' : 'Business card'}</span>
                    {vendorDetails?.businessCardUrl && <Check size={12} className="ml-auto text-tea-gold" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => storefrontRef.current?.click()}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-md text-left text-tea-text-sec hover:bg-tea-bg hover:text-tea-text transition-colors"
                  >
                    <Image size={14} strokeWidth={1.5} />
                    <span className="text-ui-13">{vendorDetails?.storefrontUrl ? 'Update storefront' : 'Storefront photo'}</span>
                    {vendorDetails?.storefrontUrl && <Check size={12} className="ml-auto text-tea-gold" />}
                  </button>
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
              className="w-full bg-transparent text-tea-text-dim text-sm py-1 outline-none placeholder:text-tea-text-sec/70"
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
                  className="flex-1 input-warm text-base rounded-md px-3 py-2 placeholder:text-tea-text-sec/70 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
                />
                <button
                  type="button"
                  onClick={handleCreateVendor}
                  disabled={!newName.trim()}
                  className="bg-tea-gold text-tea-bg font-semibold text-xs uppercase tracking-[0.08em] px-4 py-2.5 rounded-xl disabled:opacity-40 transition-opacity"
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
                className="text-tea-text-dim hover:text-tea-text-sec transition-colors shrink-0"
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
                {/* Photos & location summary (if any) */}
                {(vendorDetails?.businessCardUrl || vendorDetails?.storefrontUrl || vendorDetails?.lat != null) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {vendorDetails?.businessCardUrl && (
                      <img src={vendorDetails.businessCardUrl} alt="Business card" className="w-10 h-10 rounded object-cover" loading="lazy" />
                    )}
                    {vendorDetails?.storefrontUrl && (
                      <img src={vendorDetails.storefrontUrl} alt="Storefront" className="w-10 h-10 rounded object-cover" loading="lazy" />
                    )}
                    {vendorDetails?.lat != null && vendorDetails?.lng != null && (
                      <a
                        href={`https://maps.google.com/?q=${vendorDetails.lat},${vendorDetails.lng}`}
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
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-tea-text-dim shrink-0" />
                    <input
                      type="tel"
                      value={vendorDetails?.phone || ''}
                      onChange={(e) => updateDetail('phone', e.target.value || undefined)}
                      placeholder="Phone"
                      className="flex-1 input-warm text-base rounded-md px-3 py-2 placeholder:text-tea-text-sec/70 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageCircle size={14} className="text-tea-text-dim shrink-0" />
                    <input
                      type="text"
                      value={vendorDetails?.whatsapp || ''}
                      onChange={(e) => updateDetail('whatsapp', e.target.value || undefined)}
                      placeholder="WhatsApp"
                      className="flex-1 input-warm text-base rounded-md px-3 py-2 placeholder:text-tea-text-sec/70 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageCircle size={14} className="text-tea-text-dim shrink-0" />
                    <input
                      type="text"
                      value={vendorDetails?.wechat || ''}
                      onChange={(e) => updateDetail('wechat', e.target.value || undefined)}
                      placeholder="WeChat"
                      className="flex-1 input-warm text-base rounded-md px-3 py-2 placeholder:text-tea-text-sec/70 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageCircle size={14} className="text-tea-text-dim shrink-0" />
                    <input
                      type="text"
                      value={vendorDetails?.line || ''}
                      onChange={(e) => updateDetail('line', e.target.value || undefined)}
                      placeholder="LINE"
                      className="flex-1 input-warm text-base rounded-md px-3 py-2 placeholder:text-tea-text-sec/70 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
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
