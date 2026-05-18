import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { Upload, X, CheckCircle, Trash2, Loader2, Download, AlertTriangle, FileQuestion, ChevronDown } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from './Toast';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface StagingRow {
  id: string;
  type: string;
  givenName: string;
  chineseName: string;
  productName: string;
  form: string;
  year: string;
  grams: string; // Grams / Quantity Purchased
  costAmount: string; // Raw cost amount
  currency: string; // Raw currency code
  stockAmount: string;
  vendor: string;
  originCountry: string;
  originRegion: string;
  status: string; // 'Active' or 'Draft'
  isPersonal: boolean;
  canReorder: boolean;
  description: string;
  lore: string;
  tastingNotes: string;
  processingNotes: string;
  terroir: string;
  mood: string;
  experience: string;
  material: string;
  capacityMl: string;
  teawareCategory: string;
  quantityUnits: string;
  isValid: boolean;
  errors: string[];
}

// Helper to normalize and find keys
const getSafeValue = (row: any, keys: string[]) => {
  const rowKeys = Object.keys(row);
  for (const key of keys) {
    // 1. Exact match
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
    
    // 2. Normalized match
    const normalize = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');
    const searchKey = normalize(key);
    const foundKey = rowKeys.find(k => normalize(k) === searchKey);
    
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
      return row[foundKey];
    }
  }
  return '';
};

