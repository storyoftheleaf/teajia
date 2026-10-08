import React, { useCallback, useEffect, useRef, useState } from 'react';
import { mediaUrl } from '../../lib/mediaUrl';
import { motion, AnimatePresence } from 'framer-motion';
import { api, hasToken } from '../../lib/api';
import { compressImage } from '../../lib/imageCompressor';
import { VendorPicker } from './VendorPicker';
import type { VendorDetails } from './types';

/* ── Location parsing ───────────────────────────────────────
 * Pull WGS-84 coordinates out of a pasted map link OR a plain "lat, lng"
 * string. Lets a shop's location be recorded by pasting from whatever map
 * app works locally: Google Maps is blocked in mainland China, so we can't
 * assume it. Handles Google / Apple / OSM / Amap links and bare pairs. */
export function parseLatLng(raw: string): { lat: number; lng: number } | null {
  if (!raw) return null;
  let s = raw.trim();
  try { s = decodeURIComponent(s); } catch { /* leave as-is if not encoded */ }
  const ok = (lat: number, lng: number) =>
    Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

  // Amap puts longitude first: position=LNG,LAT, check before generic lat,lng.
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
  /** Hide the contact icon, use when onDetailsChange is a no-op and would silently drop edits */
  showContactMenu?: boolean;
}

/* ── Helpers ────────────────────────────────────────────── */

