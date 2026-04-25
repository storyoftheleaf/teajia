import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Save, Layers, Edit, Loader2, UserCheck, RefreshCw, Calculator, Tag, Globe, FileText, Image as ImageIcon, Upload, Trash2, Star, Sparkles, ChevronDown, Compass, ExternalLink } from 'lucide-react';
import { api } from '../../lib/api';
import { Currency, Product, ExchangeRate, ProductType } from '../types';
import type { TastingData } from '../../types';
import { calculatePricing } from '../utils';
import { TeaIllustration } from './TeaIllustration';
import { TastingSession } from '../../components/tasting/TastingSession';
import { resolveTermLabel, resolveTermIcon, flattenTastingNotes } from '../../data/tastingTaxonomy';
import { useAppStore } from '../store';
import { useToast } from './Toast';
import { useCustomers } from '../hooks/useAdminData';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { TeaReviewsPanel } from './TeaReviewsPanel';
import { StockLedgerPanel } from './StockLedgerPanel';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Product | null; 
  rates?: ExchangeRate[]; 
}

const ImageThumbnail = ({ src, type }: { src: string, type: string }) => {
    const [error, setError] = useState(false);

    useEffect(() => { setError(false); }, [src]);

    if (error) {
        return (
            <div className="w-full h-full bg-tea-bg/50 flex items-center justify-center p-3 opacity-50 grayscale">
                <TeaIllustration type={type as ProductType} />
            </div>
        );
    }

    return (
        <img
            src={src}
            alt="Preview"
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setError(true)}
        />
    );
};

