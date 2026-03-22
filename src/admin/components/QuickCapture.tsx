import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Camera, Upload, Loader2, Check, X, ChevronRight, FileSpreadsheet, PlusCircle, Image as ImageIcon, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../lib/api';
import type { Product, ProductType, Currency, TeaForm } from '../types';
import { InventoryView } from './InventoryView';

interface ExtractedProduct {
  givenName?: string;
  chineseName?: string;
  productName?: string;
  type?: ProductType;
  form?: TeaForm;
  year?: number;
  originCountry?: string;
  originRegion?: string;
  vendor?: string;
  costAmount?: number;
  costCurrency?: Currency;
  quantityPurchased?: number;
  description?: string;
  notes?: string;
  imageUrl?: string;
}

interface CaptureItem {
  id: string;
  file: File;
  preview: string;
  status: 'extracting' | 'review' | 'saving' | 'saved' | 'error';
  extracted: ExtractedProduct;
  error?: string;
}

interface QuickCaptureProps {
  products: Product[];
  isLoading: boolean;
  onDraftCreated: () => void;
  onImportClick: () => void;
  onAddClick: () => void;
  rates?: any;
}

const TEA_TYPES: ProductType[] = ['Green', 'Yellow', 'White', 'Oolong', 'Red', 'Dark', 'Sheng', 'Shou', 'Herbal', 'Matcha', 'Flower', 'Teaware', 'Misc'];
const CURRENCIES: Currency[] = ['USD', 'NT', 'Yuan', 'IDR', 'JPY', 'MYR', 'HKD', 'UNK'];