const PANEL_INITIAL = { height: 0, opacity: 0 };
const PANEL_ANIMATE = { height: 'auto' as const, opacity: 1 };
const PANEL_EXIT = { height: 0, opacity: 0 };
const PANEL_TRANSITION = { duration: 0.2, ease: [0.32, 0.72, 0, 1] as const };

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
  const [geoState, setGeoState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [locInput, setLocInput] = useState('');
  const [locError, setLocError] = useState(false);
  // Photo upload feedback, which photo is uploading, and whether the last try failed.
  const [photoUploading, setPhotoUploading] = useState<null | 'businessCardUrl' | 'storefrontUrl'>(null);
  const [photoError, setPhotoError] = useState(false);
  const contactMenuRef = useRef<HTMLDivElement>(null);
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

  // Load vendor details from customers API when selecting a known vendor
  const handleSelectVendor = async (id: string | undefined, name: string) => {
    onVendorSelect(id, name);
    setPickerOpen(false);

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
      } catch { /* offline or no record, fine */ }
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
    if (hasAny) return; // local details win, don't clobber unsaved edits
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
    }).catch(() => { /* offline, local state stands */ });
  }, [vendorId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced save of vendor details to customers API
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest pending save + dirty flag, so unmount can FLUSH instead of dropping
  // it, typing a location and closing the card within 2s used to discard the
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

  // Unmount flush, fire any still-pending save instead of dropping it.
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
      // Save the photo FIRST, always, never gate it behind the GPS lookup.
      // (The old code awaited getCurrentPosition, so a slow/denied/ignored
      //  location prompt swallowed the photo and it "never showed".)
      updateDetail(key, imageUrl);
      // For storefront photos, try to enrich with GPS in the background. The
      // photo is already stored; coordinates just merge in if they arrive.
      if (key === 'storefrontUrl' && vendorDetails?.lat == null && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => onDetailsChange({ ...vendorDetails, [key]: imageUrl, lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => { /* GPS denied/slow, photo already saved, no-op */ },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }
    } catch {
      // No longer silent, the user needs to know the photo didn't save (the China
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

  const contactWords = !!(vendorDetails?.phone || vendorDetails?.whatsapp || vendorDetails?.wechat || vendorDetails?.line);
  const detailField = (label: string, input: React.ReactNode) => (
    <label className="curate-v2-line">
      <span className="curate-v2-label">{label}</span>
      {input}
    </label>
  );
  const menuItem = 'curate-v2-sheetrow !min-h-12 !text-ui-15 font-mono';

  return (
    <div className="curate-v2 space-y-0">
      {/* Hidden storefront file input, mounted at top level so the inline
          thumbnail can trigger it whether or not the contact menu is open.
          No camera lock: the shop photo can come from gallery or camera. */}
      <input ref={storefrontRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => handleContactFileChange(e, 'storefrontUrl')} />

      {/* ── Strip row ── */}
      <div className="flex items-center gap-3 py-1">
        {showContactMenu && <div className="relative shrink-0" ref={contactMenuRef}>
          <button
            type="button"
            onClick={() => setContactMenuOpen((o) => !o)}
            className={`curate-v2-frame is-tall ${contactMenuOpen || hasDetails ? 'is-on' : ''}`}
            aria-label="Vendor contact options"
            aria-expanded={contactMenuOpen}
          >
            Contact
          </button>

          <AnimatePresence>
            {contactMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-full z-20 mt-1 min-w-[220px] overflow-hidden rounded-[3px] border border-tea-border bg-tea-surface shadow-lg"
              >
                <button
                  type="button"
                  onClick={() => storefrontRef.current?.click()}
                  disabled={photoUploading != null}
                  className={menuItem}
                >
                  <span>{photoUploading === 'storefrontUrl' ? 'Uploading…' : vendorDetails?.storefrontUrl ? 'Update storefront' : 'Storefront photo'}</span>
                  {photoUploading !== 'storefrontUrl' && vendorDetails?.storefrontUrl && (
                    <img src={mediaUrl(vendorDetails.storefrontUrl)} alt="Storefront" className="h-7 w-7 rounded-[3px] border border-tea-border object-cover" loading="lazy" />
                  )}
                </button>
                {photoError && (
                  <p role="alert" className="px-4 py-2 font-mono text-ui-12 text-tea-error">Photo didn't save. Check your connection and try again.</p>
                )}
                <button
                  type="button"
                  onClick={() => { handleGeoPin(); setContactMenuOpen(false); }}
                  className={menuItem}
                >
                  <span>{vendorDetails?.lat != null ? 'Update location' : 'Drop pin'}</span>
                  {vendorDetails?.lat != null && <span className="text-ui-12 text-tea-gold">set</span>}
                </button>
                <button
                  type="button"
                  onClick={() => { setDetailsOpen((o) => !o); setContactMenuOpen(false); }}
                  className={`${menuItem} !border-b-0`}
                >
                  <span>{contactWords ? 'Contact details' : 'Add contact link'}</span>
                  {contactWords && <span className="text-ui-12 text-tea-gold">set</span>}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>}
        {/* Storefront photo, shown inline so it's actually visible once added. Tap to update. */}
        {vendorDetails?.storefrontUrl && (
          <button
            type="button"
            onClick={() => storefrontRef.current?.click()}
            className="tap-target min-h-11 min-w-11 shrink-0"
            aria-label="Update storefront photo"
          >
            <img
              src={mediaUrl(vendorDetails.storefrontUrl)}
              alt="Storefront"
              className="h-9 w-9 rounded-[3px] border border-tea-border object-cover"
              loading="lazy"
            />
          </button>
        )}
        {vendorName ? (
          <>
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              aria-expanded={pickerOpen}
              aria-label={`Vendor: ${vendorName}. Change`}
              className="curate-v2-name tap-target min-h-11 flex-1 text-left transition-colors hover:text-tea-gold"
            >
              {vendorName}
            </button>
            <button
              type="button"
              onClick={() => { setPickerOpen(false); onClear(); }}
              aria-label="Clear vendor"
              className="curate-v2-word tap-target min-h-11 shrink-0 px-1 text-tea-text-sec"
            >
              clear
            </button>
          </>
        ) : null}
      </div>

      {/* ── The one vendor picker: open whenever there is no vendor yet, or the name was tapped ── */}
      {(!vendorName || pickerOpen) && (
        <div className="-mx-4">
          <VendorPicker
            autoFocus
            placeholder="Select vendor…"
            onPick={handleSelectVendor}
            onCancel={vendorName ? () => setPickerOpen(false) : undefined}
          />
        </div>
      )}

      {/* ── Supplier link, single row, three mutually exclusive states ── */}
      {onLinkedCustomerChange && (
        <AnimatePresence mode="wait">
          {linkedCustomerId ? (
            <motion.div
              key="linked"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-3 font-mono text-ui-12 text-tea-text-sec"
            >
              <span className="curate-v2-label shrink-0">Supplier</span>
              <a
                href={`/admin/people?customer=${linkedCustomerId}`}
                className="tap-target flex min-h-11 flex-1 items-center truncate hover:text-tea-text"
                target="_blank"
                rel="noopener noreferrer"
              >
                {linkedCustomerName || linkedCustomerId}
              </a>
              <button
                type="button"
                onClick={() => { onLinkedCustomerChange(undefined); setSuggestDismissed(false); }}
                className="curate-v2-word tap-target min-h-11 shrink-0 text-tea-text-sec"
                aria-label="Unlink supplier"
              >
                unlink
              </button>
            </motion.div>
          ) : suggestedCustomer && !suggestDismissed ? (
            <motion.div
              key="suggest"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-3 font-mono text-ui-13"
            >
              <span className="min-w-0 flex-1 truncate text-tea-text-sec">
                Matches <span className="font-display text-ui-17 text-tea-text">{suggestedCustomer.name}</span>
              </span>
              <button
                type="button"
                onClick={() => { onLinkedCustomerChange(suggestedCustomer.id); setSuggestDismissed(true); setSuggestedCustomer(null); }}
                className="curate-v2-word tap-target min-h-11 shrink-0"
              >
                Link
              </button>
              <button
                type="button"
                onClick={() => { setSuggestDismissed(true); setSuggestedCustomer(null); }}
                className="curate-v2-word tap-target min-h-11 shrink-0 text-tea-text-sec"
                aria-label="Dismiss"
              >
                skip
              </button>
            </motion.div>
          ) : vendorId ? (
            <motion.button
              key="manual"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              type="button"
              onClick={() => onLinkedCustomerChange(vendorId)}
              className="curate-v2-word tap-target flex min-h-11 items-center text-tea-text-sec"
            >
              Link supplier profile
            </motion.button>
          ) : null}
        </AnimatePresence>
      )}

      {/* ── Vendor details expandable (triggered by Contact) ── */}
      {!pickerOpen && (
        <AnimatePresence>
          {detailsOpen && (
            <motion.div
              initial={PANEL_INITIAL}
              animate={PANEL_ANIMATE}
              exit={PANEL_EXIT}
              transition={PANEL_TRANSITION}
              className="-mx-4 overflow-hidden"
            >
              <div className="space-y-0 pt-2">
                {saveError && (
                  <p className="px-4 pb-2 font-mono text-ui-12 text-tea-error">
                    Details didn't reach the server. Kept on this phone, retrying as you edit.
                  </p>
                )}
                {(vendorDetails?.storefrontUrl || vendorDetails?.lat != null) && (
                  <div className="flex flex-wrap items-center gap-3 px-4 pb-2">
                    {vendorDetails?.storefrontUrl && (
                      <img src={mediaUrl(vendorDetails.storefrontUrl)} alt="Storefront" className="h-10 w-10 rounded-[3px] border border-tea-border object-cover" loading="lazy" />
                    )}
                    {vendorDetails?.lat != null && vendorDetails?.lng != null && (
                      // OpenStreetMap rather than Google Maps: Google is blocked in
                      // mainland China, so its link is dead exactly where this gets used.
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${vendorDetails.lat}&mlon=${vendorDetails.lng}#map=16/${vendorDetails.lat}/${vendorDetails.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="curate-v2-word tap-target flex min-h-11 items-center tabular-nums"
                      >
                        {vendorDetails.lat.toFixed(4)}, {vendorDetails.lng.toFixed(4)}
                      </a>
                    )}
                  </div>
                )}

                {/* Tappable contact links: one tap to reach them. WeChat has no
                    reliable web link, so it copies the ID. */}
                {(vendorDetails?.whatsapp || vendorDetails?.wechat || vendorDetails?.line || vendorDetails?.phone) && (
                  <div className="flex flex-wrap items-center gap-2 px-4 pb-2">
                    {vendorDetails?.whatsapp && (
                      <a
                        href={`https://wa.me/${vendorDetails.whatsapp.replace(/[^\d]/g, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="curate-v2-frame is-tall"
                      >
                        WhatsApp
                      </a>
                    )}
                    {vendorDetails?.wechat && (
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard?.writeText(vendorDetails.wechat!); }}
                        className="curate-v2-frame is-tall"
                        title="Copy WeChat ID"
                      >
                        WeChat
                      </button>
                    )}
                    {vendorDetails?.line && (
                      <a
                        href={`https://line.me/ti/p/~${vendorDetails.line.replace(/^[@~]/, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        className="curate-v2-frame is-tall"
                      >
                        LINE
                      </a>
                    )}
                    {vendorDetails?.phone && (
                      <a
                        href={`tel:${vendorDetails.phone.replace(/[^\d+]/g, '')}`}
                        className="curate-v2-frame is-tall"
                      >
                        Call
                      </a>
                    )}
                  </div>
                )}

                {/* Location: paste a map link or coordinates from any maps app.
                    Works without Google Maps (blocked in China). */}
                {detailField('Location', (
                  <input
                    type="text"
                    value={locInput}
                    onChange={(e) => { setLocInput(e.target.value); if (locError) setLocError(false); }}
                    onBlur={commitLocation}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitLocation(); } }}
                    placeholder="Paste map link or 'lat, lng'"
                    className="curate-v2-field"
                  />
                ))}
                {locError && (
                  <p className="px-4 pt-1 font-mono text-ui-12 text-tea-error">Couldn't read coordinates from that. Try a "lat, lng" pair.</p>
                )}
                {detailField('Phone', (
                  <input type="tel" value={vendorDetails?.phone || ''} onChange={(e) => updateDetail('phone', e.target.value || undefined)} placeholder="Phone" className="curate-v2-field" />
                ))}
                {detailField('WhatsApp', (
                  <input type="text" value={vendorDetails?.whatsapp || ''} onChange={(e) => updateDetail('whatsapp', e.target.value || undefined)} placeholder="WhatsApp" className="curate-v2-field" />
                ))}
                {detailField('WeChat', (
                  <input type="text" value={vendorDetails?.wechat || ''} onChange={(e) => updateDetail('wechat', e.target.value || undefined)} placeholder="WeChat" className="curate-v2-field" />
                ))}
                {detailField('LINE', (
                  <input type="text" value={vendorDetails?.line || ''} onChange={(e) => updateDetail('line', e.target.value || undefined)} placeholder="LINE" className="curate-v2-field" />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

export default VendorStrip;