export const CsvImportModal = ({ isOpen, onClose, onComplete }: { isOpen: boolean; onClose: () => void; onComplete: () => void }) => {
  const { showToast } = useToast();
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);
  const [stage, setStage] = useState<'upload' | 'staging' | 'uploading'>('upload');
  const [stagingData, setStagingData] = useState<StagingRow[]>([]);
  const [validationSummary, setValidationSummary] = useState({ valid: 0, drafts: 0 });
  
  // Progress State
  const [uploadProgress, setUploadProgress] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);

  // Mobile expanded card state (only one open at a time)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStage('upload');
      setStagingData([]);
      setUploadProgress(0);
    }
  }, [isOpen]);

  // Helper to check if a value is effectively "missing" based on user requirements
  const isMissingOrUnknown = (val: string) => {
    if (!val) return true;
    const v = val.toString().toLowerCase().trim();
    return v === '' || v === 'unknown' || v === 'nan' || v === 'null' || v === 'undefined';
  };

  const validateRow = (row: StagingRow): { isValid: boolean, status: string, errors: string[] } => {
    const errors = [];
    let status = 'Active';

    // 1. Critical Identity Fields (Must exist to be valid row)
    if (isMissingOrUnknown(row.type)) errors.push('Missing Type');
    if (isMissingOrUnknown(row.productName) && isMissingOrUnknown(row.givenName)) errors.push('Missing Name'); 

    // 2. Draft Logic (Incomplete Data)
    const missingGrams = isMissingOrUnknown(row.grams);
    const missingStock = isMissingOrUnknown(row.stockAmount);
    const missingCost = isMissingOrUnknown(row.costAmount) || isMissingOrUnknown(row.currency);

    if (missingGrams || missingStock || missingCost) {
        status = 'Draft';
    }

    return { isValid: errors.length === 0, status, errors };
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        Type: 'Oolong',
        'Given Name': 'Ali High',
        'Chinese Name': '阿里山',
        'Product Name': 'Alishan High Mountain',
        Year: '2024',
        Grams: '600',
        Stock: '550',
        'Cost Amount': '3000',
        'Cost Currency': 'NT',
        Vendor: 'Chen Family',
        Restockable: 'Yes',
        'Personal Collection': 'No'
      },
      {
        Type: 'Sheng',
        'Given Name': 'Old Ban',
        'Chinese Name': '老班章',
        'Product Name': 'Lao Ban Zhang',
        Year: '2015',
        Grams: '357',
        Stock: 'Unknown', 
        'Cost Amount': '500',
        'Cost Currency': 'RMB',
        Vendor: 'Farmer Li',
        Restockable: '',
        'Personal Collection': 'Yes'
      }
    ];

    const csv = Papa.unparse(templateData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'teajia_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results: any) => {
        const rows = results.data.map((row: any, index: number) => {
          
          const getType = () => getSafeValue(row, ['Type', 'Category']);
          const getGivenName = () => getSafeValue(row, ['Given Name', 'GivenName', 'Title']);
          const getChineseName = () => getSafeValue(row, ['Chinese Name', 'ChineseName', 'Chinese']);
          const getProductName = () => getSafeValue(row, ['Product Name', 'ProductName', 'Name', 'Cultivar']);
          const getYear = () => getSafeValue(row, ['Year', 'Age', 'Harvest Year']);
          
          const getForm = () => getSafeValue(row, ['Form', 'Leaf Form', 'Tea Form', 'Shape', 'Style']);
          const getGrams = () => getSafeValue(row, ['Quantity Purchased', 'Grams', 'Bag Size', 'Weight']);
          const getCostAmount = () => getSafeValue(row, ['Cost Amount', 'Cost', 'Bag Cost', 'Price']);
          const getCurrency = () => getSafeValue(row, ['Cost Currency', 'Currency']);
          
          const getStock = () => getSafeValue(row, ['Stock', 'Stock Amount', 'Current Stock', 'Qty']);
          const getVendor = () => getSafeValue(row, ['Vendor', 'Source', 'Supplier']);
          const getOriginCountry = () => getSafeValue(row, ['Origin Country', 'Country', 'Origin']);
          const getOriginRegion = () => getSafeValue(row, ['Origin Region', 'Region']);

          // Boolean flags
          const getPersonal = () => getSafeValue(row, ['Personal Collection', 'Personal', 'Is Personal']);
          const getRestockable = () => getSafeValue(row, ['Restockable', 'Restock', 'Can Reorder']);

          // Teaware-specific fields
          const getMaterial = () => getSafeValue(row, ['Material', 'Clay', 'Body']);
          const getCapacityMl = () => getSafeValue(row, ['Capacity', 'Capacity ML', 'Volume', 'Capacity (ml)']);
          const getTeawareCategory = () => getSafeValue(row, ['Teaware Category', 'Teaware Type', 'Category']);
          const getQuantityUnits = () => getSafeValue(row, ['Units', 'Quantity Units', 'Pieces', 'Count']);

          // FIX: Strictly return boolean, handle empty strings as false
          const isYes = (val: string) => {
             if (!val) return false;
             return ['yes', 'true', '1', 'y'].includes(val.toString().toLowerCase().trim());
          };

          const newRow: StagingRow = {
            id: `row-${index}`,
            type: (getType() || '').trim(),
            givenName: (getGivenName() || '').trim(),
            chineseName: (getChineseName() || '').trim(),
            productName: (getProductName() || '').trim(),
            form: (getForm() || '').trim(),
            year: (getYear() || '').trim(),
            grams: (getGrams() || '').trim(),
            costAmount: (getCostAmount() || '').trim(),
            currency: (getCurrency() || '').trim(),
            stockAmount: (getStock() || '').trim(),
            vendor: (getVendor() || '').trim(),
            originCountry: (getOriginCountry() || '').trim(),
            originRegion: (getOriginRegion() || '').trim(),
            isPersonal: isYes(getPersonal()),
            canReorder: isYes(getRestockable()),
            description: (getSafeValue(row, ['Description', 'Desc']) || '').trim(),
            lore: (getSafeValue(row, ['Lore', 'Story', 'Stories', 'History', 'Background']) || '').trim(),
            tastingNotes: (getSafeValue(row, ['Tasting Notes', 'TastingNotes', 'Tasting', 'Flavors', 'Flavor Notes']) || '').trim(),
            processingNotes: (getSafeValue(row, ['Processing Notes', 'ProcessingNotes', 'Processing', 'Production Notes']) || '').trim(),
            terroir: (getSafeValue(row, ['Terroir', 'Terrain', 'Environment', 'Growing Conditions']) || '').trim(),
            mood: (getSafeValue(row, ['Mood', 'Feeling']) || '').trim(),
            experience: (getSafeValue(row, ['Experience', 'Feeling Description', 'Works', 'Notes']) || '').trim(),
            material: (getMaterial() || '').trim(),
            capacityMl: (getCapacityMl() || '').trim(),
            teawareCategory: (getTeawareCategory() || '').trim(),
            quantityUnits: (getQuantityUnits() || '').trim(),
            status: 'Active',
            isValid: true,
            errors: []
          };
          
          const validation = validateRow(newRow);
          newRow.isValid = validation.isValid;
          newRow.status = validation.status;
          newRow.errors = validation.errors;
          return newRow;
        });
        setStagingData(rows);
        updateSummary(rows);
        setStage('staging');
      }
    });
  };

  const updateSummary = (rows: StagingRow[]) => {
    const valid = rows.filter(r => r.isValid && r.status === 'Active').length;
    const drafts = rows.filter(r => r.isValid && r.status === 'Draft').length;
    setValidationSummary({ valid, drafts });
  };

  const deleteRow = (id: string) => {
    const newData = stagingData.filter(r => r.id !== id);
    setStagingData(newData);
    updateSummary(newData);
  };

  const handleCommit = async () => {
    setStage('uploading');
    setUploadProgress(0);

    const rowsToInsert = stagingData.filter(r => r.isValid);
    setTotalRecords(rowsToInsert.length);

    if (rowsToInsert.length === 0) {
      showToast("No valid rows to import.", 'error');
      setStage('staging');
      return;
    }

    // Helper: Chunk array into smaller batches
    const chunkArray = (arr: any[], size: number) => {
        return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
            arr.slice(i * size, i * size + size)
        );
    };

    // Sanitize and Prepare Data
    const preparedRows = rowsToInsert.map(r => {
        // 1. Handle Types
        const validTypes = ['Green', 'White', 'Yellow', 'Oolong', 'Red', 'Dark', 'Sheng', 'Shou', 'Herbal', 'Teaware', 'Misc'];
        // Remap retired types to Herbal
        const retiredToHerbal = ['matcha', 'flower'];
        let typeToSave = retiredToHerbal.includes((r.type || '').toLowerCase()) ? 'Herbal' : r.type;
        const matchedType = validTypes.find(t => t.toLowerCase() === (typeToSave || '').toLowerCase());
        if (matchedType) typeToSave = matchedType;
        else if (!typeToSave) typeToSave = 'Misc'; // Default to Misc if missing, logically safer than erroring

        // 2. Handle Numbers (Strip commas, currency symbols)
        const parseNum = (val: string) => {
            if (isMissingOrUnknown(val)) return 0;
            // Remove everything except numbers, dots, and negative signs
            const cleanStr = val.toString().replace(/[^0-9.-]/g, '');
            return parseFloat(cleanStr) || 0;
        };

        const stock = parseNum(r.stockAmount);
        const qtyPurchased = parseNum(r.grams);
        const cost = parseNum(r.costAmount);
        
        // 3. Handle Year (preserve "1980s" style, pass "Unknown" as null)
        let year: string | null = null;
        if (r.year && !isMissingOrUnknown(r.year)) {
             year = r.year.toString().trim();
        }

        // 4. Handle Currency
        let curr = 'UNK';
        if (!isMissingOrUnknown(r.currency)) {
            const c = r.currency.toUpperCase().trim();
            if (['NT', 'TWD'].includes(c)) curr = 'NT';
            else if (['RMB', 'CNY', 'YUAN'].includes(c)) curr = 'Yuan';
            else if (['USD', '$'].includes(c)) curr = 'USD';
            else if (['IDR', 'RP'].includes(c)) curr = 'IDR';
            else if (['JPY', 'YEN'].includes(c)) curr = 'JPY';
            else if (['HKD', 'HK'].includes(c)) curr = 'HKD';
        }

        // Validate form against known values
        const validForms = ['Loose Leaf', 'Cake', 'Tuo', 'Brick', 'Rolled', 'Ball', 'Powder', 'Bag', 'Other'];
        const matchedForm = validForms.find(f => f.toLowerCase() === (r.form || '').toLowerCase());
        const hasWisdom = !!(r.lore || r.tastingNotes || r.mood || r.experience);

        // Build the row object, then strip out null/empty values to avoid
        // sending columns the DB might not have yet
        const row: Record<string, any> = {
          type: typeToSave,
          given_name: r.givenName || null,
          chinese_name: r.chineseName || null,
          product_name: r.productName || r.givenName || 'Unnamed Product',
          form: matchedForm || null,
          year: year,
          origin_country: r.originCountry || 'Unknown',
          origin_region: r.originRegion || null,
          stock_grams: stock,
          quantity_purchased: qtyPurchased,
          cost_amount: cost,
          cost_currency: curr,
          vendor: r.vendor || null,
          description: r.description || null,
          status: r.status,
          is_personal: !!r.isPersonal,
          can_reorder: !!r.canReorder,
          lore: r.lore || null,
          tasting_notes: r.tastingNotes ? r.tastingNotes.split(',').map((s: string) => s.trim()).filter(Boolean) : null,
          processing_notes: r.processingNotes || null,
          terroir: r.terroir || null,
          mood: r.mood || null,
          experience: r.experience || null,
          is_custom_wisdom: false,
          show_wisdom: hasWisdom,
          material: r.material || null,
          capacity_ml: parseNum(r.capacityMl) || null,
          teaware_category: r.teawareCategory || null,
          quantity_units: parseNum(r.quantityUnits) || null,
        };

        // Remove null/empty entries so the API only sends columns with real data
        const cleaned: Record<string, any> = {};
        for (const [k, v] of Object.entries(row)) {
          if (v !== null && v !== undefined && v !== '') cleaned[k] = v;
        }
        return cleaned;
    });

    // Batch Insert
    const BATCH_SIZE = 50;
    const batches = chunkArray(preparedRows, BATCH_SIZE);
    let processedCount = 0;

    try {
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            await api.products.bulkCreate(batch);

            processedCount += batch.length;
            setUploadProgress(processedCount);
        }

        // Success
        onComplete();
        onClose();

    } catch (error: any) {
        showToast(`Import stopped: ${error.message}`, 'error');
        setStage('staging');
    }
  };

  if (!isOpen) return null;

  const stepNumber = stage === 'upload' ? 1 : stage === 'staging' ? 2 : 3;
  const stepLabel = stage === 'upload' ? 'Upload' : stage === 'staging' ? 'Review' : 'Import';

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <button type="button" aria-hidden onClick={onClose} className="absolute inset-0 bg-tea-bg/70 backdrop-blur-[2px]" />
      <div ref={focusTrapRef} role="dialog" aria-modal="true" aria-label="CSV import" className="relative bg-tea-surface border border-tea-border rounded-xl shadow-2xl w-full max-w-7xl h-[85vh] flex flex-col">
        <div className="px-5 pt-5 pb-3 border-b border-tea-border flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="label-caps text-tea-text-dim mb-1">Step {stepNumber} of 3 · {stepLabel}</p>
            <h3 className="h3 text-tea-text">Import Inventory</h3>
            <p className="text-ui-13 text-tea-text-sec mt-1">
              {stage === 'upload' && 'Select your CSV file.'}
              {stage === 'staging' && 'Review data before importing.'}
              {stage === 'uploading' && `Importing ${uploadProgress} of ${totalRecords} records…`}
            </p>
          </div>
          {stage !== 'uploading' && (
            <button onClick={onClose} className="text-tea-text-sec hover:text-tea-text transition-colors rounded-md p-1.5 tap-target shrink-0" aria-label="Close">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-hidden p-6 relative">
          {stage === 'upload' && (
            <div className="h-full flex flex-col items-center justify-center gap-6">
              <div className="w-full max-w-md border-2 border-dashed border-tea-border rounded-xl hover:border-tea-text-sec transition-colors p-10 flex flex-col items-center bg-tea-bg">
                <Upload size={48} className="text-tea-text-sec mb-4" strokeWidth={1.25} />
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors shadow-lg shadow-tea-gold/10">
                  Select CSV File
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                </label>
                <p className="mt-4 text-tea-text-sec text-ui-13 text-center font-serif italic">
                    Required: Product Name, Type<br/>
                    Optional: Stock, Cost, Year, Vendor
                </p>
              </div>

              <div className="flex flex-col items-center gap-2">
                 <button onClick={handleDownloadTemplate} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub text-xs transition-colors">
                    <Download size={13} /> Download Template
                 </button>
              </div>
            </div>
          )}

          {stage === 'staging' && (
            <div className="h-full flex flex-col">
                  <div className="flex justify-between items-center mb-4 text-sm">
                 <div className="flex gap-4">
                    <span className="flex items-center gap-2 text-tea-text"><CheckCircle size={14} /> {validationSummary.valid} Active</span>
                    <span className="flex items-center gap-2 text-tea-text-sec"><FileQuestion size={14} /> {validationSummary.drafts} Drafts (Missing Info)</span>
                 </div>
              </div>

              {/* Mobile card list */}
              <div className="block md:hidden flex-1 overflow-auto pb-24">
                <div className="label-caps text-tea-text-sec px-1 pb-2">
                  Reviewing {stagingData.length} item{stagingData.length !== 1 ? 's' : ''}
                </div>
                {stagingData.map((row, idx) => {
                  const isExpanded = expandedRowId === row.id;
                  const hasErrors = row.errors.length > 0;
                  return (
                    <div key={row.id} className={`border border-tea-border rounded-xl mb-2 overflow-hidden ${hasErrors ? 'border-tea-gold/40' : ''}`}>
                      {/* Collapsed header — tap to expand */}
                      <button
                        className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${isExpanded ? 'bg-tea-surface/60' : idx % 2 === 0 ? 'bg-transparent' : 'bg-tea-surface/20'} active:bg-tea-surface/80`}
                        onClick={() => setExpandedRowId(isExpanded ? null : row.id)}
                      >
                        {/* Status indicator */}
                        <span className="flex-shrink-0">
                          {hasErrors ? (
                            <AlertTriangle size={14} className="text-tea-gold" aria-label={row.errors.join(', ')} />
                          ) : row.status === 'Draft' ? (
                            <span className="text-ui-9 font-mono text-tea-text-sec bg-tea-text-sec/10 px-1.5 py-0.5 rounded-md">DRAFT</span>
                          ) : (
                            <span className="text-ui-9 font-mono text-tea-text bg-tea-text/10 px-1.5 py-0.5 rounded-md">ACTIVE</span>
                          )}
                        </span>

                        {/* Name + type */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-tea-text truncate">
                            {row.givenName || row.productName || <span className="text-tea-text-sec/50 italic">Unnamed</span>}
                          </div>
                          <div className="flex items-center gap-1.5 text-ui-10 text-tea-text-sec/70 mt-0.5">
                            <span className={isMissingOrUnknown(row.type) ? 'text-tea-gold/80 italic' : ''}>{row.type || 'No type'}</span>
                            {row.costAmount && !isMissingOrUnknown(row.costAmount) && (
                              <>
                                <span className="opacity-40">·</span>
                                <span className="font-mono">{row.costAmount} {row.currency}</span>
                              </>
                            )}
                            {row.stockAmount && !isMissingOrUnknown(row.stockAmount) && (
                              <>
                                <span className="opacity-40">·</span>
                                <span className="font-mono">{row.stockAmount}g stock</span>
                              </>
                            )}
                          </div>
                        </div>

                        <ChevronDown size={14} className={`flex-shrink-0 text-tea-text-sec/30 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="bg-tea-surface/40 border-t border-tea-border px-4 py-3">
                          {hasErrors && (
                            <div className="mb-3 px-3 py-2 bg-tea-gold/10 rounded-xl text-xs text-tea-gold">
                              {row.errors.join(' · ')}
                            </div>
                          )}
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                            <div>
                              <dt className="label-caps text-tea-text-dim">Product Name</dt>
                              <dd className="text-tea-text font-serif mt-0.5">{row.productName || '—'}</dd>
                            </div>
                            <div>
                              <dt className="label-caps text-tea-text-dim">Type</dt>
                              <dd className={`mt-0.5 ${isMissingOrUnknown(row.type) ? 'text-tea-gold/80 italic' : 'text-tea-text'}`}>{row.type || '—'}</dd>
                            </div>
                            {row.year && (
                              <div>
                                <dt className="label-caps text-tea-text-dim">Year</dt>
                                <dd className="text-tea-text-sec font-serif italic mt-0.5">{row.year}</dd>
                              </div>
                            )}
                            <div>
                              <dt className="label-caps text-tea-text-dim">Grams Purchased</dt>
                              <dd className={`font-mono mt-0.5 ${isMissingOrUnknown(row.grams) ? 'text-tea-text-sec/50 italic' : 'text-tea-text'}`}>{row.grams || '—'}</dd>
                            </div>
                            <div>
                              <dt className="label-caps text-tea-text-dim">Stock</dt>
                              <dd className={`font-mono mt-0.5 ${isMissingOrUnknown(row.stockAmount) ? 'text-tea-text-sec/50 italic' : 'text-tea-text'}`}>{row.stockAmount || '—'}</dd>
                            </div>
                            <div>
                              <dt className="label-caps text-tea-text-dim">Cost</dt>
                              <dd className={`font-mono mt-0.5 ${isMissingOrUnknown(row.costAmount) ? 'text-tea-text-sec/50 italic' : 'text-tea-text'}`}>{row.costAmount || '—'}</dd>
                            </div>
                            <div>
                              <dt className="label-caps text-tea-text-dim">Currency</dt>
                              <dd className={`font-mono mt-0.5 ${isMissingOrUnknown(row.currency) ? 'text-tea-text-sec/50 italic' : 'text-tea-text'}`}>{row.currency || '—'}</dd>
                            </div>
                            {row.vendor && (
                              <div>
                                <dt className="label-caps text-tea-text-dim">Vendor</dt>
                                <dd className="text-tea-text-sec mt-0.5">{row.vendor}</dd>
                              </div>
                            )}
                            <div>
                              <dt className="label-caps text-tea-text-dim">Restock</dt>
                              <dd className="mt-0.5">{row.canReorder ? <span className="text-tea-text font-serif italic">Yes</span> : <span className="text-tea-text-sec/50">—</span>}</dd>
                            </div>
                            <div>
                              <dt className="label-caps text-tea-text-dim">Personal</dt>
                              <dd className="mt-0.5">{row.isPersonal ? <span className="text-tea-text font-serif italic">Yes</span> : <span className="text-tea-text-sec/50">—</span>}</dd>
                            </div>
                          </dl>
                          <div className="mt-3 pt-3 border-t border-tea-border flex justify-end">
                            <button
                              onClick={() => deleteRow(row.id)}
                              className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-gold transition-colors"
                            >
                              <Trash2 size={13} /> Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block flex-1 overflow-auto border border-tea-border rounded-xl bg-tea-surface">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-tea-bg label-caps text-tea-text-dim sticky top-0 z-sticky">
                    <tr>
                      <th className="p-3 border-b border-tea-border">State</th>
                      <th className="p-3 border-b border-tea-border">Type</th>
                      <th className="p-3 border-b border-tea-border">Given Name</th>
                      <th className="p-3 border-b border-tea-border">Product Name</th>
                      <th className="p-3 border-b border-tea-border">Year</th>
                      <th className="p-3 border-b border-tea-border bg-tea-bg/50">Grams</th>
                      <th className="p-3 border-b border-tea-border bg-tea-bg/50">Stock</th>
                      <th className="p-3 border-b border-tea-border bg-tea-bg/50">Cost</th>
                      <th className="p-3 border-b border-tea-border bg-tea-bg/50">Curr</th>
                      <th className="p-3 border-b border-tea-border">Vendor</th>
                      <th className="p-3 border-b border-tea-border">Restock?</th>
                      <th className="p-3 border-b border-tea-border">Personal?</th>
                      <th className="p-3 border-b border-tea-border"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-tea-border">
                    {stagingData.map(row => (
                      <tr key={row.id} className="hover:bg-tea-bg/30 transition-colors">
                        <td className="p-2 text-center">
                            {row.errors.length > 0 ? (
                                <div title={row.errors.join(', ')} className="flex justify-center cursor-help">
                                    <AlertTriangle size={14} className="text-tea-gold" />
                                </div>
                            ) : row.status === 'Draft' ? (
                                <span className="px-1.5 py-0.5 rounded-md bg-tea-text-sec/10 text-tea-text-sec border border-tea-text-sec/20 text-ui-10 font-mono">DRAFT</span>
                            ) : (
                                <span className="px-1.5 py-0.5 rounded-md bg-tea-text/10 text-tea-text border border-tea-text/20 text-ui-10 font-mono">ACTIVE</span>
                            )}
                        </td>
                        <td className={`p-2 text-tea-text-sec ${isMissingOrUnknown(row.type) ? 'bg-tea-gold/10' : ''}`}>{row.type}</td>
                        <td className="p-2 text-tea-text">{row.givenName}</td>
                        <td className="p-2 text-tea-text font-serif">{row.productName}</td>
                        <td className="p-2 text-tea-text-sec font-serif italic">{row.year}</td>

                        <td className={`p-2 bg-tea-bg/30 font-mono ${isMissingOrUnknown(row.grams) ? 'text-tea-text-sec italic' : 'text-tea-text'}`}>{row.grams}</td>
                        <td className={`p-2 bg-tea-bg/30 font-mono ${isMissingOrUnknown(row.stockAmount) ? 'text-tea-text-sec italic' : 'text-tea-text'}`}>{row.stockAmount}</td>
                        <td className={`p-2 bg-tea-bg/30 font-mono ${isMissingOrUnknown(row.costAmount) ? 'text-tea-text-sec italic' : 'text-tea-text'}`}>{row.costAmount}</td>
                        <td className={`p-2 bg-tea-bg/30 font-mono ${isMissingOrUnknown(row.currency) ? 'text-tea-text-sec italic' : 'text-tea-text'}`}>{row.currency}</td>

                        <td className="p-2 text-tea-text-sec">{row.vendor}</td>

                        <td className="p-2 text-center">
                            {row.canReorder ? <span className="text-tea-text font-serif italic">Yes</span> : <span className="text-tea-text-sec/50">-</span>}
                        </td>
                        <td className="p-2 text-center">
                             {row.isPersonal ? <span className="text-tea-gold font-serif italic">Yes</span> : <span className="text-tea-text-sec/50">-</span>}
                        </td>

                        <td className="p-2 text-center"><button onClick={() => deleteRow(row.id)} className="text-tea-text-sec hover:text-tea-gold transition-colors"><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {stage === 'uploading' && (
            <div className="h-full flex flex-col items-center justify-center">
              <Loader2 size={48} className="text-tea-gold animate-spin mb-4" />
              <h3 className="text-xl font-serif text-tea-text">Importing Data...</h3>
              <div className="w-64 h-1 bg-tea-border rounded-full mt-6 overflow-hidden">
                 <div 
                    className="h-full bg-tea-gold transition-all duration-300"
                    style={{ width: `${totalRecords > 0 ? (uploadProgress / totalRecords) * 100 : 0}%` }}
                 ></div>
              </div>
              <p className="text-xs text-tea-text-sec mt-4 font-mono">{uploadProgress} / {totalRecords}</p>
            </div>
          )}
        </div>

        {stage === 'staging' && (
          <div className="flex justify-between gap-2 px-5 py-3 border-t border-tea-border bg-tea-bg/40 rounded-b-xl flex-shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="px-2 py-1 text-xs text-tea-text-sec hover:text-tea-text transition-colors">Cancel</button>
              <button onClick={() => setStage('upload')} className="px-2 py-1 text-xs text-tea-text-sec hover:text-tea-text transition-colors">Back</button>
            </div>
            <button onClick={handleCommit} disabled={stagingData.length === 0} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-tea-gold/10">
                Import All ({stagingData.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};