export const QuickCapture: React.FC<QuickCaptureProps> = ({
  products, isLoading, onDraftCreated, onImportClick, onAddClick,
}) => {
  const [items, setItems] = useState<CaptureItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [activeQueue, setActiveQueue] = useState<'review' | 'approve'>('review');
  const [approving, setApproving] = useState(false);

  // Split drafts into two stages
  const draftProducts = useMemo(() => products.filter(p => p.status === 'Draft'), [products]);

  // "Ready to approve" = has a real name, a valid type, cost > 0, and stock/quantity > 0
  const isReadyToApprove = useCallback((p: Product) => {
    const hasName = p.givenName && p.givenName !== 'Unnamed Tea' && p.givenName.trim().length > 0;
    const hasType = p.type && p.type !== 'Misc' && p.type !== 'MISSING_TYPE';
    const hasCost = p.costAmount > 0;
    const hasStock = p.stockGrams > 0 || (p.quantityUnits !== undefined && p.quantityUnits > 0);
    return hasName && hasType && hasCost && hasStock;
  }, []);

  const toReview = useMemo(() => draftProducts.filter(p => !isReadyToApprove(p)), [draftProducts, isReadyToApprove]);
  const readyToApprove = useMemo(() => draftProducts.filter(p => isReadyToApprove(p)), [draftProducts, isReadyToApprove]);

  const bulkApprove = async () => {
    if (readyToApprove.length === 0) return;
    setApproving(true);
    try {
      for (const product of readyToApprove) {
        await api.products.update(product.id, { status: 'Active' });
      }
      onDraftCreated();
    } catch (err) {
      console.error('Bulk approve failed:', err);
    } finally {
      setApproving(false);
    }
  };

  const processFile = useCallback(async (file: File) => {
    const id = crypto.randomUUID();
    const preview = URL.createObjectURL(file);

    const item: CaptureItem = {
      id,
      file,
      preview,
      status: 'extracting',
      extracted: {},
    };

    setItems(prev => [item, ...prev]);
    setExpandedId(id);

    try {
      const extracted = await api.extractFromImage(file);
      setItems(prev =>
        prev.map(i => i.id === id ? { ...i, status: 'review', extracted } : i)
      );
    } catch (err: any) {
      setItems(prev =>
        prev.map(i => i.id === id ? { ...i, status: 'error', error: err.message || 'Extraction failed' } : i)
      );
    }
  }, []);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(processFile);
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const updateExtracted = (id: string, field: string, value: any) => {
    setItems(prev =>
      prev.map(i => i.id === id ? { ...i, extracted: { ...i.extracted, [field]: value } } : i)
    );
  };

  const saveDraft = async (item: CaptureItem) => {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'saving' } : i));

    try {
      const e = item.extracted;
      await api.products.create({
        type: e.type || 'Misc',
        given_name: e.givenName || 'Unnamed Tea',
        chinese_name: e.chineseName || '',
        product_name: e.productName || '',
        year: e.year || null,
        origin_country: e.originCountry || '',
        origin_region: e.originRegion || '',
        vendor: e.vendor || '',
        cost_amount: e.costAmount || 0,
        cost_currency: e.costCurrency || 'UNK',
        quantity_purchased: e.quantityPurchased || 0,
        stock_grams: e.quantityPurchased || 0,
        description: e.description || '',
        image_url: e.imageUrl || '',
        status: 'Draft',
        is_personal: false,
        can_reorder: false,
        is_public: false,
        tasting_notes: [],
      });

      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'saved' } : i));
      onDraftCreated();
    } catch (err: any) {
      setItems(prev =>
        prev.map(i => i.id === item.id ? { ...i, status: 'error', error: err.message || 'Save failed' } : i)
      );
    }
  };

  const saveAllReviewed = async () => {
    const reviewItems = items.filter(i => i.status === 'review');
    for (const item of reviewItems) {
      await saveDraft(item);
    }
  };

  const removeItem = (id: string) => {
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter(i => i.id !== id);
    });
    if (expandedId === id) setExpandedId(null);
  };

  const reviewCount = items.filter(i => i.status === 'review').length;
  const savedCount = items.filter(i => i.status === 'saved').length;
  const extractingCount = items.filter(i => i.status === 'extracting').length;

  return (
    <div className="h-full flex flex-col">
      {/* ── Intake Section (collapsible) ── */}
      <div className="border-b border-tea-border">
        <button
          onClick={() => setIntakeOpen(!intakeOpen)}
          className="w-full flex items-center justify-between px-4 md:px-6 py-3 hover:bg-tea-elevated/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <h2 className="text-base font-serif text-tea-text">Intake</h2>
            {items.length > 0 && (
              <span className="text-xs text-tea-text-sec">
                {extractingCount > 0 && `${extractingCount} processing`}
                {reviewCount > 0 && `${reviewCount} ready`}
                {savedCount > 0 && ` · ${savedCount} saved`}
              </span>
            )}
          </div>
          <ChevronRight size={16} className={`text-tea-text-sec transition-transform ${intakeOpen ? 'rotate-90' : ''}`} />
        </button>

        <AnimatePresence>
          {intakeOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 md:px-6 pb-4 space-y-4">
                {/* Intake Method Buttons */}
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-tea-surface/50 hover:bg-tea-surface transition-colors group"
                    style={{ boxShadow: '0 1px 3px var(--tea-accent-sub)' }}
                  >
                    <div className="w-10 h-10 rounded-full bg-tea-gold/10 flex items-center justify-center group-hover:bg-tea-gold/20 transition-colors">
                      <Camera className="w-5 h-5 text-tea-gold" />
                    </div>
                    <span className="text-xs font-medium text-tea-text-sec">Photo</span>
                  </button>

                  <button
                    onClick={onImportClick}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-tea-surface/50 hover:bg-tea-surface transition-colors group"
                    style={{ boxShadow: '0 1px 3px var(--tea-accent-sub)' }}
                  >
                    <div className="w-10 h-10 rounded-full bg-tea-gold/10 flex items-center justify-center group-hover:bg-tea-gold/20 transition-colors">
                      <FileSpreadsheet className="w-5 h-5 text-tea-gold" />
                    </div>
                    <span className="text-xs font-medium text-tea-text-sec">CSV</span>
                  </button>

                  <button
                    onClick={onAddClick}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-tea-surface/50 hover:bg-tea-surface transition-colors group"
                    style={{ boxShadow: '0 1px 3px var(--tea-accent-sub)' }}
                  >
                    <div className="w-10 h-10 rounded-full bg-tea-gold/10 flex items-center justify-center group-hover:bg-tea-gold/20 transition-colors">
                      <PlusCircle className="w-5 h-5 text-tea-gold" />
                    </div>
                    <span className="text-xs font-medium text-tea-text-sec">Manual</span>
                  </button>
                </div>

                {/* Drop zone for images */}
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-tea-bg/50 border border-dashed border-tea-border p-4 text-center cursor-pointer transition-colors hover:border-tea-gold/40 hover:bg-tea-bg/80"
                >
                  <div className="flex items-center justify-center gap-2 text-xs text-tea-text-dim">
                    <Upload size={14} />
                    Drop images here or click to upload multiple
                  </div>
                </div>

                {/* Hidden inputs */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
                  multiple
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
                  multiple
                />

                {/* Batch Actions */}
                {reviewCount > 0 && (
                  <div className="flex items-center justify-between bg-tea-surface rounded-lg px-4 py-2.5">
                    <span className="text-xs text-tea-text-sec">
                      {reviewCount} ready to save{savedCount > 0 && `, ${savedCount} saved`}
                    </span>
                    <button
                      onClick={saveAllReviewed}
                      className="pill-active text-xs px-3 py-1.5 flex items-center gap-1.5"
                    >
                      <Check size={12} />
                      Save All as Drafts
                    </button>
                  </div>
                )}

                {/* Extracting indicator */}
                {extractingCount > 0 && (
                  <div className="flex items-center gap-2 text-xs text-tea-text-sec px-1">
                    <Loader2 size={12} className="animate-spin" />
                    Extracting {extractingCount} image{extractingCount > 1 ? 's' : ''}...
                  </div>
                )}

                {/* Capture Items */}
                <AnimatePresence mode="popLayout">
                  {items.map(item => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`rounded-lg bg-tea-surface overflow-hidden ${
                        item.status === 'saved' ? 'opacity-50' : ''
                      }`}
                      style={{ boxShadow: '0 1px 3px var(--tea-accent-sub)' }}
                    >
                      {/* Card Header */}
                      <button
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-tea-elevated/30 transition-colors"
                      >
                        <div className="w-11 h-11 rounded-md overflow-hidden bg-tea-bg flex-shrink-0">
                          <img src={item.preview} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {item.status === 'extracting' && <Loader2 size={12} className="animate-spin text-tea-gold flex-shrink-0" />}
                            {item.status === 'saved' && <Check size={12} className="text-green-500 flex-shrink-0" />}
                            {item.status === 'error' && <X size={12} className="text-red-400 flex-shrink-0" />}
                            <span className="text-sm font-medium text-tea-text truncate">
                              {item.extracted.givenName || item.extracted.productName || (item.status === 'extracting' ? 'Analyzing...' : 'Unknown Tea')}
                            </span>
                          </div>
                          <div className="text-[11px] text-tea-text-sec mt-0.5 truncate">
                            {item.status === 'extracting' && 'Reading label...'}
                            {item.status === 'review' && [item.extracted.type, item.extracted.originCountry, item.extracted.vendor].filter(Boolean).join(' · ')}
                            {item.status === 'saving' && 'Saving draft...'}
                            {item.status === 'saved' && 'Saved as draft'}
                            {item.status === 'error' && (item.error || 'Error')}
                          </div>
                        </div>
                        <ChevronRight size={14} className={`text-tea-text-sec flex-shrink-0 transition-transform ${expandedId === item.id ? 'rotate-90' : ''}`} />
                      </button>

                      {/* Expanded Detail */}
                      <AnimatePresence>
                        {expandedId === item.id && item.status !== 'extracting' && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-3 pb-3 space-y-3 border-t border-tea-border">
                              <div className="grid grid-cols-2 gap-2.5 pt-3">
                                <Field label="Name" value={item.extracted.givenName || ''} onChange={v => updateExtracted(item.id, 'givenName', v)} />
                                <Field label="Chinese" value={item.extracted.chineseName || ''} onChange={v => updateExtracted(item.id, 'chineseName', v)} />
                                <Field label="Cultivar" value={item.extracted.productName || ''} onChange={v => updateExtracted(item.id, 'productName', v)} />
                                <SelectField label="Type" value={item.extracted.type || 'Misc'} options={TEA_TYPES} onChange={v => updateExtracted(item.id, 'type', v)} />
                                <Field label="Country" value={item.extracted.originCountry || ''} onChange={v => updateExtracted(item.id, 'originCountry', v)} />
                                <Field label="Region" value={item.extracted.originRegion || ''} onChange={v => updateExtracted(item.id, 'originRegion', v)} />
                                <Field label="Vendor" value={item.extracted.vendor || ''} onChange={v => updateExtracted(item.id, 'vendor', v)} />
                                <Field label="Year" value={item.extracted.year?.toString() || ''} onChange={v => updateExtracted(item.id, 'year', v ? parseInt(v) : undefined)} type="number" />
                                <Field label="Cost" value={item.extracted.costAmount?.toString() || ''} onChange={v => updateExtracted(item.id, 'costAmount', v ? parseFloat(v) : 0)} type="number" />
                                <SelectField label="Currency" value={item.extracted.costCurrency || 'UNK'} options={CURRENCIES} onChange={v => updateExtracted(item.id, 'costCurrency', v)} />
                                <Field label="Grams" value={item.extracted.quantityPurchased?.toString() || ''} onChange={v => updateExtracted(item.id, 'quantityPurchased', v ? parseFloat(v) : 0)} type="number" />
                              </div>

                              {(item.extracted.description || item.extracted.notes) && (
                                <div className="text-[11px] text-tea-text-sec bg-tea-bg/50 rounded-md p-2.5 space-y-1">
                                  {item.extracted.description && <p>{item.extracted.description}</p>}
                                  {item.extracted.notes && <p className="italic">{item.extracted.notes}</p>}
                                </div>
                              )}

                              <div className="flex items-center gap-2 pt-1">
                                {item.status === 'review' && (
                                  <button onClick={() => saveDraft(item)} className="pill-active text-xs px-3 py-1.5 flex items-center gap-1.5">
                                    <Check size={12} /> Save Draft
                                  </button>
                                )}
                                {item.status === 'error' && (
                                  <button onClick={() => processFile(item.file)} className="pill text-xs px-3 py-1.5">Retry</button>
                                )}
                                <button onClick={() => removeItem(item.id)} className="pill text-xs px-2.5 py-1.5 flex items-center gap-1 ml-auto">
                                  <X size={12} /> Remove
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Draft Queue — Two-stage tabs ── */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Tab Bar */}
        <div className="flex items-center gap-1 px-4 md:px-6 py-2 border-b border-tea-border bg-tea-bg/30">
          <button
            onClick={() => setActiveQueue('review')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] rounded-md whitespace-nowrap transition-colors ${
              activeQueue === 'review'
                ? 'bg-tea-accent/15 text-tea-accent'
                : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-surface'
            }`}
          >
            <AlertTriangle size={11} />
            To Review
            {toReview.length > 0 && (
              <span className="ml-1 min-w-[18px] h-[18px] bg-amber-500/20 text-amber-400 text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                {toReview.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveQueue('approve')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] rounded-md whitespace-nowrap transition-colors ${
              activeQueue === 'approve'
                ? 'bg-tea-accent/15 text-tea-accent'
                : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-surface'
            }`}
          >
            <CheckCircle2 size={11} />
            Ready to Approve
            {readyToApprove.length > 0 && (
              <span className="ml-1 min-w-[18px] h-[18px] bg-green-500/20 text-green-400 text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                {readyToApprove.length}
              </span>
            )}
          </button>

          {/* Bulk approve button */}
          {activeQueue === 'approve' && readyToApprove.length > 0 && (
            <button
              onClick={bulkApprove}
              disabled={approving}
              className="ml-auto pill-active text-[10px] px-3 py-1.5 flex items-center gap-1.5"
            >
              {approving ? (
                <><Loader2 size={11} className="animate-spin" /> Approving...</>
              ) : (
                <><ArrowRight size={11} /> Activate All ({readyToApprove.length})</>
              )}
            </button>
          )}
        </div>

        {/* Queue Content */}
        {activeQueue === 'review' ? (
          toReview.length === 0 && !isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center py-12 text-tea-text-dim">
                <Check size={36} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">Nothing to review.</p>
                <p className="text-xs mt-1">
                  {readyToApprove.length > 0
                    ? `${readyToApprove.length} item${readyToApprove.length !== 1 ? 's' : ''} ready to approve.`
                    : 'Capture photos or import a CSV above to get started.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <InventoryView
                products={toReview}
                isLoading={isLoading}
                onImportClick={onImportClick}
                onAddClick={onAddClick}
                onRefresh={onDraftCreated}
              />
            </div>
          )
        ) : (
          readyToApprove.length === 0 && !isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center py-12 text-tea-text-dim">
                <ImageIcon size={36} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">No drafts ready to approve yet.</p>
                <p className="text-xs mt-1">
                  {toReview.length > 0
                    ? `${toReview.length} item${toReview.length !== 1 ? 's' : ''} still need review — fill in name, type, cost, and stock.`
                    : 'Import or capture items first.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <InventoryView
                products={readyToApprove}
                isLoading={isLoading}
                onImportClick={onImportClick}
                onAddClick={onAddClick}
                onRefresh={onDraftCreated}
              />
            </div>
          )
        )}
      </div>
    </div>
  );
};

// ── Small helper components ──

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}> = ({ label, value, onChange, type = 'text' }) => (
  <div>
    <label className="text-[10px] uppercase tracking-wider text-tea-text-dim font-sans">{label}</label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full mt-0.5 px-2 py-1.5 text-sm bg-tea-bg rounded-md border border-tea-border text-tea-text focus:outline-none focus:border-tea-gold/50 transition-colors"
    />
  </div>
);

const SelectField: React.FC<{
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div>
    <label className="text-[10px] uppercase tracking-wider text-tea-text-dim font-sans">{label}</label>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full mt-0.5 px-2 py-1.5 text-sm bg-tea-bg rounded-md border border-tea-border text-tea-text focus:outline-none focus:border-tea-gold/50 transition-colors"
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

export default QuickCapture;
