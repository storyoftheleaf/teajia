import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Save, Layers, Edit, Loader2, UserCheck, RefreshCw, Calculator, Tag, Globe, FileText, Image as ImageIcon, Upload, Trash2, Star, Sparkles, ChevronDown } from 'lucide-react';
import { api } from '../../lib/api';
import { Currency, Product, ExchangeRate, ProductType } from '../types';
import { calculatePricing } from '../utils';
import { TeaIllustration } from './TeaIllustration';
import { useAppStore } from '../store';
import { useToast } from './Toast';

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
            onError={() => setError(true)} 
        />
    );
};

export const AddProductModal: React.FC<AddProductModalProps> = ({ isOpen, onClose, onSuccess, initialData, rates = [] }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { aiPromptTemplate } = useAppStore();

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
    shippingRateUSD: '10', // INPUT IS ALWAYS USD NOW
    costCurrency: 'USD' as Currency,
    vendor: '',
    description: '',
    imageUrl: '',
    status: 'Active',
    fixedRetailPriceUSD: '', // Override
    isPersonal: false,
    canReorder: false,
    isPublic: true,
    isFeatured: false,
    recheckStock: false,
    lore: '',
    tastingNotes: '', // We'll store as comma separated string in form
    isCustomWisdom: false,
    showWisdom: true,
    processingNotes: '',
    terroir: '',
    mood: '',
    experience: '',
  });

  const isEditMode = !!initialData;

  // Helper to get exchange rate for current form selection
  const currentRate = useMemo(() => {
    return rates.find(r => r.currency === formData.costCurrency)?.rateToUSD || 1;
  }, [formData.costCurrency, rates]);

  useEffect(() => {
    if (isOpen && initialData) {
      // Calculate USD shipping from stored Source Currency value
      const rate = rates.find(r => r.currency === initialData.costCurrency)?.rateToUSD || 1;
      const shipUSD = initialData.shippingRatePerKg ? (initialData.shippingRatePerKg / rate) : 10;

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
        status: initialData.status,
        fixedRetailPriceUSD: initialData.fixedRetailPriceUSD ? initialData.fixedRetailPriceUSD.toString() : '',
        isPersonal: initialData.isPersonal || false,
        canReorder: initialData.canReorder || false,
        isPublic: initialData.isPublic === undefined ? true : initialData.isPublic,
        isFeatured: initialData.isFeatured || false,
        recheckStock: initialData.recheckStock || false,
        lore: initialData.lore || '',
        tastingNotes: initialData.tastingNotes ? initialData.tastingNotes.join(', ') : '',
        isCustomWisdom: initialData.isCustomWisdom || false,
        showWisdom: initialData.showWisdom === undefined ? true : initialData.showWisdom,
        processingNotes: initialData.processingNotes || '',
        terroir: initialData.terroir || '',
        mood: initialData.mood || '',
        experience: initialData.experience || '',
      });
      setWisdomOpen(!!(initialData.lore || initialData.mood || initialData.experience || initialData.terroir || initialData.processingNotes));
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
        shippingRateUSD: '10', // Explicit Default $10 USD
        costCurrency: 'USD',
        vendor: '',
        description: '',
        imageUrl: '',
        status: 'Active',
        fixedRetailPriceUSD: '',
        isPersonal: false,
        canReorder: false,
        isPublic: true,
        isFeatured: false,
        recheckStock: false,
        lore: '',
        tastingNotes: '',
        isCustomWisdom: false,
        showWisdom: true,
        processingNotes: '',
        terroir: '',
        mood: '',
        experience: '',
      });
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
        rates
    );
  }, [formData.costAmount, formData.shippingRateUSD, formData.quantityPurchased, formData.costCurrency, rates, currentRate]);

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
        setFormData(prev => ({
            ...prev,
            lore: data.lore || prev.lore,
            tastingNotes: data.tastingNotes ? data.tastingNotes.join(', ') : prev.tastingNotes,
            chineseName: prev.chineseName || data.chineseName || '',
            originRegion: prev.originRegion || data.originRegion || '',
            processingNotes: prev.processingNotes || data.processingNotes || '',
            terroir: prev.terroir || data.terroir || '',
            mood: prev.mood || data.mood || '',
            experience: prev.experience || data.experience || '',
            isCustomWisdom: false,
            showWisdom: true,
        }));
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
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const data = await api.uploadImage(fileName, file.type);
      if (!data?.uploadUrl) throw new Error("No upload URL returned.");

      const uploadRes = await fetch(data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      if (!uploadRes.ok) throw new Error("Failed to upload to Cloudflare storage.");

      setFormData(prev => ({ ...prev, imageUrl: data.publicUrl }));

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
            status: formData.status,
            fixed_retail_price_usd: formData.fixedRetailPriceUSD ? parseFloat(formData.fixedRetailPriceUSD) : null,
            is_personal: formData.isPersonal,
            can_reorder: formData.canReorder,
            is_public: formData.isPublic,
            is_featured: formData.isFeatured,
            lore: formData.lore,
            tasting_notes: formData.tastingNotes.split(',').map(n => n.trim()).filter(n => n),
            is_custom_wisdom: formData.isCustomWisdom,
            show_wisdom: formData.showWisdom,
            processing_notes: formData.processingNotes,
            terroir: formData.terroir,
            mood: formData.mood,
            experience: formData.experience,
            recheck_stock: formData.recheckStock ? 1 : 0,
        };

        if (isEditMode && initialData) {
            await api.products.update(initialData.id, payload);
        } else {
            await api.products.create(payload);
        }

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

  // Reusable input styles for the "Ledger" look
  const inputStyle = "w-full bg-transparent border-b border-tea-border rounded-none px-0 py-1.5 text-sm font-sans text-tea-text outline-none focus:border-tea-accent transition-colors placeholder-tea-text-dim/30";
  const selectStyle = "w-full bg-transparent border-b border-tea-border rounded-none appearance-none px-0 py-1.5 text-sm text-tea-text outline-none focus:border-tea-accent transition-colors cursor-pointer font-sans";
  const labelStyle = "block text-[10px] uppercase tracking-wider text-tea-text-dim/70 mb-1 flex items-center gap-1 font-bold";
  const wisdomInputStyle = "w-full bg-transparent border-b border-tea-border rounded-none px-0 py-1.5 text-sm text-tea-text outline-none focus:border-tea-accent placeholder-tea-text-dim/30 transition-colors font-sans";

  return (
    <div
        role="dialog"
        aria-modal="true"
        aria-label={initialData ? 'Edit product' : 'Add new product'}
        className="fixed inset-0 z-modal flex items-center justify-center bg-tea-bg/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
        onClick={onClose}
    >
      <div
        className="bg-tea-surface border border-tea-border w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl rounded-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div className="px-5 py-3 border-b border-tea-border flex justify-between items-center bg-tea-bg/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-tea-surface border border-tea-border rounded-full">
              <Edit className="text-tea-accent" size={16} />
            </div>
            <div>
              <h2 className="text-lg font-serif text-tea-text tracking-wide">{isEditMode ? 'EDIT ITEM' : 'NEW ITEM'}</h2>
              <p className="text-xs md:text-[9px] text-tea-text-dim font-mono uppercase tracking-[0.2em]">Database Access</p>
            </div>
          </div>
          <button onClick={onClose} className="text-tea-text-dim hover:text-tea-text transition-colors p-1.5 hover:bg-tea-bg rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form id="add-product-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 custom-scrollbar">

          {/* --- LEFT COLUMN: IDENTITY & DETAILS (7/12) --- */}
          <div className="lg:col-span-7 p-4 lg:p-5 space-y-4 border-b lg:border-b-0 lg:border-r border-tea-border">

            {/* TOGGLE CHIPS */}
            <div className="flex flex-wrap gap-1.5">
                <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border cursor-pointer select-none transition-all text-[9px] uppercase tracking-[0.15em] font-bold ${formData.isPersonal ? 'bg-tea-accent/10 text-tea-accent border-tea-accent/30' : 'bg-tea-bg text-tea-text-dim border-tea-border hover:border-tea-text-dim/50'}`}>
                    <input type="checkbox" name="isPersonal" checked={formData.isPersonal} onChange={handleChange} className="hidden" />
                    <UserCheck size={12} /> Personal
                </label>
                <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border cursor-pointer select-none transition-all text-[9px] uppercase tracking-[0.15em] font-bold ${formData.canReorder ? 'bg-tea-accent/10 text-tea-accent border-tea-accent/30' : 'bg-tea-bg text-tea-text-dim border-tea-border hover:border-tea-text-dim/50'}`}>
                    <input type="checkbox" name="canReorder" checked={formData.canReorder} onChange={handleChange} className="hidden" />
                    <RefreshCw size={12} /> Restockable
                </label>
                <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border cursor-pointer select-none transition-all text-[9px] uppercase tracking-[0.15em] font-bold ${formData.isPublic ? 'bg-tea-accent/10 text-tea-accent border-tea-accent/30' : 'bg-tea-bg text-tea-text-dim border-tea-border hover:border-tea-text-dim/50'}`}>
                    <input type="checkbox" name="isPublic" checked={formData.isPublic} onChange={handleChange} className="hidden" />
                    <Globe size={12} /> Public
                </label>
                <label className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border cursor-pointer select-none transition-all text-[9px] uppercase tracking-[0.15em] font-bold ${formData.isFeatured ? 'bg-tea-accent/10 text-tea-accent border-tea-accent/30' : 'bg-tea-bg text-tea-text-dim border-tea-border hover:border-tea-text-dim/50'}`}>
                    <input type="checkbox" name="isFeatured" checked={formData.isFeatured} onChange={handleChange} className="hidden" />
                    <Star size={12} /> Featured
                </label>
            </div>

            {/* CLASSIFICATION ROW */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
               <div>
                  <label className={labelStyle}><Layers size={9} /> Type *</label>
                  <select
                    name="type" value={formData.type} onChange={handleChange}
                    className={selectStyle}
                  >
                    {['Green', 'White', 'Yellow', 'Oolong', 'Red', 'Dark', 'Sheng', 'Shou', 'Herbal', 'Matcha', 'Flower', 'Teaware', 'Misc'].map(t => <option key={t} value={t} className="bg-tea-surface text-tea-text">{t}</option>)}
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
               <div>
                  <label className={labelStyle}>Year</label>
                  <input name="year" type="number" inputMode="decimal" value={formData.year} onChange={handleChange} className={inputStyle} placeholder="YYYY" />
               </div>
               <div>
                  <label className={labelStyle}>Status</label>
                  <select
                    name="status" value={formData.status} onChange={handleChange}
                    className={`w-full border-b appearance-none rounded-none px-0 py-1.5 outline-none text-sm font-bold bg-transparent cursor-pointer font-sans ${
                        formData.status === 'Draft' ? 'text-tea-text-dim/80 border-tea-text-dim/30' :
                        formData.status === 'Sold Out' ? 'text-tea-text-dim/80 border-tea-text-dim/30' :
                        'text-tea-accent border-tea-accent/50'
                    }`}
                  >
                    <option value="Active" className="bg-tea-surface text-tea-text">Active</option>
                    <option value="Draft" className="bg-tea-surface text-tea-text">Draft</option>
                    <option value="Sold Out" className="bg-tea-surface text-tea-text">Sold Out</option>
                  </select>
               </div>
            </div>

            {/* NOMENCLATURE */}
            <div className="space-y-2">
                <div>
                    <label className={labelStyle}><Tag size={9} /> Product Name / Cultivar *</label>
                    <input name="productName" required value={formData.productName} onChange={handleChange} onBlur={handleProductNameBlur} className={inputStyle} placeholder="e.g. Alishan High Mountain" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={labelStyle}>Given Name (Marketing)</label>
                        <input name="givenName" value={formData.givenName} onChange={handleChange} className={inputStyle} placeholder="e.g. Mist Walker" />
                    </div>
                    <div>
                        <label className={labelStyle}>Chinese Name</label>
                        <input name="chineseName" value={formData.chineseName} onChange={handleChange} className={inputStyle} placeholder="e.g. 阿里山" />
                    </div>
                </div>
            </div>

            {/* PROVENANCE */}
            <div className="grid grid-cols-2 gap-3">
                 <div>
                    <label className={labelStyle}><Globe size={9} /> Origin Region</label>
                    <input name="originRegion" value={formData.originRegion} onChange={handleChange} className={inputStyle} placeholder="e.g. Nantou, Taiwan" />
                 </div>
                 <div>
                    <label className={labelStyle}>Vendor</label>
                    <input name="vendor" value={formData.vendor} onChange={handleChange} className={inputStyle} placeholder="e.g. Chen Family" />
                 </div>
            </div>

            {/* PHOTO UPLOAD */}
            <div>
                <label className={labelStyle}><ImageIcon size={9} /> Photo (Cloudflare R2)</label>
                {!formData.imageUrl ? (
                    <div className="relative mt-1">
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="img-upload" />
                        <label
                            htmlFor="img-upload"
                            className={`flex items-center justify-center gap-2 w-full border border-dashed border-tea-border rounded-lg p-3 cursor-pointer hover:bg-tea-bg hover:border-tea-text-dim transition-all text-sm ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                            {uploading ? <Loader2 className="animate-spin text-tea-accent" size={16} /> : <Upload className="text-tea-text-dim" size={16} />}
                            <span className="text-xs text-tea-text-dim font-mono">{uploading ? 'Uploading...' : 'Click to Upload Image'}</span>
                        </label>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 p-2 bg-tea-bg/50 border border-tea-border rounded-lg hover:border-tea-text-dim/50 transition-colors mt-1">
                        <div className="w-10 h-10 rounded overflow-hidden bg-tea-bg border border-tea-border shrink-0">
                            <ImageThumbnail src={formData.imageUrl} type={formData.type} />
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-[10px] text-tea-text-dim font-mono truncate">{formData.imageUrl}</p>
                        </div>
                        <button type="button" onClick={handleRemoveImage} className="p-1.5 text-tea-text-dim hover:text-tea-accent hover:bg-tea-bg rounded transition-colors" title="Remove Image">
                            <Trash2 size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* DESCRIPTION */}
            <div>
                <label className={labelStyle}><FileText size={9} /> Private Admin Notes / Description</label>
                <textarea
                    name="description" value={formData.description} onChange={handleChange} rows={2}
                    className="w-full bg-transparent border-b border-tea-border rounded-none px-0 py-1.5 text-sm text-tea-text outline-none focus:border-tea-accent placeholder-tea-text-dim/30 transition-colors resize-none font-sans"
                    placeholder="Private notes (e.g. Bought from Mr. Chen's son, needs 6 months rest)..."
                />
            </div>
          </div>

          {/* --- RIGHT COLUMN: RECEIPT + WISDOM (5/12) --- */}
          <div className="lg:col-span-5 p-4 lg:p-5 space-y-4">

            {/* COST CALCULATION */}
            <div className="flex items-center gap-2 mb-1">
              <Calculator size={12} className="text-tea-text-dim" />
              <span className="text-xs font-serif italic text-tea-text-dim">Cost Calculation</span>
            </div>

            <div className="bg-tea-bg p-4 rounded-xl border border-tea-border shadow-inner space-y-4 font-mono text-sm">

               {/* INPUTS */}
               <div className="space-y-3 border-b border-dashed border-tea-border pb-4">
                    <div className="flex justify-between items-center">
                        <label className="text-tea-text-dim uppercase text-xs md:text-[10px] tracking-[0.2em]">Batch Cost</label>
                        <div className="flex items-center gap-2 border-b border-tea-border hover:border-tea-text-dim transition-colors">
                            <select
                                name="costCurrency" value={formData.costCurrency} onChange={handleChange}
                                className="bg-transparent appearance-none rounded-none text-[10px] text-tea-accent font-bold outline-none cursor-pointer uppercase"
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
                                className="w-24 md:w-20 bg-transparent text-right text-tea-text outline-none placeholder-tea-text-dim/30 tabular-nums" placeholder="0.00"
                                inputMode="decimal"
                            />
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <label className="text-tea-text-dim uppercase text-xs md:text-[10px] tracking-[0.2em]">Weight (g)</label>
                        <input
                            name="quantityPurchased" type="number" value={formData.quantityPurchased} onChange={handleChange}
                            className="w-24 md:w-20 bg-transparent text-right text-tea-text border-b border-tea-border hover:border-tea-text-dim outline-none placeholder-tea-text-dim/30 transition-colors tabular-nums" placeholder="0"
                            inputMode="decimal"
                        />
                    </div>
                    <div className="flex justify-between items-center">
                        <label className="text-tea-text-dim uppercase text-xs md:text-[10px] tracking-[0.2em]">Ship (USD/kg)</label>
                        <input
                            name="shippingRateUSD" type="number" step="0.01" value={formData.shippingRateUSD} onChange={handleChange}
                            className="w-24 md:w-20 bg-transparent text-right text-tea-text border-b border-tea-border hover:border-tea-text-dim outline-none placeholder-tea-text-dim/30 transition-colors tabular-nums" placeholder="10.00"
                            inputMode="decimal"
                        />
                    </div>
               </div>

               {/* CALCULATED */}
               <div className="space-y-2">
                    <div className="flex justify-between text-tea-text-dim text-xs">
                         <span>Source Cost/g</span>
                         <span className="num">{calc.costPerGramSource.toFixed(3)} {formData.costCurrency}</span>
                    </div>
                    <div className="flex justify-between text-tea-text-dim text-xs">
                         <span>Exchange Rate</span>
                         <span className="num">{calc.rateUsed}</span>
                    </div>
                    <div className="flex justify-between text-tea-text text-xs pt-1">
                         <span>True Cost (USD)</span>
                         <span className="num text-tea-accent font-bold">${calc.trueCostUSD.toFixed(3)}/g</span>
                    </div>
               </div>

               {/* RETAIL OUTPUT */}
               <div className="pt-3 border-t border-dashed border-tea-border">
                  <div className="flex justify-between items-center mb-1.5">
                     <label className="text-[10px] uppercase tracking-[0.2em] text-tea-accent font-bold">Retail (USD/g)</label>
                     <span className="text-[9px] text-tea-text-dim/70 num">3x Markup: ${calc.suggestedRetailUSD.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-tea-surface border border-tea-border rounded-lg px-3 py-2">
                     <span className="text-base text-tea-text-dim font-serif">$</span>
                     <input
                        name="fixedRetailPriceUSD" type="number" inputMode="decimal" step="0.01" value={formData.fixedRetailPriceUSD} onChange={handleChange}
                        onFocus={() => {
                            if (!formData.fixedRetailPriceUSD && calc.suggestedRetailUSD > 0) {
                                setFormData({ ...formData, fixedRetailPriceUSD: calc.suggestedRetailUSD.toFixed(2) });
                            }
                        }}
                        className={`flex-1 bg-transparent text-lg num outline-none text-right ${
                            formData.fixedRetailPriceUSD && parseFloat(formData.fixedRetailPriceUSD) < calc.trueCostUSD
                            ? 'text-tea-accent font-bold' : 'text-tea-text'
                        }`}
                        placeholder={calc.suggestedRetailUSD.toFixed(2)}
                     />
                  </div>
               </div>

               {/* STOCK */}
               <div className="pt-2">
                    <div className="flex justify-between items-center">
                        <label className="text-tea-text-dim uppercase text-[10px] tracking-[0.2em]">Current Stock</label>
                        <input
                            name="stockGrams" type="number" value={formData.stockGrams} onChange={handleChange}
                            className="w-24 md:w-20 bg-transparent text-right text-tea-text border-b border-tea-border hover:border-tea-text-dim outline-none placeholder-tea-text-dim/30 transition-colors tabular-nums" placeholder="0"
                            inputMode="decimal"
                        />
                    </div>
                    <label className="flex items-center gap-2 mt-1.5 cursor-pointer group">
                        <div className="relative">
                            <input type="checkbox" name="recheckStock" checked={formData.recheckStock} onChange={handleChange} className="sr-only" />
                            <div className={`w-3.5 h-3.5 rounded-sm border transition-colors ${formData.recheckStock ? 'bg-tea-accent border-tea-accent' : 'border-tea-border group-hover:border-tea-text-dim'}`}>
                                {formData.recheckStock && <svg className="w-3.5 h-3.5 text-tea-bg" viewBox="0 0 14 14" fill="none"><path d="M3.5 7L6 9.5L10.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </div>
                        </div>
                        <span className="text-[10px] text-tea-text-dim group-hover:text-tea-accent transition-colors uppercase tracking-[0.15em]">Flag for stock recheck</span>
                    </label>
               </div>
            </div>

            {/* WISDOM & LORE — COLLAPSIBLE */}
            <div className="border-t border-dashed border-tea-border pt-3">
                <button
                    type="button"
                    onClick={() => setWisdomOpen(!wisdomOpen)}
                    className="flex items-center justify-between w-full group"
                >
                    <div className="flex items-center gap-2">
                        <ChevronDown size={14} className={`text-tea-text-dim transition-transform duration-200 ${wisdomOpen ? '' : '-rotate-90'}`} />
                        <Star size={12} className="text-tea-accent" />
                        <span className="text-xs font-serif italic text-tea-text-dim group-hover:text-tea-text transition-colors">Wisdom & Lore</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {!wisdomOpen && formData.lore && (
                            <span className="text-[9px] text-tea-accent/60 uppercase tracking-wider">has content</span>
                        )}
                    </div>
                </button>

                {wisdomOpen && (
                    <div className="space-y-3 mt-3">
                        {/* AI + Show Publicly controls */}
                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={handleGenerateWisdom}
                                disabled={generatingWisdom || !formData.productName}
                                className="flex items-center gap-1.5 px-2 py-1 bg-tea-accent/10 text-tea-accent hover:bg-tea-accent/20 rounded text-xs md:text-[9px] uppercase tracking-wider font-bold transition-colors disabled:opacity-50"
                            >
                                {generatingWisdom ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                                Generate with AI
                            </button>
                            <label className="flex items-center gap-2 cursor-pointer group/toggle">
                                <div className="relative">
                                    <input type="checkbox" name="showWisdom" checked={formData.showWisdom} onChange={handleChange} className="sr-only" />
                                    <div className={`block w-7 h-3.5 rounded-full transition-colors ${formData.showWisdom ? 'bg-tea-accent/30' : 'bg-tea-border'}`}></div>
                                    <div className={`absolute left-0.5 top-0.5 bg-tea-text w-2.5 h-2.5 rounded-full transition-transform ${formData.showWisdom ? 'translate-x-3.5 bg-tea-accent' : ''}`}></div>
                                </div>
                                <span className="text-[9px] uppercase tracking-wider text-tea-text-dim group-hover/toggle:text-tea-text transition-colors">Show Publicly</span>
                            </label>
                        </div>

                        {/* Lore */}
                        <div>
                            <div className="flex justify-between items-center mb-0.5">
                                <label className={labelStyle}>Lore (History & Terroir)</label>
                                {formData.isCustomWisdom ? (
                                    <span className="text-[9px] text-tea-accent uppercase tracking-wider flex items-center gap-1"><Edit size={9} /> Handcrafted</span>
                                ) : formData.lore ? (
                                    <span className="text-[9px] text-tea-text-dim uppercase tracking-wider flex items-center gap-1"><Star size={9} /> AI Generated</span>
                                ) : null}
                            </div>
                            <textarea
                                name="lore" value={formData.lore}
                                onChange={(e) => { handleChange(e); setFormData(prev => ({ ...prev, isCustomWisdom: true })); }}
                                rows={2}
                                className={`${wisdomInputStyle} resize-none`}
                                placeholder="Legend says these bushes were draped in imperial red robes..."
                            />
                        </div>

                        {/* Mood + Terroir on one row */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelStyle}>Mood</label>
                                <input
                                    name="mood" type="text" value={formData.mood}
                                    onChange={(e) => { handleChange(e); setFormData(prev => ({ ...prev, isCustomWisdom: true })); }}
                                    className={wisdomInputStyle} placeholder="Grounding & Meditative"
                                />
                            </div>
                            <div>
                                <label className={labelStyle}>Terroir</label>
                                <input
                                    name="terroir" type="text" value={formData.terroir}
                                    onChange={(e) => { handleChange(e); setFormData(prev => ({ ...prev, isCustomWisdom: true })); }}
                                    className={wisdomInputStyle} placeholder="High-altitude granite soils..."
                                />
                            </div>
                        </div>

                        {/* Experience */}
                        <div>
                            <label className={labelStyle}>Experience Description</label>
                            <textarea
                                name="experience" value={formData.experience}
                                onChange={(e) => { handleChange(e); setFormData(prev => ({ ...prev, isCustomWisdom: true })); }}
                                rows={2}
                                className={`${wisdomInputStyle} resize-none`}
                                placeholder="A deeply centering tea. The heavy roast anchors the body..."
                            />
                        </div>

                        {/* Processing Notes */}
                        <div>
                            <label className={labelStyle}>Processing / Craft Notes</label>
                            <input
                                name="processingNotes" type="text" value={formData.processingNotes}
                                onChange={(e) => { handleChange(e); setFormData(prev => ({ ...prev, isCustomWisdom: true })); }}
                                className={wisdomInputStyle} placeholder="Heavy charcoal roast over pine wood."
                            />
                        </div>

                        {/* Tasting Notes */}
                        <div>
                            <label className={labelStyle}>Tasting Notes (Comma separated)</label>
                            <textarea
                                name="tastingNotes" value={formData.tastingNotes}
                                onChange={(e) => { handleChange(e); setFormData(prev => ({ ...prev, isCustomWisdom: true })); }}
                                rows={2}
                                className={`${wisdomInputStyle} resize-none`}
                                placeholder="Pine resin, dried longan, campfire"
                            />
                        </div>
                    </div>
                )}
            </div>
          </div>
        </form>

        {/* STICKY FOOTER */}
        <div className="px-5 py-3 border-t border-tea-border flex justify-end gap-3 bg-tea-bg/50 backdrop-blur-sm shrink-0">
            <button type="button" onClick={onClose} className="px-6 py-2.5 text-xs font-medium text-tea-text-dim hover:text-tea-text transition-colors uppercase tracking-[0.2em] border border-transparent hover:border-tea-border rounded-lg">
                Cancel
            </button>
            <button
                type="submit"
                form="add-product-form"
                disabled={loading || !formData.productName || uploading}
                className="px-8 py-2.5 bg-tea-accent text-tea-bg text-xs font-bold uppercase tracking-[0.2em] hover:bg-tea-accent/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 rounded-lg shadow-lg shadow-tea-accent/10"
            >
                {loading || uploading ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                <span>Save Item</span>
            </button>
        </div>
      </div>
    </div>
  );
};