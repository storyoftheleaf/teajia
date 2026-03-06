import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Save, Layers, Edit, Loader2, UserCheck, RefreshCw, Calculator, Tag, Globe, FileText, Image as ImageIcon, Upload, Trash2, Star, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';
import { Currency, Product, ExchangeRate, ProductType } from '../types';
import { calculatePricing } from '../utils';
import { TeaIllustration } from './TeaIllustration';
import { GoogleGenAI, Type } from "@google/genai";
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
            <div className="w-full h-full bg-neutral-800/50 flex items-center justify-center p-3 opacity-50 grayscale">
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
    lore: '',
    tastingNotes: '', // We'll store as comma separated string in form
    isCustomWisdom: false,
    showWisdom: true,
    processingNotes: '',
    mood: '',
    experience: '',
    liquorColor: ''
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
        lore: initialData.lore || '',
        tastingNotes: initialData.tastingNotes ? initialData.tastingNotes.join(', ') : '',
        isCustomWisdom: initialData.isCustomWisdom || false,
        showWisdom: initialData.showWisdom === undefined ? true : initialData.showWisdom,
        processingNotes: initialData.processingNotes || '',
        mood: initialData.mood || '',
        experience: initialData.experience || '',
        liquorColor: initialData.liquorColor || ''
      });
    } else if (isOpen && !initialData) {
      setFormData({
        type: 'Dark',
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
        lore: '',
        tastingNotes: '',
        isCustomWisdom: false,
        showWisdom: true,
        processingNotes: '',
        mood: '',
        experience: '',
        liquorColor: ''
      });
    }
  }, [isOpen, initialData, rates]);

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
                mood: match.mood || prev.mood,
                experience: match.experience || prev.experience,
                liquorColor: match.liquor_color || prev.liquorColor
            }));
        }
    } catch (err) {
        console.error("Memory bank check failed:", err);
    }
  };

  const [generatingWisdom, setGeneratingWisdom] = useState(false);

  const handleGenerateWisdom = async () => {
    if (!formData.productName) {
        showToast("Please enter a product name first.", 'error');
        return;
    }

    setGeneratingWisdom(true);
    try {
        const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
        
        const prompt = aiPromptTemplate
            .replace('{{productName}}', formData.productName)
            .replace('{{type}}', formData.type);

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        lore: {
                            type: Type.STRING,
                            description: "2-3 sentences of historical or geographical lore about the tea."
                        },
                        tastingNotes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.STRING
                            },
                            description: "3-4 distinct sensory tasting notes."
                        },
                        chineseName: {
                            type: Type.STRING,
                            description: "Traditional Chinese name of the tea, if known."
                        },
                        originRegion: {
                            type: Type.STRING,
                            description: "Specific origin region, e.g., 'Nantou, Taiwan'."
                        },
                        processingNotes: {
                            type: Type.STRING,
                            description: "Processing notes, e.g., 'Heavy charcoal roast over pine wood.'"
                        },
                        mood: {
                            type: Type.STRING,
                            description: "A short mood or feeling, e.g., 'Grounding & Meditative'"
                        },
                        experience: {
                            type: Type.STRING,
                            description: "1-2 sentences describing the experience or feeling of drinking the tea."
                        },
                        liquorColor: {
                            type: Type.STRING,
                            description: "The color of the brewed tea liquor, e.g., 'Deep Amber'"
                        }
                    },
                    required: ["lore", "tastingNotes"]
                }
            }
        });

        const jsonStr = response.text?.trim();
        if (jsonStr) {
            const data = JSON.parse(jsonStr);
            setFormData(prev => ({
                ...prev,
                lore: data.lore || prev.lore,
                tastingNotes: data.tastingNotes ? data.tastingNotes.join(', ') : prev.tastingNotes,
                chineseName: prev.chineseName || data.chineseName || '',
                originRegion: prev.originRegion || data.originRegion || '',
                processingNotes: prev.processingNotes || data.processingNotes || '',
                mood: prev.mood || data.mood || '',
                experience: prev.experience || data.experience || '',
                liquorColor: prev.liquorColor || data.liquorColor || '',
                isCustomWisdom: false, // It's AI generated now
                showWisdom: true
            }));
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
            mood: formData.mood,
            experience: formData.experience,
            liquor_color: formData.liquorColor
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
  const inputStyle = "w-full bg-transparent border-b border-tea-border rounded-none px-0 py-2 text-base font-sans text-tea-text outline-none focus:border-tea-accent transition-colors placeholder-tea-muted/30";
  const labelStyle = "block text-[10px] uppercase tracking-wider text-tea-muted/70 mb-1.5 flex items-center gap-1 font-bold";

  return (
    <div 
        className="fixed inset-0 z-[100] flex items-center justify-center bg-tea-bg/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
        onClick={onClose}
    >
      <div 
        className="bg-tea-surface border border-tea-border w-full max-w-7xl h-[90vh] flex flex-col shadow-2xl rounded-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-6 border-b border-tea-border flex justify-between items-center bg-tea-bg/50 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-tea-surface border border-tea-border rounded-full">
              <Edit className="text-tea-accent" size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-serif text-tea-text tracking-wide">{isEditMode ? 'EDIT ITEM' : 'NEW ITEM'}</h2>
              <p className="text-[10px] text-tea-muted font-mono uppercase tracking-[0.2em]">Database Access</p>
            </div>
          </div>
          <button onClick={onClose} className="text-tea-muted hover:text-tea-text transition-colors p-2 hover:bg-tea-bg rounded-full">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 custom-scrollbar">
          
          {/* --- COLUMN 1: IDENTIFICATION (4/12) --- */}
          <div className="lg:col-span-4 p-6 lg:p-8 space-y-8 border-b lg:border-b-0 lg:border-r border-tea-border">
            
            {/* GROUP 1: CLASSIFICATION (Horizontal) */}
            <div className="grid grid-cols-3 gap-4">
               <div className="group">
                  <label className={labelStyle}>
                      <Layers size={10} /> Type *
                  </label>
                  <select 
                    name="type" 
                    value={formData.type} 
                    onChange={handleChange}
                    className="w-full bg-transparent border-b border-tea-border rounded-none px-0 py-2 text-sm text-tea-text outline-none focus:border-tea-accent transition-colors cursor-pointer font-sans"
                  >
                    {['Green', 'White', 'Yellow', 'Oolong', 'Red', 'Dark', 'Sheng', 'Shou', 'Herbal', 'Matcha', 'Flower', 'Teaware', 'Misc'].map(t => <option key={t} value={t} className="bg-tea-surface">{t}</option>)}
                  </select>
               </div>
               <div className="group">
                  <label className={labelStyle}>
                       Year
                  </label>
                  <input 
                    name="year" 
                    type="number"
                    value={formData.year} 
                    onChange={handleChange}
                    className={inputStyle.replace('text-lg', 'text-base')}
                    placeholder="YYYY"
                  />
               </div>
               <div className="group">
                  <label className={labelStyle}>
                      Status
                  </label>
                    <select 
                    name="status" 
                    value={formData.status} 
                    onChange={handleChange}
                    className={`w-full border-b px-0 py-2 outline-none text-sm font-bold bg-transparent cursor-pointer font-sans ${
                        formData.status === 'Draft' ? 'text-tea-muted/80 border-tea-muted/30' : 
                        formData.status === 'Sold Out' ? 'text-tea-muted/80 border-tea-muted/30' :
                        'text-tea-accent border-tea-accent/50'
                    }`}
                  >
                    <option value="Active" className="bg-tea-surface">Active</option>
                    <option value="Draft" className="bg-tea-surface">Draft</option>
                    <option value="Sold Out" className="bg-tea-surface">Sold Out</option>
                </select>
               </div>
            </div>

            {/* GROUP 2: NOMENCLATURE */}
            <div className="space-y-4 pt-2">
                <div className="group">
                    <label className={labelStyle}>
                        <Tag size={10} /> Product Name / Cultivar *
                    </label>
                    <input 
                        name="productName" 
                        required
                        value={formData.productName} 
                        onChange={handleChange}
                        onBlur={handleProductNameBlur}
                        className={inputStyle}
                        placeholder="e.g. Alishan High Mountain"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="group">
                        <label className={labelStyle}>Given Name (Marketing)</label>
                        <input 
                            name="givenName" 
                            value={formData.givenName} 
                            onChange={handleChange}
                            className={inputStyle.replace('text-lg', 'text-base')}
                            placeholder="e.g. Mist Walker"
                        />
                    </div>
                    <div className="group">
                        <label className={labelStyle}>Chinese Name</label>
                        <input 
                            name="chineseName" 
                            value={formData.chineseName} 
                            onChange={handleChange}
                            className={inputStyle.replace('text-lg', 'text-base')}
                            placeholder="e.g. 阿里山"
                        />
                    </div>
                </div>
            </div>

            {/* GROUP 3: PROVENANCE */}
            <div className="grid grid-cols-2 gap-4 pt-2">
                 <div className="group">
                    <label className={labelStyle}>
                        <Globe size={10} /> Origin Region
                    </label>
                    <input 
                        name="originRegion"
                        value={formData.originRegion}
                        onChange={handleChange}
                        className={inputStyle.replace('text-lg', 'text-base')}
                        placeholder="e.g. Nantou, Taiwan"
                    />
                 </div>
                 <div className="group">
                    <label className={labelStyle}>
                        Vendor
                    </label>
                    <input 
                        name="vendor" 
                        value={formData.vendor} 
                        onChange={handleChange}
                        className={inputStyle.replace('text-lg', 'text-base')}
                        placeholder="e.g. Chen Family"
                    />
                 </div>
            </div>
          </div>

          {/* --- COLUMN 2: DETAILS & LORE (4/12) --- */}
          <div className="lg:col-span-4 p-6 lg:p-8 space-y-6 border-b lg:border-b-0 lg:border-r border-tea-border">
             {/* GROUP 4: SETTINGS & NOTES */}
             <div className="flex flex-wrap gap-2">
                    <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none transition-all text-[10px] uppercase tracking-[0.2em] font-bold ${formData.isPersonal ? 'bg-tea-accent/10 text-tea-accent border-tea-accent/30' : 'bg-tea-bg text-tea-muted border-tea-border hover:border-tea-muted/50'}`}>
                        <input type="checkbox" name="isPersonal" checked={formData.isPersonal} onChange={handleChange} className="hidden" />
                        <UserCheck size={14} /> Personal
                    </label>
                    <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none transition-all text-[10px] uppercase tracking-[0.2em] font-bold ${formData.canReorder ? 'bg-[#859F85]/10 text-[#859F85] border-[#859F85]/30' : 'bg-tea-bg text-tea-muted border-tea-border hover:border-tea-muted/50'}`}>
                        <input type="checkbox" name="canReorder" checked={formData.canReorder} onChange={handleChange} className="hidden" />
                        <RefreshCw size={14} /> Restockable
                    </label>
                    <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none transition-all text-[10px] uppercase tracking-[0.2em] font-bold ${formData.isPublic ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-tea-bg text-tea-muted border-tea-border hover:border-tea-muted/50'}`}>
                        <input type="checkbox" name="isPublic" checked={formData.isPublic} onChange={handleChange} className="hidden" />
                        <Globe size={14} /> Public
                    </label>
                    <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none transition-all text-[10px] uppercase tracking-[0.2em] font-bold ${formData.isFeatured ? 'bg-tea-accent/10 text-tea-accent border-tea-accent/30' : 'bg-tea-bg text-tea-muted border-tea-border hover:border-tea-muted/50'}`}>
                        <input type="checkbox" name="isFeatured" checked={formData.isFeatured} onChange={handleChange} className="hidden" />
                        <Star size={14} /> Featured
                    </label>
                 </div>
                 
                 {/* ASSETS SECTION (Image Upload) */}
                 <div className="group pt-2">
                    <label className={labelStyle}>
                        <ImageIcon size={10} /> Photo (Cloudflare R2)
                    </label>
                    
                    {!formData.imageUrl ? (
                        <div className="relative mt-2">
                            <input 
                                ref={fileInputRef}
                                type="file" 
                                accept="image/*"
                                onChange={handleFileUpload}
                                className="hidden" 
                                id="img-upload"
                            />
                            <label 
                                htmlFor="img-upload"
                                className={`flex items-center justify-center gap-3 w-full border border-dashed border-tea-border rounded-lg p-6 cursor-pointer hover:bg-tea-bg hover:border-tea-muted transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                {uploading ? (
                                    <Loader2 className="animate-spin text-tea-accent" size={20} />
                                ) : (
                                    <Upload className="text-tea-muted" size={20} />
                                )}
                                <span className="text-sm text-tea-muted font-mono">
                                    {uploading ? 'Uploading...' : 'Click to Upload Image'}
                                </span>
                            </label>
                        </div>
                    ) : (
                        <div className="flex items-start gap-4 p-3 bg-tea-bg/50 border border-tea-border rounded-lg group hover:border-tea-muted/50 transition-colors mt-2">
                            <div className="w-16 h-16 rounded overflow-hidden bg-tea-bg border border-tea-border shrink-0">
                                <ImageThumbnail src={formData.imageUrl} type={formData.type} />
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-xs text-tea-muted font-mono truncate mb-1">{formData.imageUrl}</p>
                                <span className="text-[10px] text-tea-accent uppercase tracking-wider font-bold bg-tea-accent/10 px-1.5 py-0.5 rounded">Uploaded</span>
                            </div>
                            <button 
                                type="button"
                                onClick={handleRemoveImage}
                                className="p-2 text-tea-muted hover:text-tea-accent hover:bg-tea-bg rounded transition-colors"
                                title="Remove Image"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    )}
                 </div>

                 <div className="group">
                    <label className={labelStyle}>
                        <FileText size={10} /> Private Admin Notes / Description
                    </label>
                    <textarea 
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        rows={2}
                        className="w-full bg-transparent border-b border-tea-border rounded-none p-2 text-sm text-tea-text outline-none focus:border-tea-accent placeholder-tea-muted/30 transition-colors resize-none font-sans"
                        placeholder="Private notes (e.g. Bought from Mr. Chen's son, needs 6 months rest)..."
                    />
                 </div>

                 {/* WISDOM & LORE SECTION */}
                 <div className="pt-4 border-t border-dashed border-tea-border space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Star size={14} className="text-tea-accent" />
                            <span className="text-xs font-serif italic text-tea-muted">Wisdom & Lore</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={handleGenerateWisdom}
                                disabled={generatingWisdom || !formData.productName}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-tea-accent/10 text-tea-accent hover:bg-tea-accent/20 rounded text-[10px] uppercase tracking-wider font-bold transition-colors disabled:opacity-50"
                            >
                                {generatingWisdom ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                Generate with AI
                            </button>
                            <label className="flex items-center gap-2 cursor-pointer group/toggle">
                                <div className="relative">
                                    <input 
                                        type="checkbox" 
                                        name="showWisdom" 
                                        checked={formData.showWisdom} 
                                        onChange={handleChange}
                                        className="sr-only" 
                                    />
                                    <div className={`block w-8 h-4 rounded-full transition-colors ${formData.showWisdom ? 'bg-tea-accent/30' : 'bg-tea-border'}`}></div>
                                    <div className={`absolute left-1 top-1 bg-tea-text w-2 h-2 rounded-full transition-transform ${formData.showWisdom ? 'translate-x-4 bg-tea-accent' : ''}`}></div>
                                </div>
                                <span className="text-[10px] uppercase tracking-wider text-tea-muted group-hover/toggle:text-tea-text transition-colors">
                                    Show Publicly
                                </span>
                            </label>
                        </div>
                    </div>

                    <div className="group">
                        <div className="flex justify-between items-center mb-1">
                            <label className={labelStyle}>
                                Lore (History & Terroir)
                            </label>
                            {formData.isCustomWisdom ? (
                                <span className="text-[9px] text-tea-accent uppercase tracking-wider flex items-center gap-1">
                                    <Edit size={10} /> Handcrafted
                                </span>
                            ) : formData.lore ? (
                                <span className="text-[9px] text-tea-muted uppercase tracking-wider flex items-center gap-1">
                                    <Star size={10} /> AI Generated
                                </span>
                            ) : null}
                        </div>
                        <textarea 
                            name="lore"
                            value={formData.lore}
                            onChange={(e) => {
                                handleChange(e);
                                setFormData(prev => ({ ...prev, isCustomWisdom: true }));
                            }}
                            rows={4}
                            className="w-full bg-transparent border-b border-tea-border rounded-none p-2 text-sm text-tea-text outline-none focus:border-tea-accent placeholder-tea-muted/30 transition-colors resize-none font-sans"
                            placeholder="Legend says these bushes were draped in imperial red robes..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="group">
                            <label className={labelStyle}>
                                Mood
                            </label>
                            <input 
                                name="mood"
                                type="text"
                                value={formData.mood}
                                onChange={(e) => {
                                    handleChange(e);
                                    setFormData(prev => ({ ...prev, isCustomWisdom: true }));
                                }}
                                className="w-full bg-transparent border-b border-tea-border rounded-none p-2 text-sm text-tea-text outline-none focus:border-tea-accent placeholder-tea-muted/30 transition-colors font-sans"
                                placeholder="Grounding & Meditative"
                            />
                        </div>
                        <div className="group">
                            <label className={labelStyle}>
                                Liquor Color
                            </label>
                            <input 
                                name="liquorColor"
                                type="text"
                                value={formData.liquorColor}
                                onChange={(e) => {
                                    handleChange(e);
                                    setFormData(prev => ({ ...prev, isCustomWisdom: true }));
                                }}
                                className="w-full bg-transparent border-b border-tea-border rounded-none p-2 text-sm text-tea-text outline-none focus:border-tea-accent placeholder-tea-muted/30 transition-colors font-sans"
                                placeholder="Deep Amber"
                            />
                        </div>
                    </div>

                    <div className="group">
                        <label className={labelStyle}>
                            Experience Description
                        </label>
                        <textarea 
                            name="experience"
                            value={formData.experience}
                            onChange={(e) => {
                                handleChange(e);
                                setFormData(prev => ({ ...prev, isCustomWisdom: true }));
                            }}
                            rows={2}
                            className="w-full bg-transparent border-b border-tea-border rounded-none p-2 text-sm text-tea-text outline-none focus:border-tea-accent placeholder-tea-muted/30 transition-colors resize-none font-sans"
                            placeholder="A deeply centering tea. The heavy roast anchors the body..."
                        />
                    </div>

                    <div className="group">
                        <label className={labelStyle}>
                            Processing / Craft Notes
                        </label>
                        <input 
                            name="processingNotes"
                            type="text"
                            value={formData.processingNotes}
                            onChange={(e) => {
                                handleChange(e);
                                setFormData(prev => ({ ...prev, isCustomWisdom: true }));
                            }}
                            className="w-full bg-transparent border-b border-tea-border rounded-none p-2 text-sm text-tea-text outline-none focus:border-tea-accent placeholder-tea-muted/30 transition-colors font-sans"
                            placeholder="Heavy charcoal roast over pine wood."
                        />
                    </div>

                    <div className="group">
                        <label className={labelStyle}>
                            Tasting Notes (Comma separated)
                        </label>
                        <textarea 
                            name="tastingNotes"
                            value={formData.tastingNotes}
                            onChange={(e) => {
                                handleChange(e);
                                setFormData(prev => ({ ...prev, isCustomWisdom: true }));
                            }}
                            rows={2}
                            className="w-full bg-transparent border-b border-tea-border rounded-none p-2 text-sm text-tea-text outline-none focus:border-tea-accent placeholder-tea-muted/30 transition-colors resize-none font-sans"
                            placeholder="Pine resin, dried longan, campfire"
                        />
                    </div>
                 </div>
          </div>

          {/* --- COLUMN 3: THE RECEIPT (4/12) --- */}
          <div className="lg:col-span-4 bg-tea-surface p-6 lg:p-8 space-y-6 flex flex-col h-full relative">
             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-b from-tea-bg/20 to-transparent"></div>
            
            <div className="flex items-center gap-2 mb-4">
              <Calculator size={14} className="text-tea-muted" />
              <span className="text-xs font-serif italic text-tea-muted">Cost Calculation</span>
            </div>

            {/* RECEIPT PAPER EFFECT */}
            <div className="bg-tea-bg p-6 rounded-xl border border-tea-border shadow-inner space-y-6 font-mono text-sm">
               
               {/* INPUTS SECTION */}
               <div className="space-y-5 border-b border-dashed border-tea-border pb-6">
                    <div className="flex justify-between items-center">
                        <label className="text-tea-muted uppercase text-[10px] tracking-[0.2em]">Batch Cost</label>
                        <div className="flex items-center gap-2 border-b border-tea-border hover:border-tea-muted transition-colors">
                            <select 
                                name="costCurrency" value={formData.costCurrency} onChange={handleChange}
                                className="bg-transparent text-[10px] text-tea-accent font-bold outline-none cursor-pointer uppercase"
                            >
                                <option value="USD" className="bg-tea-surface">USD</option>
                                <option value="NT" className="bg-tea-surface">NT</option>
                                <option value="Yuan" className="bg-tea-surface">CNY</option>
                                <option value="IDR" className="bg-tea-surface">IDR</option>
                                <option value="JPY" className="bg-tea-surface">JPY</option>
                                <option value="MYR" className="bg-tea-surface">MYR</option>
                            </select>
                            <input 
                                name="costAmount" 
                                type="number" step="0.01" value={formData.costAmount} onChange={handleChange}
                                className="w-20 bg-transparent text-right text-tea-text outline-none placeholder-tea-muted/30 tabular-nums" 
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center">
                        <label className="text-tea-muted uppercase text-[10px] tracking-[0.2em]">Weight (g)</label>
                        <input 
                            name="quantityPurchased" type="number" value={formData.quantityPurchased} onChange={handleChange}
                            className="w-20 bg-transparent text-right text-tea-text border-b border-tea-border hover:border-tea-muted outline-none placeholder-tea-muted/30 transition-colors tabular-nums" 
                            placeholder="0"
                        />
                    </div>

                    <div className="flex justify-between items-center">
                        <label className="text-tea-muted uppercase text-[10px] tracking-[0.2em]">Ship (USD/kg)</label>
                        <input 
                            name="shippingRateUSD" type="number" step="0.01" value={formData.shippingRateUSD} onChange={handleChange}
                            className="w-20 bg-transparent text-right text-tea-text border-b border-tea-border hover:border-tea-muted outline-none placeholder-tea-muted/30 transition-colors tabular-nums" 
                            placeholder="10.00"
                        />
                    </div>
               </div>

               {/* CALCULATED SECTION */}
               <div className="space-y-3">
                    <div className="flex justify-between text-tea-muted text-xs">
                         <span>Source Cost/g</span>
                         <span className="tabular-nums">{calc.costPerGramSource.toFixed(3)} {formData.costCurrency}</span>
                    </div>
                    <div className="flex justify-between text-tea-muted text-xs">
                         <span>Exchange Rate</span>
                         <span className="tabular-nums">{calc.rateUsed}</span>
                    </div>
                    <div className="flex justify-between text-tea-text text-xs pt-2">
                         <span>True Cost (USD)</span>
                         <span className="tabular-nums text-tea-accent font-bold">${calc.trueCostUSD.toFixed(3)}/g</span>
                    </div>
               </div>

               {/* OUTPUT SECTION */}
               <div className="pt-5 border-t border-dashed border-tea-border">
                  <div className="flex justify-between items-center mb-2">
                     <label className="text-[10px] uppercase tracking-[0.2em] text-tea-accent font-bold">Retail (USD/g)</label>
                     <span className="text-[9px] text-tea-muted/70">3x Markup: ${calc.suggestedRetailUSD.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-tea-surface border border-tea-border rounded-lg px-4 py-3">
                     <span className="text-lg text-tea-muted font-serif">$</span>
                     <input 
                        name="fixedRetailPriceUSD" 
                        type="number" 
                        step="0.01" 
                        value={formData.fixedRetailPriceUSD} 
                        onChange={handleChange}
                        onFocus={(e) => {
                            if (!formData.fixedRetailPriceUSD && calc.suggestedRetailUSD > 0) {
                                setFormData({ ...formData, fixedRetailPriceUSD: calc.suggestedRetailUSD.toFixed(2) });
                            }
                        }}
                        className={`flex-1 bg-transparent text-xl font-mono outline-none text-right tabular-nums ${
                            formData.fixedRetailPriceUSD && parseFloat(formData.fixedRetailPriceUSD) < calc.trueCostUSD 
                            ? 'text-tea-accent font-bold' 
                            : 'text-tea-text'
                        }`}
                        placeholder={calc.suggestedRetailUSD.toFixed(2)}
                     />
                  </div>
               </div>

               <div className="pt-3">
                    <div className="flex justify-between items-center">
                        <label className="text-tea-muted uppercase text-[10px] tracking-[0.2em]">Current Stock</label>
                        <input 
                            name="stockGrams" type="number" value={formData.stockGrams} onChange={handleChange}
                            className="w-20 bg-transparent text-right text-tea-text border-b border-tea-border hover:border-tea-muted outline-none placeholder-tea-muted/30 transition-colors tabular-nums" 
                            placeholder="0"
                        />
                    </div>
               </div>
            </div>
            
            <div className="flex-1"></div>

            <div className="flex gap-4">
                <button onClick={onClose} className="flex-1 py-4 text-xs font-medium text-tea-muted hover:text-tea-text transition-colors uppercase tracking-[0.2em] border border-transparent hover:border-tea-border rounded-lg">
                    Cancel
                </button>
                <button 
                    onClick={handleSubmit} 
                    disabled={loading || !formData.productName || uploading}
                    className="flex-1 py-4 bg-tea-accent text-tea-bg text-xs font-bold uppercase tracking-[0.2em] hover:bg-tea-accent/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 rounded-lg shadow-lg shadow-tea-accent/10"
                >
                    {loading || uploading ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                    <span>Save Item</span>
                </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};