// ── Vendor Picker: combo input with dropdown ──
const VendorPicker = ({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (name: string) => void;
  className?: string;
}) => {
  const { data: customers = [], refetch: refetchCustomers } = useCustomers();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Get unique vendor names from customers tagged as vendor
  const vendors = useMemo(() => {
    return customers
      .filter(c => c.tags?.includes('vendor'))
      .map(c => c.name)
      .sort((a, b) => a.localeCompare(b));
  }, [customers]);

  // Also include current value if it's not in vendors list (for pre-existing text values)
  const allOptions = useMemo(() => {
    const set = new Set(vendors);
    if (value && !set.has(value)) set.add(value);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [vendors, value]);

  const filtered = useMemo(() => {
    if (!query) return allOptions;
    const q = query.toLowerCase();
    return allOptions.filter(v => v.toLowerCase().includes(q));
  }, [allOptions, query]);

  useEffect(() => { setQuery(value); }, [value]);

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isNew = query.trim() && !vendors.some(v => v.toLowerCase() === query.trim().toLowerCase());

  // Auto-create vendor customer if new, or add vendor tag if existing
  const handleSelectVendor = async (name: string) => {
    onChange(name);
    setOpen(false);
    if (!name) return;

    const existing = customers.find(
      c => c.name.toLowerCase() === name.toLowerCase()
    );
    if (!existing) {
      try {
        await api.customers.create({ name, tags: ['vendor'] });
        refetchCustomers();
      } catch (err) {
        console.error('Failed to create vendor customer:', err);
      }
    } else if (!existing.tags?.includes('vendor')) {
      try {
        await api.customers.update(existing.id, {
          tags: [...(existing.tags || []), 'vendor'],
        });
        refetchCustomers();
      } catch (err) {
        console.error('Failed to add vendor tag:', err);
      }
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={(e) => { setOpen(true); setTimeout(() => { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 300); }}
        onBlur={() => {
          setTimeout(() => handleSelectVendor(query.trim()), 150);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSelectVendor(query.trim());
          }
        }}
        className={className}
        placeholder="Type or pick a source..."
        autoComplete="off"
      />

      {open && (filtered.length > 0 || (query.trim() && isNew)) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-tea-surface border border-tea-border rounded-lg shadow-lg max-h-[min(192px,40vh)] overflow-y-auto">
          {isNew && query.trim() && (
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => handleSelectVendor(query.trim())}
              className="w-full text-left px-3 py-2 text-sm text-tea-gold hover:bg-tea-bg transition-colors border-b border-tea-border"
            >
              + Add "{query.trim()}" as new source
            </button>
          )}
          {filtered.map(v => (
            <button
              key={v}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                setQuery(v);
                handleSelectVendor(v);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-tea-bg transition-colors ${
                v === value ? 'text-tea-gold font-medium' : 'text-tea-text'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const AddProductModal: React.FC<AddProductModalProps> = ({ isOpen, onClose, onSuccess, initialData, rates = [] }) => {
  const { showToast } = useToast();
  const { data: customers = [] } = useCustomers();
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { aiPromptTemplate, draftProduct, setDraftProduct, memberships, activeAccountId } = useAppStore();
  const isPlatformAccount = memberships.find(m => m.account_id === activeAccountId)?.is_platform_account ?? false;

  const [tastingData, setTastingData] = useState<TastingData>({});
  const [tastingOpen, setTastingOpen] = useState(false);

  // Feature 26: Compass sourcing lineage
  const [compassSource, setCompassSource] = useState<{
    vendorName?: string;
    origin?: string;
    qualityRating?: number;
    notes?: string;
    id?: string;
  } | null>(null);
  const [compassSourceLoading, setCompassSourceLoading] = useState(false);

  const [formData, setFormData] = useState({
    type: 'Dark',
    form: '',
    givenName: '',
    chineseName: '',
    productName: '',
    year: '',
    originCountry: 'China',
    originRegion: '',
    stockGrams: '',
    quantityPurchased: '', 
    costAmount: '', // BASE Cost (Source Currency)
    shippingRateUSD: '13', // INPUT IS ALWAYS USD NOW — $13/kg default
    costCurrency: 'USD' as Currency,
    vendor: '',
    description: '',
    imageUrl: '',
    additionalImages: [] as string[],
    status: 'Active',
    fixedRetailPriceUSD: '', // Override
    isPersonal: false,
    canReorder: false,
    isPublic: true,
    isFeatured: false,
    isCurated: false,
    recheckStock: false,
    inTransit: false,
    inTransitGrams: '',
    inTransitEta: '',
    lowStockThreshold: '',
    sessionReserveGrams: '',
    lore: '',
    tastingNotes: '', // We'll store as comma separated string in form
    isCustomWisdom: false,
    showWisdom: true,
    processingNotes: '',
    terroir: '',
    mood: '',
    experience: '',
    teaKey: '',
    wholesalePrice: '',
    catalogVisible: false,
  });

  const isEditMode = !!initialData;

  // Feature 26: fetch compass entry data when product has a sourceCompassEntryId
  useEffect(() => {
    if (!isOpen || !initialData?.sourceCompassEntryId) {
      setCompassSource(null);
      return;
    }
    let cancelled = false;
    setCompassSourceLoading(true);
    api.compass.list()
      .then((data: { entries?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>) => {
        if (cancelled) return;
        const entries: Array<Record<string, unknown>> = Array.isArray(data) ? data : (data?.entries ?? []);
        const entry = entries.find((e: Record<string, unknown>) => e.id === initialData.sourceCompassEntryId);
        if (entry) {
          const tasting = entry.tasting as Record<string, unknown> | null | undefined;
          setCompassSource({
            id: entry.id as string,
            vendorName: (entry.vendor_name as string) || (entry.vendorName as string) || undefined,
            origin: (entry.origin_region as string) || (entry.originRegion as string) || undefined,
            qualityRating: tasting ? (tasting.qualityRating as number | undefined) : undefined,
            notes: (entry.notes as string) || undefined,
          });
        } else {
          setCompassSource(null);
        }
      })
      .catch(() => { if (!cancelled) setCompassSource(null); })
      .finally(() => { if (!cancelled) setCompassSourceLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, initialData?.sourceCompassEntryId]);

  // #42 — Wrap onClose to clear draft on deliberate close
  const handleClose = () => {
    if (!isEditMode) setDraftProduct(null);
    onClose();
  };

  // Helper to get exchange rate for current form selection
  const currentRate = useMemo(() => {
    return rates.find(r => r.currency === formData.costCurrency)?.rateToUSD || 1;
  }, [formData.costCurrency, rates]);

  useEffect(() => {
    if (isOpen && initialData) {
      // Calculate USD shipping from stored Source Currency value
      const rate = rates.find(r => r.currency === initialData.costCurrency)?.rateToUSD || 1;
      const shipUSD = initialData.shippingRatePerKg ? (initialData.shippingRatePerKg / rate) : 13;

      setFormData({
        type: initialData.type,
        form: initialData.form || '',
        givenName: initialData.givenName,
        chineseName: initialData.chineseName || '',
        productName: initialData.productName,
        year: initialData.year?.toString() || '',
        originCountry: initialData.originCountry,
        originRegion: initialData.originRegion,
        stockGrams: initialData.stockGrams.toString(),
        quantityPurchased: initialData.quantityPurchased.toString(),
        costAmount: initialData.costAmount.toString(),
        shippingRateUSD: shipUSD.toFixed(2), // Pre-fill calculated USD
        costCurrency: initialData.costCurrency === 'UNK' ? 'UNK' : (initialData.costCurrency as Currency) || 'USD',
        vendor: initialData.vendor || '',
        description: initialData.description,
        imageUrl: initialData.imageUrl || '',
        additionalImages: initialData.additionalImages || [],
        status: initialData.status,
        fixedRetailPriceUSD: initialData.fixedRetailPriceUSD ? initialData.fixedRetailPriceUSD.toString() : '',
        isPersonal: initialData.isPersonal || false,
        canReorder: initialData.canReorder || false,
        isPublic: initialData.isPublic === undefined ? true : initialData.isPublic,
        isFeatured: initialData.isFeatured || false,
        isCurated: initialData.isCurated || false,
        recheckStock: initialData.recheckStock || false,
        inTransit: initialData.inTransit || false,
        inTransitGrams: initialData.inTransitGrams ? String(initialData.inTransitGrams) : '',
        inTransitEta: initialData.inTransitEta || '',
        lowStockThreshold: initialData.lowStockThreshold ? String(initialData.lowStockThreshold) : '',
        sessionReserveGrams: initialData.sessionReserveGrams ? String(initialData.sessionReserveGrams) : '',
        lore: initialData.lore || '',
        tastingNotes: initialData.tastingNotes ? initialData.tastingNotes.join(', ') : '',
        isCustomWisdom: initialData.isCustomWisdom || false,
        showWisdom: initialData.showWisdom === undefined ? true : initialData.showWisdom,
        processingNotes: initialData.processingNotes || '',
        terroir: initialData.terroir || '',
        mood: initialData.mood || '',
        experience: initialData.experience || '',
        teaKey: initialData.teaKey || (initialData as unknown as { tea_key?: string }).tea_key || '',
        wholesalePrice: initialData.wholesalePrice ? initialData.wholesalePrice.toString() : '',
        catalogVisible: initialData.catalogVisible || false,
      });
      setTastingData(initialData.tasting || {});
      setWisdomOpen(!!(initialData.lore || initialData.mood || initialData.experience || initialData.terroir || initialData.processingNotes || initialData.tasting));
    } else if (isOpen && !initialData) {
      setFormData({
        type: 'Dark',
        form: '',
        givenName: '',
        chineseName: '',
        productName: '',
        year: '',
        originCountry: 'China',
        originRegion: '',
        stockGrams: '',
        quantityPurchased: '',
        costAmount: '',
        shippingRateUSD: '13', // Explicit Default $13 USD per kg
        costCurrency: 'USD',
        vendor: '',
        description: '',
        imageUrl: '',
        additionalImages: [],
        status: 'Active',
        fixedRetailPriceUSD: '',
        isPersonal: false,
        canReorder: false,
        isPublic: true,
        isFeatured: false,
        isCurated: false,
        recheckStock: false,
        inTransit: false,
        inTransitGrams: '',
        inTransitEta: '',
        lowStockThreshold: '',
        sessionReserveGrams: '',
        lore: '',
        tastingNotes: '',
        isCustomWisdom: false,
        showWisdom: true,
        processingNotes: '',
        terroir: '',
        mood: '',
        experience: '',
        teaKey: '',
        wholesalePrice: '',
        catalogVisible: false,
      });
      setTastingData({});
      setWisdomOpen(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialData]);

  // LIVE CALCULATOR LOGIC
  const calc = useMemo(() => {
    // Convert USD shipping rate to source currency for calculatePricing
    const shippingSourcePerKg = (parseFloat(formData.shippingRateUSD) || 0) * currentRate;

    return calculatePricing(
        parseFloat(formData.costAmount) || 0,
        shippingSourcePerKg,
        parseFloat(formData.quantityPurchased) || 0,
        formData.costCurrency,
        rates,
        formData.type === 'Teaware'
    );
  }, [formData.costAmount, formData.shippingRateUSD, formData.quantityPurchased, formData.costCurrency, formData.type, rates, currentRate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleProductNameBlur = async () => {
    // Only auto-fill if we are creating a new item, we have a name, and lore is currently empty
    if (isEditMode || !formData.productName || formData.lore) return;

    try {
        // Search existing products for wisdom data (using the API)
        const products = await api.products.list();
        const match = products
            .filter((p: any) => p.product_name?.toLowerCase() === formData.productName.toLowerCase() && p.lore)
            .sort((a: any, b: any) => (b.is_custom_wisdom ? 1 : 0) - (a.is_custom_wisdom ? 1 : 0))[0];

        if (match) {
            const tastingNotes = Array.isArray(match.tasting_notes) ? match.tasting_notes : [];
            setFormData(prev => ({
                ...prev,
                lore: match.lore || prev.lore,
                tastingNotes: tastingNotes.length ? tastingNotes.join(', ') : prev.tastingNotes,
                isCustomWisdom: !!match.is_custom_wisdom,
                showWisdom: !!match.show_wisdom,
                processingNotes: match.processing_notes || prev.processingNotes,
                terroir: match.terroir || prev.terroir,
                mood: match.mood || prev.mood,
                experience: match.experience || prev.experience,
            }));
        }
    } catch (err) {
        console.error("Memory bank check failed:", err);
    }
  };

  const [generatingWisdom, setGeneratingWisdom] = useState(false);
  const [wisdomOpen, setWisdomOpen] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [pendingWisdom, setPendingWisdom] = useState<null | { lore: string; tastingNotes: string; chineseName: string; originRegion: string; processingNotes: string; terroir: string; mood: string; experience: string }>(null);
  const [showWisdomSaveHint, setShowWisdomSaveHint] = useState(false);

  // #42 — Show restore banner when opening a new product form and a draft exists
  useEffect(() => {
    if (isOpen && !initialData && draftProduct && Object.keys(draftProduct).length > 0) {
      setShowDraftBanner(true);
    } else {
      setShowDraftBanner(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // #42 — Debounced auto-save draft (only for new products, not edits)
  useEffect(() => {
    if (!isOpen || initialData) return;
    const timer = setTimeout(() => {
      setDraftProduct({ ...formData } as unknown as Partial<Product>);
    }, 2000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, isOpen]);

  const applyGeneratedWisdom = (data: typeof pendingWisdom) => {
    if (!data) return;
    setFormData(prev => ({
        ...prev,
        lore: data.lore || prev.lore,
        tastingNotes: data.tastingNotes || prev.tastingNotes,
        chineseName: prev.chineseName || data.chineseName,
        originRegion: prev.originRegion || data.originRegion,
        processingNotes: prev.processingNotes || data.processingNotes,
        terroir: prev.terroir || data.terroir,
        mood: prev.mood || data.mood,
        experience: prev.experience || data.experience,
        isCustomWisdom: false,
        showWisdom: true,
    }));
    setPendingWisdom(null);
    setShowWisdomSaveHint(true);
  };

  const handleGenerateWisdom = async () => {
    if (!formData.productName) {
        showToast("Please enter a product name first.", 'error');
        return;
    }

    setGeneratingWisdom(true);
    try {
        const prompt = aiPromptTemplate
            .replace('{{productName}}', formData.productName)
            .replace('{{type}}', formData.type);

        const data = await api.generateWisdom(prompt);
        const generated = {
            lore: data.lore || '',
            tastingNotes: data.tastingNotes ? data.tastingNotes.join(', ') : '',
            chineseName: data.chineseName || '',
            originRegion: data.originRegion || '',
            processingNotes: data.processingNotes || '',
            terroir: data.terroir || '',
            mood: data.mood || '',
            experience: data.experience || '',
        };

        // If there's existing lore, confirm before overwriting
        if (formData.lore && formData.lore.trim()) {
            setPendingWisdom(generated);
        } else {
            applyGeneratedWisdom(generated);
        }
    } catch (error: any) {
        console.error("Failed to generate wisdom:", error);
        showToast("Failed to generate wisdom. Please try again.", 'error');
    } finally {
        setGeneratingWisdom(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await api.uploadImage(file);
      setFormData(prev => ({ ...prev, imageUrl: url }));

    } catch (err: any) {
      console.error("Upload Error:", err);
      showToast(`Image upload failed: ${err.message}`, 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = () => {
    setFormData(prev => ({ ...prev, imageUrl: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
        const shippingSourceToSave = (parseFloat(formData.shippingRateUSD) || 0) * currentRate;

        const payload = {
            type: formData.type,
            form: formData.form || null,
            given_name: formData.givenName,
            chinese_name: formData.chineseName,
            product_name: formData.productName,
            year: formData.year ? parseInt(formData.year) : null,
            origin_country: formData.originCountry,
            origin_region: formData.originRegion,
            stock_grams: parseInt(formData.stockGrams) || 0,
            quantity_purchased: parseInt(formData.quantityPurchased) || 0,
            cost_amount: parseFloat(formData.costAmount) || 0,
            shipping_rate_per_kg: shippingSourceToSave,
            cost_currency: formData.costCurrency,
            vendor: formData.vendor,
            description: formData.description,
            image_url: formData.imageUrl || null,
            additional_images: formData.additionalImages.length > 0 ? formData.additionalImages : null,
            status: formData.status,
            fixed_retail_price_usd: formData.fixedRetailPriceUSD ? parseFloat(formData.fixedRetailPriceUSD) : null,
            is_personal: formData.isPersonal,
            can_reorder: formData.canReorder,
            is_public: formData.isPublic,
            is_featured: formData.isFeatured,
            is_curated: formData.isCurated,
            lore: formData.lore,
            tasting_notes: formData.tastingNotes.split(',').map(n => n.trim()).filter(n => n),
            tasting: Object.keys(tastingData).length > 0 ? tastingData : undefined,
            // Admin-authored tasting data speaks in the owner's voice.
            // Clearing the profile resets source so the product falls back to the style baseline.
            tasting_source: Object.keys(tastingData).length > 0 ? 'owner' : null,
            is_custom_wisdom: formData.isCustomWisdom,
            show_wisdom: formData.showWisdom,
            processing_notes: formData.processingNotes,
            terroir: formData.terroir,
            mood: formData.mood,
            experience: formData.experience,
            tea_key: formData.teaKey || null,
            recheck_stock: formData.recheckStock ? 1 : 0,
            in_transit: formData.inTransit ? 1 : 0,
            in_transit_grams: formData.inTransit && formData.inTransitGrams ? parseInt(formData.inTransitGrams) : null,
            in_transit_eta: formData.inTransit && formData.inTransitEta ? formData.inTransitEta : null,
            low_stock_threshold: formData.lowStockThreshold ? parseInt(formData.lowStockThreshold) : null,
            session_reserve_grams: (formData.type !== 'Teaware' && formData.sessionReserveGrams) ? parseInt(formData.sessionReserveGrams) : null,
            ...(isPlatformAccount ? {
              wholesale_price: formData.wholesalePrice ? parseFloat(formData.wholesalePrice) : null,
              catalog_visible: formData.catalogVisible ? 1 : 0,
            } : {}),
        };

        let productId: string | undefined;

        if (isEditMode && initialData) {
            await api.products.update(initialData.id, payload);
            productId = initialData.id;
        } else {
            const created = await api.products.create(payload);
            productId = created?.id;
        }

        // Link product to vendor customer
        if (productId && formData.vendor) {
            // Re-fetch customers to get any newly created vendor
            let vendorCustomer = customers.find(
              c => c.name.toLowerCase() === formData.vendor.toLowerCase()
            );
            if (!vendorCustomer) {
              try {
                const fresh = await api.customers.list();
                vendorCustomer = fresh?.find(
                  (c: any) => c.name?.toLowerCase() === formData.vendor.toLowerCase()
                );
              } catch { /* ignore */ }
            }
            if (vendorCustomer?.id) {
              try {
                await api.customers.linkProduct(vendorCustomer.id, productId);
              } catch (err) {
                // Link may already exist
                console.debug('Link product to vendor:', err);
              }
            }
        }

        setDraftProduct(null);
        onSuccess();
        onClose();
    } catch (error: any) {
        console.error("Save Error:", error);
        showToast(`Failed to save product: ${error.message || 'Unknown error'}`, 'error');
    } finally {
        setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Reusable input styles — warm tones only, zero grey
  const inputStyle = "w-full bg-transparent border-b border-tea-border rounded-none px-0 py-1.5 text-sm font-sans text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-accent-sub transition-colors placeholder-tea-text-sec/50";
  const selectStyle = "w-full bg-transparent border-b border-tea-border rounded-none appearance-none px-0 py-1.5 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-accent-sub transition-colors cursor-pointer font-sans";
  const labelStyle = "block text-xs uppercase tracking-wider text-tea-gold/70 mb-1 flex items-center gap-1 font-bold";
  const wisdomInputStyle = "w-full bg-transparent border border-tea-border rounded-lg px-3 py-2.5 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-gold placeholder-tea-text-sec/50 transition-colors font-sans";

  return (
    <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-label={initialData ? 'Edit product' : 'Add new product'}
        className="fixed inset-0 sidebar-inset z-priority flex items-stretch bg-tea-bg/90 backdrop-blur-md animate-in fade-in duration-200"
        onClick={handleClose}
    >
      <div
        className="bg-tea-surface border-x border-tea-border w-full flex flex-col overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div className="px-6 py-3.5 border-b border-tea-border flex justify-between items-center bg-tea-bg/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-tea-surface border border-tea-border rounded-full">
              <Edit className="text-tea-gold" size={16} />
            </div>
            <div>
              <h2 className="text-lg font-serif text-tea-text tracking-wide">{isEditMode ? 'EDIT ITEM' : 'NEW ITEM'}</h2>
              <p className="text-[10px] text-tea-text-sec font-mono uppercase tracking-[0.2em]">Database Access</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-tea-text-sec hover:text-tea-text transition-colors p-1.5 hover:bg-tea-bg rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* #42 — Draft restore banner */}
        {showDraftBanner && !isEditMode && (
          <div className="px-6 py-2.5 bg-tea-gold/10 border-b border-tea-border flex items-center justify-between gap-4 shrink-0">
            <span className="text-xs text-tea-text-sec">You have an unsaved draft. Restore?</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (draftProduct) {
                    setFormData(prev => ({ ...prev, ...(draftProduct as unknown as typeof prev) }));
                  }
                  setShowDraftBanner(false);
                }}
                className="text-xs font-bold text-tea-gold hover:text-tea-gold/80 uppercase tracking-wider transition-colors"
              >
                Restore
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftProduct(null);
                  setShowDraftBanner(false);
                }}
                className="text-xs text-tea-text-dim hover:text-tea-text-sec uppercase tracking-wider transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Content — Redesigned: compact data LEFT, content-rich RIGHT */}
        <form id="add-product-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto overscroll-contain grid grid-cols-1 lg:grid-cols-12 custom-scrollbar">

          {/* --- LEFT COLUMN: IDENTITY + COST (5/12) — compact fields --- */}
          <div className="lg:col-span-5 p-5 lg:p-6 space-y-5 border-b lg:border-b-0 lg:border-r border-tea-border">

            {/* TOGGLE CHIPS */}
            <div className="flex flex-wrap gap-1.5">
                <label className={`pill cursor-pointer select-none font-bold ${formData.isPersonal ? 'pill-active' : ''}`}>
                    <input type="checkbox" name="isPersonal" checked={formData.isPersonal} onChange={handleChange} className="hidden" />
                    <UserCheck size={12} /> Personal
                </label>
                <label className={`pill cursor-pointer select-none font-bold ${formData.canReorder ? 'pill-active' : ''}`}>
                    <input type="checkbox" name="canReorder" checked={formData.canReorder} onChange={handleChange} className="hidden" />
                    <RefreshCw size={12} /> Restockable
                </label>
                <label className={`pill cursor-pointer select-none font-bold ${formData.isPublic ? 'pill-active' : ''}`}>
                    <input type="checkbox" name="isPublic" checked={formData.isPublic} onChange={handleChange} className="hidden" />
                    <Globe size={12} /> Public
                </label>
                <label className={`pill cursor-pointer select-none font-bold ${formData.isFeatured ? 'pill-active' : ''}`}>
                    <input type="checkbox" name="isFeatured" checked={formData.isFeatured} onChange={handleChange} className="hidden" />
                    <Star size={12} /> Featured
                </label>
                <label className={`pill cursor-pointer select-none font-bold ${formData.isCurated ? 'pill-active' : ''}`}>
                    <input type="checkbox" name="isCurated" checked={formData.isCurated} onChange={handleChange} className="hidden" />
                    <Star size={12} /> Curated
                </label>
                {isPlatformAccount && (
                  <label className={`pill cursor-pointer select-none font-bold ${formData.catalogVisible ? 'pill-active' : ''}`}>
                    <input type="checkbox" checked={formData.catalogVisible} onChange={e => setFormData(prev => ({ ...prev, catalogVisible: e.target.checked }))} className="hidden" />
                    In Catalog
                  </label>
                )}
            </div>

            {/* CLASSIFICATION ROW */}
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className={labelStyle}><Layers size={9} /> Type *</label>
                  <select
                    name="type" value={formData.type} onChange={handleChange}
                    className={selectStyle}
                  >
                    {['Green', 'White', 'Yellow', 'Oolong', 'Red', 'Dark', 'Sheng', 'Shou', 'Herbal', 'Teaware', 'Misc'].map(t => <option key={t} value={t} className="bg-tea-surface text-tea-text">{t}</option>)}
                  </select>
               </div>
               <div>
                  <label className={labelStyle}>Form</label>
                  <select
                    name="form" value={formData.form} onChange={handleChange}
                    className={selectStyle}
                  >
                    <option value="" className="bg-tea-surface text-tea-text">— unset —</option>
                    {['Loose Leaf', 'Cake', 'Tuo', 'Brick', 'Rolled', 'Ball', 'Powder', 'Bag', 'Other'].map(f => (
                      <option key={f} value={f} className="bg-tea-surface text-tea-text">{f}</option>
                    ))}
                  </select>
               </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className={labelStyle}>Year</label>
                  <input name="year" type="number" inputMode="numeric" value={formData.year} onChange={handleChange} className={inputStyle} placeholder="YYYY" />
               </div>
               <div>
                  <label className={labelStyle}>Status</label>
                  <select
                    name="status" value={formData.status} onChange={handleChange}
                    className={`w-full border-b appearance-none rounded-none px-0 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg text-sm font-bold bg-transparent cursor-pointer font-sans ${
                        formData.status === 'Draft' ? 'text-tea-text-sec border-tea-text-sec/30' :
                        formData.status === 'Sold Out' ? 'text-tea-text-sec border-tea-text-sec/30' :
                        'text-tea-gold border-tea-accent-sub'
                    }`}
                  >
                    <option value="Active" className="bg-tea-surface text-tea-text">Active</option>
                    <option value="Draft" className="bg-tea-surface text-tea-text">Draft</option>
                    <option value="Sold Out" className="bg-tea-surface text-tea-text">Sold Out</option>
                  </select>
               </div>
            </div>

            {/* NOMENCLATURE */}
            <div className="space-y-3">
                <div>
                    <label className={labelStyle}><Tag size={9} /> Product Name / Cultivar *</label>
                    <input name="productName" required value={formData.productName} onChange={handleChange} onBlur={handleProductNameBlur} autoComplete="off" onFocus={(e) => { setTimeout(() => { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 300); }} className={inputStyle} placeholder="e.g. Alishan High Mountain" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelStyle}>Given Name</label>
                        <input name="givenName" value={formData.givenName} onChange={handleChange} autoComplete="off" onFocus={(e) => { setTimeout(() => { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 300); }} className={inputStyle} placeholder="e.g. Mist Walker" />
                    </div>
                    <div>
                        <label className={labelStyle}>Chinese Name</label>
                        <input name="chineseName" value={formData.chineseName} onChange={handleChange} autoComplete="off" onFocus={(e) => { setTimeout(() => { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 300); }} className={inputStyle} placeholder="e.g. 阿里山" />
                    </div>
                </div>
            </div>

            {/* PROVENANCE */}
            <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className={labelStyle}><Globe size={9} /> Origin Region</label>
                    <input name="originRegion" value={formData.originRegion} onChange={handleChange} autoComplete="off" onFocus={(e) => { setTimeout(() => { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 300); }} className={inputStyle} placeholder="e.g. Nantou, Taiwan" />
                 </div>
                 <div>
                    <label className={labelStyle}>Source</label>
                    <VendorPicker
                      value={formData.vendor}
                      onChange={(name) => setFormData(prev => ({ ...prev, vendor: name }))}
                      className={inputStyle}
                    />
                 </div>
            </div>

            {/* COST CALCULATION */}
            <div className="pt-2 border-t border-tea-border">
              <div className="flex items-center gap-2 mb-3">
                <Calculator size={12} className="text-tea-gold/70" />
                <span className="text-xs font-serif italic text-tea-text-sec">Cost Calculation</span>
              </div>

              <div className="bg-tea-bg p-4 rounded-xl border border-tea-border shadow-inner space-y-3 font-mono text-sm">

                 {/* INPUTS */}
                 <div className="space-y-2.5 border-b border-dashed border-tea-border pb-3">
                      <div className="flex justify-between items-center">
                          <label className="text-tea-gold/70 uppercase text-xs tracking-[0.2em]">Batch Cost</label>
                          <div className="flex items-center gap-2 border-b border-tea-border hover:border-tea-gold/40 transition-colors">
                              <select
                                  name="costCurrency" value={formData.costCurrency} onChange={handleChange}
                                  className="bg-transparent appearance-none rounded-none text-xs text-tea-gold font-bold outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg cursor-pointer uppercase"
                              >
                                  <option value="USD" className="bg-tea-surface text-tea-text">USD</option>
                                  <option value="NT" className="bg-tea-surface text-tea-text">NT</option>
                                  <option value="Yuan" className="bg-tea-surface text-tea-text">CNY</option>
                                  <option value="IDR" className="bg-tea-surface text-tea-text">IDR</option>
                                  <option value="JPY" className="bg-tea-surface text-tea-text">JPY</option>
                                  <option value="MYR" className="bg-tea-surface text-tea-text">MYR</option>
                              </select>
                              <input
                                  name="costAmount" type="number" step="0.01" value={formData.costAmount} onChange={handleChange}
                                  className="w-24 bg-transparent text-right text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg placeholder-tea-text-sec/40 tabular-nums" placeholder="0.00"
                                  inputMode="decimal" onFocus={(e) => { setTimeout(() => { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 300); }}
                              />
                          </div>
                      </div>
                      <div className="flex justify-between items-center">
                          <label className="text-tea-gold/70 uppercase text-xs tracking-[0.2em]">Weight (g)</label>
                          <input
                              name="quantityPurchased" type="number" value={formData.quantityPurchased} onChange={handleChange}
                              className="w-24 bg-transparent text-right text-tea-text border-b border-tea-border hover:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg placeholder-tea-text-sec/40 transition-colors tabular-nums" placeholder="0"
                              inputMode="decimal" onFocus={(e) => { setTimeout(() => { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 300); }}
                          />
                      </div>
                      <div className="flex justify-between items-center">
                          <label className="text-tea-gold/70 uppercase text-xs tracking-[0.2em]">Ship (USD/kg)</label>
                          <input
                              name="shippingRateUSD" type="number" step="0.01" value={formData.shippingRateUSD} onChange={handleChange}
                              className="w-24 bg-transparent text-right text-tea-text border-b border-tea-border hover:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg placeholder-tea-text-sec/40 transition-colors tabular-nums" placeholder="10.00"
                              inputMode="decimal" onFocus={(e) => { setTimeout(() => { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 300); }}
                          />
                      </div>
                 </div>

                 {/* CALCULATED */}
                 <div className="space-y-1.5">
                      <div className="flex justify-between text-tea-text-sec text-xs">
                           <span>Source Cost/g</span>
                           <span className="num">{calc.costPerGramSource.toFixed(3)} {formData.costCurrency}</span>
                      </div>
                      <div className="flex justify-between text-tea-text-sec text-xs">
                           <span>Exchange Rate</span>
                           <span className="num">{calc.rateUsed}</span>
                      </div>
                      <div className="flex justify-between text-tea-text text-xs pt-1">
                           <span>True Cost (USD)</span>
                           <span className="num text-tea-gold font-bold">${calc.trueCostUSD.toFixed(3)}/g</span>
                      </div>
                 </div>

                 {/* RETAIL OUTPUT */}
                 <div className="pt-2.5 border-t border-dashed border-tea-border">
                    <div className="flex justify-between items-center mb-1.5">
                       <label className="text-xs uppercase tracking-[0.2em] text-tea-gold font-bold">Retail (USD/g)</label>
                       <span className="text-[9px] text-tea-text-sec num">3x Markup: ${calc.suggestedRetailUSD.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-tea-surface border border-tea-border rounded-lg px-3 py-2">
                       <span className="text-base text-tea-text-sec font-serif">$</span>
                       <input
                          name="fixedRetailPriceUSD" type="number" inputMode="decimal" step="0.01" value={formData.fixedRetailPriceUSD} onChange={handleChange}
                          onFocus={(e) => {
                              if (!formData.fixedRetailPriceUSD && calc.suggestedRetailUSD > 0) {
                                  setFormData({ ...formData, fixedRetailPriceUSD: calc.suggestedRetailUSD.toFixed(2) });
                              }
                              setTimeout(() => { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 300);
                          }}
                          className={`flex-1 bg-transparent text-lg num outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg text-right ${
                              formData.fixedRetailPriceUSD && parseFloat(formData.fixedRetailPriceUSD) < calc.trueCostUSD
                              ? 'text-tea-gold font-bold' : 'text-tea-text'
                          }`}
                          placeholder={calc.suggestedRetailUSD.toFixed(2)}
                       />
                    </div>
                 </div>

                 {/* WHOLESALE PRICE — platform accounts only */}
                 {isPlatformAccount && (
                   <div className="pt-2.5 border-t border-dashed border-tea-border">
                     <label className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec block mb-1.5">Wholesale Price (USD/g)</label>
                     <input
                       type="number"
                       step="0.0001"
                       value={formData.wholesalePrice}
                       onChange={e => setFormData(prev => ({ ...prev, wholesalePrice: e.target.value }))}
                       placeholder="0.0000"
                       className="w-full border-b border-tea-border bg-transparent focus:border-tea-gold outline-none text-sm text-tea-text py-2 placeholder:text-tea-text-sec/50"
                     />
                   </div>
                 )}

                 {/* STOCK */}
                 <div className="pt-2">
                      <div className="flex justify-between items-center">
                          <label className="text-tea-gold/70 uppercase text-xs tracking-[0.2em]">Current Stock</label>
                          <input
                              name="stockGrams" type="number" value={formData.stockGrams} onChange={handleChange}
                              className="w-24 bg-transparent text-right text-tea-text border-b border-tea-border hover:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg placeholder-tea-text-sec/40 transition-colors tabular-nums" placeholder="0"
                              inputMode="numeric"
                          />
                      </div>

                      {/* Low-stock alert threshold */}
                      <div className="flex justify-between items-center mt-2">
                          <label className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim">Alert below (g)</label>
                          <input
                              name="lowStockThreshold" type="number" value={formData.lowStockThreshold} onChange={handleChange}
                              className="w-24 bg-transparent text-right text-tea-text-sec border-b border-tea-border hover:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg placeholder-tea-text-sec/40 transition-colors tabular-nums text-sm" placeholder="0"
                              inputMode="numeric"
                          />
                      </div>

                      {/* Session reserve threshold — tea only */}
                      {formData.type !== 'Teaware' && (
                        <div className="flex justify-between items-center mt-2">
                            <label className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim" title="Stock below this amount shows a low-availability warning on the shop.">Session reserve (g)</label>
                            <input
                                name="sessionReserveGrams" type="number" value={formData.sessionReserveGrams} onChange={handleChange}
                                className="w-24 bg-transparent text-right text-tea-text-sec border-b border-tea-border hover:border-tea-gold/40 outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg placeholder-tea-text-sec/40 transition-colors tabular-nums text-sm" placeholder="0"
                                inputMode="numeric"
                            />
                        </div>
                      )}

                      <label className="flex items-center gap-2 mt-1.5 cursor-pointer group">
                          <div className="relative">
                              <input type="checkbox" name="recheckStock" checked={formData.recheckStock} onChange={handleChange} className="sr-only" />
                              <div className={`w-3.5 h-3.5 rounded-sm border transition-colors ${formData.recheckStock ? 'bg-tea-gold border-tea-gold' : 'border-tea-border group-hover:border-tea-gold/40'}`}>
                                  {formData.recheckStock && <svg className="w-3.5 h-3.5 text-tea-bg" viewBox="0 0 14 14" fill="none"><path d="M3.5 7L6 9.5L10.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </div>
                          </div>
                          <span className="text-xs text-tea-text-sec group-hover:text-tea-gold transition-colors uppercase tracking-[0.15em]">Flag for stock recheck</span>
                      </label>

                      {/* In-transit toggle + expanded fields */}
                      <label className="flex items-center gap-2 mt-1.5 cursor-pointer group">
                          <div className="relative">
                              <input type="checkbox" name="inTransit" checked={formData.inTransit} onChange={handleChange} className="sr-only" />
                              <div className={`w-3.5 h-3.5 rounded-sm border transition-colors ${formData.inTransit ? 'bg-tea-gold border-tea-gold' : 'border-tea-border group-hover:border-tea-gold/40'}`}>
                                  {formData.inTransit && <svg className="w-3.5 h-3.5 text-tea-bg" viewBox="0 0 14 14" fill="none"><path d="M3.5 7L6 9.5L10.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </div>
                          </div>
                          <span className="text-xs text-tea-text-sec group-hover:text-tea-gold transition-colors uppercase tracking-[0.15em]">In transit</span>
                      </label>
                      {formData.inTransit && (
                        <div className="mt-2 pl-5 space-y-1.5 border-l border-tea-border">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim">Qty in transit (g)</label>
                            <input
                              name="inTransitGrams" type="number" value={formData.inTransitGrams} onChange={handleChange}
                              className="w-20 bg-transparent text-right text-tea-gold border-b border-tea-border hover:border-tea-gold/40 outline-none text-sm tabular-nums placeholder-tea-text-sec/40"
                              placeholder="0" inputMode="numeric"
                            />
                          </div>
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim">Expected arrival</label>
                            <input
                              name="inTransitEta" type="date" value={formData.inTransitEta} onChange={handleChange}
                              className="bg-transparent text-right text-tea-text-sec border-b border-tea-border hover:border-tea-gold/40 outline-none text-xs"
                            />
                          </div>
                        </div>
                      )}
                 </div>
              </div>
            </div>
          </div>

          {/* --- RIGHT COLUMN: CONTENT & WISDOM (7/12) — spacious for reading/editing --- */}
          <div className="lg:col-span-7 p-5 lg:p-6 space-y-5">

            {/* PHOTO UPLOAD */}
            <div>
                <label className={labelStyle}><ImageIcon size={9} /> Photo (Cloudflare R2)</label>
                {!formData.imageUrl ? (
                    <div className="relative mt-1">
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="img-upload" />
                        <label
                            htmlFor="img-upload"
                            className={`flex items-center justify-center gap-2 w-full border border-dashed border-tea-border rounded-lg p-3 cursor-pointer hover:bg-tea-bg hover:bg-tea-gold/5 transition-all text-sm ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                            {uploading ? <Loader2 className="animate-spin text-tea-gold" size={16} /> : <Upload className="text-tea-text-sec" size={16} />}
                            <span className="text-xs text-tea-text-sec font-mono">{uploading ? 'Uploading...' : 'Click to Upload Image'}</span>
                        </label>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 p-2 bg-tea-bg/50 border border-tea-border rounded-lg hover:bg-tea-gold/5 transition-colors mt-1">
                        <div className="w-20 h-20 md:w-24 md:h-24 rounded overflow-hidden bg-tea-bg border border-tea-border shrink-0 cursor-pointer">
                            <ImageThumbnail src={formData.imageUrl} type={formData.type} />
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-xs text-tea-text-sec font-mono truncate">{formData.imageUrl}</p>
                        </div>
                        <button type="button" onClick={handleRemoveImage} className="p-1.5 text-tea-text-sec hover:text-tea-gold hover:bg-tea-bg rounded transition-colors" title="Remove Image">
                            <Trash2 size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* ADDITIONAL PHOTOS — carousel preview */}
            {formData.imageUrl && (
              <div>
                <label className={labelStyle}><ImageIcon size={9} /> Additional Photos ({formData.additionalImages.length})</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {formData.additionalImages.map((url, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded overflow-hidden border border-tea-border group">
                      <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          additionalImages: prev.additionalImages.filter((_, i) => i !== idx),
                        }))}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                      >
                        <Trash2 size={12} className="text-white" />
                      </button>
                    </div>
                  ))}
                  <label className="w-16 h-16 rounded border border-dashed border-tea-border flex items-center justify-center cursor-pointer hover:bg-tea-gold/5 transition-colors">
                    <Upload size={14} className="text-tea-text-sec" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const url = await api.uploadImage(file);
                          setFormData(prev => ({
                            ...prev,
                            additionalImages: [...prev.additionalImages, url],
                          }));
                        } catch (err: any) {
                          showToast(`Upload failed: ${err.message}`, 'error');
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* DESCRIPTION */}
            <div>
                <label className={labelStyle}><FileText size={9} /> Private Admin Notes</label>
                <textarea
                    name="description" value={formData.description} onChange={handleChange} rows={3}
                    className={`${wisdomInputStyle} resize-vertical max-h-[200px] md:max-h-none overflow-y-auto`}
                    placeholder="Private notes (e.g. Bought from Mr. Chen's son, needs 6 months rest)..."
                />
            </div>

            {/* WISDOM & LORE — Always visible, full width for comfortable editing */}
            <div className="border-t border-tea-border pt-4">
                <div className="flex items-center justify-between mb-4">
                    <button
                        type="button"
                        onClick={() => setWisdomOpen(!wisdomOpen)}
                        className="flex items-center gap-2 group"
                    >
                        <ChevronDown size={14} className={`text-tea-gold/70 transition-transform duration-200 ${wisdomOpen ? '' : '-rotate-90'}`} />
                        <Star size={12} className="text-tea-gold" />
                        <span className="text-sm font-serif italic text-tea-text group-hover:text-tea-gold transition-colors">Wisdom & Lore</span>
                        {!wisdomOpen && formData.lore && (
                            <span className="text-[9px] text-tea-gold/70 uppercase tracking-wider ml-2">has content</span>
                        )}
                    </button>
                    {wisdomOpen && (
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={handleGenerateWisdom}
                                disabled={generatingWisdom || !formData.productName}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-tea-gold/10 text-tea-gold hover:bg-tea-gold/20 rounded text-[10px] uppercase tracking-wider font-bold transition-colors disabled:opacity-50"
                            >
                                {generatingWisdom ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                                Generate with AI
                            </button>
                            <label className="flex items-center gap-2 cursor-pointer group/toggle">
                                <div className="relative">
                                    <input type="checkbox" name="showWisdom" checked={formData.showWisdom} onChange={handleChange} className="sr-only" />
                                    <div className={`block w-7 h-3.5 rounded-full transition-colors ${formData.showWisdom ? 'bg-tea-gold/30' : 'bg-tea-border'}`}></div>
                                    <div className={`absolute left-0.5 top-0.5 bg-tea-text w-2.5 h-2.5 rounded-full transition-transform ${formData.showWisdom ? 'translate-x-3.5 bg-tea-gold' : ''}`}></div>
                                </div>
                                <span className="text-[10px] uppercase tracking-wider text-tea-text-sec group-hover/toggle:text-tea-text transition-colors">Show Publicly</span>
                            </label>
                        </div>
                    )}
                </div>

                {/* Overwrite confirmation banner */}
                {pendingWisdom && (
                    <div className="mx-1 mb-3 px-3 py-2.5 bg-tea-gold/10 border border-tea-border rounded-lg flex items-center justify-between gap-3">
                        <span className="text-xs text-tea-text-sec">AI wisdom ready. Replace existing lore?</span>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => applyGeneratedWisdom(pendingWisdom)}
                                className="text-xs font-bold text-tea-gold hover:text-tea-gold/80 uppercase tracking-wider transition-colors"
                            >
                                Replace
                            </button>
                            <button
                                type="button"
                                onClick={() => setPendingWisdom(null)}
                                className="text-xs text-tea-text-dim hover:text-tea-text-sec uppercase tracking-wider transition-colors"
                            >
                                Discard
                            </button>
                        </div>
                    </div>
                )}

                {/* Save hint after generation */}
                {showWisdomSaveHint && !pendingWisdom && (
                    <div className="mx-1 mb-3 px-3 py-2 bg-tea-accent-sub/30 border border-tea-border rounded-lg flex items-center justify-between gap-2">
                        <span className="text-xs text-tea-text-sec">Wisdom populated — save the product to persist it.</span>
                        <button type="button" onClick={() => setShowWisdomSaveHint(false)} className="text-[10px] text-tea-text-dim hover:text-tea-text-sec">✕</button>
                    </div>
                )}

                {wisdomOpen && (
                    <div className="space-y-4">
                        {/* Lore — generous textarea */}
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className={labelStyle}>Lore (History & Terroir)</label>
                                {formData.isCustomWisdom ? (
                                    <span className="text-[10px] text-tea-gold uppercase tracking-wider flex items-center gap-1"><Edit size={9} /> Handcrafted</span>
                                ) : formData.lore ? (
                                    <span className="text-[10px] text-tea-text-sec uppercase tracking-wider flex items-center gap-1"><Star size={9} /> AI Generated</span>
                                ) : null}
                            </div>
                            <textarea
                                name="lore" value={formData.lore}
                                onChange={(e) => { handleChange(e); setFormData(prev => ({ ...prev, isCustomWisdom: true })); }}
                                rows={8}
                                className={`${wisdomInputStyle} resize-y min-h-[120px] max-h-[400px] font-serif leading-relaxed`}
                                placeholder="Legend says these bushes were draped in imperial red robes..."
                            />
                            {formData.lore && (
                                <div className="text-[9px] text-tea-text-dim/40 text-right mt-0.5">{formData.lore.length} chars</div>
                            )}
                        </div>

                        {/* Tasting Taxonomy Picker */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className={`${labelStyle} mb-0`}>Tasting Notes</label>
                                {(() => {
                                    const hasTerms = flattenTastingNotes(tastingData).length > 0;
                                    const isOwner = initialData?.tastingSource === 'owner';
                                    if (!hasTerms) return null;
                                    return isOwner ? (
                                        <span className="text-[10px] uppercase tracking-[0.15em] text-tea-gold" style={{ fontFamily: 'var(--font-display)' }}>
                                            Tasted
                                        </span>
                                    ) : (
                                        <span className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim italic" style={{ fontFamily: 'var(--font-display)' }}>
                                            Draft — not yet confirmed
                                        </span>
                                    );
                                })()}
                            </div>
                            <button
                                type="button"
                                onClick={() => setTastingOpen(true)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-tea-surface rounded-xl text-sm text-tea-text hover:bg-tea-elevated transition-colors"
                            >
                                <span style={{ fontFamily: 'var(--font-body)' }}>
                                    {flattenTastingNotes(tastingData).length > 0
                                        ? `${flattenTastingNotes(tastingData).length} notes selected`
                                        : 'Open tasting session'}
                                </span>
                                <Edit size={14} className="text-tea-text-dim" />
                            </button>
                            {flattenTastingNotes(tastingData).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {flattenTastingNotes(tastingData).slice(0, 6).map(termId => {
                                        const Icon = resolveTermIcon(termId);
                                        return (
                                            <span key={termId} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-tea-gold/10 text-tea-gold">
                                                <Icon size={10} />
                                                {resolveTermLabel(termId)}
                                            </span>
                                        );
                                    })}
                                    {flattenTastingNotes(tastingData).length > 6 && (
                                        <span className="text-[11px] px-1.5 py-0.5 text-tea-text-dim">
                                            +{flattenTastingNotes(tastingData).length - 6} more
                                        </span>
                                    )}
                                </div>
                            )}
                            {tastingOpen && (
                                <TastingSession
                                    item={{
                                        id: initialData?.id ?? 'new',
                                        name: formData.givenName || formData.productName || 'New Tea',
                                        type: formData.type,
                                        image: formData.imageUrl || undefined,
                                    }}
                                    adminMode
                                    initialData={tastingData}
                                    onClose={() => setTastingOpen(false)}
                                    onSave={(data) => { setTastingData(data); setTastingOpen(false); }}
                                />
                            )}
                        </div>

                        {/* Terroir */}
                        <div>
                            <label className={labelStyle}>Terroir</label>
                            <textarea
                                name="terroir" value={formData.terroir}
                                onChange={(e) => { handleChange(e); setFormData(prev => ({ ...prev, isCustomWisdom: true })); }}
                                rows={3}
                                className={`${wisdomInputStyle} resize-y min-h-[60px] max-h-[200px] leading-relaxed`}
                                placeholder="High-altitude granite soils..."
                            />
                        </div>

                        {/* Mood Tags */}
                        <div>
                            <label className={labelStyle}>Mood Tags <span className="text-tea-text-dim text-xs font-normal">(comma-separated)</span></label>
                            <input
                                type="text"
                                name="mood" value={formData.mood}
                                onChange={(e) => { handleChange(e); setFormData(prev => ({ ...prev, isCustomWisdom: true })); }}
                                className={wisdomInputStyle}
                                placeholder="calm, meditative, grounding"
                            />
                        </div>

                        {/* Experience */}
                        <div>
                            <label className={labelStyle}>Experience Description</label>
                            <textarea
                                name="experience" value={formData.experience}
                                onChange={(e) => { handleChange(e); setFormData(prev => ({ ...prev, isCustomWisdom: true })); }}
                                rows={5}
                                className={`${wisdomInputStyle} resize-y min-h-[80px] max-h-[300px] font-serif leading-relaxed`}
                                placeholder="A deeply centering tea. The heavy roast anchors the body..."
                            />
                        </div>

                        {/* Processing Notes */}
                        <div>
                            <label className={labelStyle}>Processing / Craft Notes</label>
                            <textarea
                                name="processingNotes" value={formData.processingNotes}
                                onChange={(e) => { handleChange(e); setFormData(prev => ({ ...prev, isCustomWisdom: true })); }}
                                rows={3}
                                className={`${wisdomInputStyle} resize-y min-h-[60px] max-h-[200px] leading-relaxed`}
                                placeholder="Heavy charcoal roast over pine wood."
                            />
                        </div>

                        {/* Legacy Tasting Notes (comma-separated, kept for backward compat) */}
                        <div>
                            <label className={labelStyle}>Legacy Tasting Notes (Comma separated)</label>
                            <textarea
                                name="tastingNotes" value={formData.tastingNotes}
                                onChange={(e) => { handleChange(e); setFormData(prev => ({ ...prev, isCustomWisdom: true })); }}
                                rows={2}
                                className={`${wisdomInputStyle} resize-y min-h-[40px] max-h-[150px]`}
                                placeholder="Pine resin, dried longan, campfire"
                            />
                        </div>

                        {/* Tea Key — cross-account review anchor */}
                        <div className="pt-2 border-t border-tea-border">
                            <label className={labelStyle}>
                                Network Tea Key
                                <span className="text-tea-text-dim text-xs font-normal ml-2">for shared reviews across stores</span>
                            </label>
                            <input
                                type="text"
                                name="teaKey"
                                value={formData.teaKey}
                                onChange={handleChange}
                                className={wisdomInputStyle}
                                placeholder="silver-needle-fuding-2024"
                            />
                            <p className="text-tea-text-dim text-xs mt-1">
                                When partner stores tag their product with the same key, team members at both stores can share tasting notes on this tea.
                            </p>
                        </div>
                    </div>
                )}
            </div>
          </div>
        </form>

        {/* Feature 26: Sourcing lineage — edit mode only when sourceCompassEntryId is set */}
        {isEditMode && initialData?.sourceCompassEntryId && (
          <div className="px-6 py-4 border-t border-tea-border">
            <div className="flex items-center gap-2 mb-3">
              <Compass size={13} className="text-tea-gold shrink-0" />
              <h3 className="text-xs uppercase tracking-wider text-tea-gold/70 font-bold">Field Origin</h3>
            </div>
            {compassSourceLoading ? (
              <div className="flex items-center gap-2 text-tea-text-dim text-xs">
                <Loader2 size={13} className="animate-spin" />
                <span>Loading sourcing data…</span>
              </div>
            ) : compassSource ? (
              <div className="bg-tea-bg/50 border border-tea-border rounded-lg p-3 space-y-2 text-[12px]">
                {compassSource.vendorName && (
                  <div className="flex gap-2">
                    <span className="text-tea-text-dim w-20 shrink-0">Vendor</span>
                    <span className="text-tea-text-sec">{compassSource.vendorName}</span>
                  </div>
                )}
                {compassSource.origin && (
                  <div className="flex gap-2">
                    <span className="text-tea-text-dim w-20 shrink-0">Origin</span>
                    <span className="text-tea-text-sec">{compassSource.origin}</span>
                  </div>
                )}
                {compassSource.qualityRating != null && (
                  <div className="flex gap-2">
                    <span className="text-tea-text-dim w-20 shrink-0">Field rating</span>
                    <span className="text-tea-text-sec">{compassSource.qualityRating}/10</span>
                  </div>
                )}
                {compassSource.notes && (
                  <div className="flex gap-2">
                    <span className="text-tea-text-dim w-20 shrink-0">Notes</span>
                    <span className="text-tea-text-sec leading-relaxed line-clamp-3">{compassSource.notes}</span>
                  </div>
                )}
                <div className="pt-1">
                  <a
                    href={`/admin/compass?entry=${initialData.sourceCompassEntryId}`}
                    className="inline-flex items-center gap-1 text-tea-gold text-[11px] hover:underline"
                  >
                    <ExternalLink size={10} />
                    View full compass entry
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-xs text-tea-text-dim">
                Compass entry not found.{' '}
                <a
                  href={`/admin/compass?entry=${initialData.sourceCompassEntryId}`}
                  className="text-tea-gold hover:underline"
                >
                  Open compass
                </a>
              </div>
            )}
          </div>
        )}

        {/* Stock History — edit mode only */}
        {isEditMode && initialData?.id && (
          <div className="px-6 py-4 border-t border-tea-border">
            <StockLedgerPanel
              productId={initialData.id}
              productName={formData.givenName || formData.productName || ''}
            />
          </div>
        )}

        {/* Network Reviews — edit mode only when tea_key is set */}
        {isEditMode && formData.teaKey && (
          <div className="px-6 py-4 border-t border-tea-border">
            <h3 className="text-xs uppercase tracking-wider text-tea-gold/70 font-bold mb-3">
              Network Reviews
            </h3>
            <TeaReviewsPanel
              teaKey={formData.teaKey}
              productId={initialData?.id}
              productName={formData.givenName || formData.productName || ''}
              productType={formData.type || ''}
            />
          </div>
        )}

        {/* STICKY FOOTER */}
        <div className="px-6 py-3.5 border-t border-tea-border flex justify-between gap-3 bg-tea-bg/50 backdrop-blur-sm shrink-0">
            <button type="button" onClick={handleClose} className="px-6 py-2.5 text-xs font-medium text-tea-text-sec hover:text-tea-text transition-colors uppercase tracking-[0.2em] border border-transparent hover:border-tea-border rounded-lg">
                Cancel
            </button>
            <button
                type="submit"
                form="add-product-form"
                disabled={loading || !formData.productName || uploading}
                className="px-8 py-2.5 bg-tea-gold text-tea-bg text-xs font-bold uppercase tracking-[0.2em] hover:bg-tea-gold/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 rounded-lg shadow-lg shadow-tea-gold/10"
            >
                {loading || uploading ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                <span>Save Item</span>
            </button>
        </div>
      </div>
    </div>
  );
};