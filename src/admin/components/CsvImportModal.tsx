import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { Upload, X, CheckCircle, Trash2, Loader2, Download, AlertTriangle, FileQuestion } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from './Toast';

interface StagingRow {
  id: string;
  type: string;
  givenName: string;
  chineseName: string; 
  productName: string;
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
  const [stage, setStage] = useState<'upload' | 'staging' | 'uploading'>('upload');
  const [stagingData, setStagingData] = useState<StagingRow[]>([]);
  const [validationSummary, setValidationSummary] = useState({ valid: 0, drafts: 0 });
  
  // Progress State
  const [uploadProgress, setUploadProgress] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);

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
      skipEmptyLines: true,
      complete: (results: any) => {
        const rows = results.data.map((row: any, index: number) => {
          
          const getType = () => getSafeValue(row, ['Type', 'Category']);
          const getGivenName = () => getSafeValue(row, ['Given Name', 'GivenName', 'Title']);
          const getChineseName = () => getSafeValue(row, ['Chinese Name', 'ChineseName', 'Chinese']);
          const getProductName = () => getSafeValue(row, ['Product Name', 'ProductName', 'Name', 'Cultivar']);
          const getYear = () => getSafeValue(row, ['Year', 'Age', 'Harvest Year']);
          
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
        const validTypes = ['Green', 'White', 'Yellow', 'Oolong', 'Red', 'Dark', 'Sheng', 'Shou', 'Herbal', 'Matcha', 'Flower', 'Teaware', 'Misc'];
        let typeToSave = r.type;
        const matchedType = validTypes.find(t => t.toLowerCase() === (r.type || '').toLowerCase());
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
        
        // 3. Extract Year (Find first 4-digit number)
        let year = null;
        if (r.year) {
             const yearMatch = r.year.toString().match(/\b(19|20)\d{2}\b/);
             if (yearMatch) year = parseInt(yearMatch[0]);
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
        }

        return {
          type: typeToSave, 
          given_name: r.givenName, 
          chinese_name: r.chineseName || null, 
          product_name: r.productName || r.givenName || 'Unnamed Product', 
          year: year,
          origin_country: r.originCountry || 'Unknown',
          origin_region: r.originRegion || '',
          stock_grams: stock,
          quantity_purchased: qtyPurchased,
          cost_amount: cost,
          cost_currency: curr, 
          vendor: r.vendor,
          description: '', // FIX: Default to empty, do not create admin text
          status: r.status, 
          is_personal: !!r.isPersonal, // Enforce boolean
          can_reorder: !!r.canReorder  // Enforce boolean
        };
    });

    // Batch Insert
    const BATCH_SIZE = 50;
    const batches = chunkArray(preparedRows, BATCH_SIZE);
    let processedCount = 0;

    try {
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            const { error } = await supabase.from('products').insert(batch);
            
            if (error) {
                console.error("Batch Insert Error:", error);
                throw new Error(`Failed at batch ${i + 1}: ${error.message}`);
            }

            processedCount += batch.length;
            setUploadProgress(processedCount);
        }

        // Success
        onComplete();
        onClose();

    } catch (error: any) {
        showToast(`Import stopped: ${error.message}`, 'error');
        setStage('staging'); // Allow user to fix and retry
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-tea-bg border border-tea-border rounded-xl w-full max-w-7xl h-[85vh] flex flex-col shadow-2xl relative">
        <div className="p-6 border-b border-tea-border flex justify-between items-center bg-tea-surface rounded-t-xl">
          <div>
            <h3 className="text-2xl font-serif text-tea-text">Import Inventory</h3>
            <p className="text-tea-muted text-sm mt-1">
              {stage === 'upload' && "Select your CSV file."}
              {stage === 'staging' && "Review data before importing."}
              {stage === 'uploading' && `Importing ${uploadProgress} of ${totalRecords} records...`}
            </p>
          </div>
          {stage !== 'uploading' && <button onClick={onClose} className="text-tea-muted hover:text-tea-text transition-colors"><X size={24} /></button>}
        </div>

        <div className="flex-1 overflow-hidden p-6 relative">
          {stage === 'upload' && (
            <div className="h-full flex flex-col items-center justify-center gap-6">
              <div className="w-full max-w-md border-2 border-dashed border-tea-border rounded-xl hover:border-tea-muted transition-colors p-10 flex flex-col items-center bg-tea-surface/50">
                <Upload size={48} className="text-tea-muted mb-4" />
                <label className="cursor-pointer bg-tea-accent text-tea-bg px-6 py-3 rounded-lg font-bold uppercase tracking-[0.2em] text-xs hover:bg-tea-accent/90 transition-colors">
                  Select CSV File
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                </label>
                <p className="mt-4 text-tea-muted text-sm text-center font-serif italic">
                    Required: Product Name, Type<br/>
                    Optional: Stock, Cost, Year, Vendor
                </p>
              </div>

              <div className="flex flex-col items-center gap-2">
                 <button onClick={handleDownloadTemplate} className="text-tea-muted hover:text-tea-text flex items-center gap-2 text-xs uppercase tracking-[0.2em] border border-tea-border px-4 py-2 rounded-lg hover:bg-tea-surface transition-colors">
                    <Download size={14} /> Download Template
                 </button>
              </div>
            </div>
          )}

          {stage === 'staging' && (
            <div className="h-full flex flex-col">
                  <div className="flex justify-between items-center mb-4 text-sm">
                 <div className="flex gap-4">
                    <span className="flex items-center gap-2 text-tea-text"><CheckCircle size={14} /> {validationSummary.valid} Active</span>
                    <span className="flex items-center gap-2 text-tea-muted"><FileQuestion size={14} /> {validationSummary.drafts} Drafts (Missing Info)</span>
                 </div>
              </div>

              <div className="flex-1 overflow-auto border border-tea-border rounded-xl bg-tea-surface">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-tea-bg text-tea-muted font-serif uppercase tracking-[0.2em] text-[10px] sticky top-0 z-10">
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
                                    <AlertTriangle size={14} className="text-tea-accent" />
                                </div>
                            ) : row.status === 'Draft' ? (
                                <span className="px-1.5 py-0.5 rounded-sm bg-tea-muted/10 text-tea-muted border border-tea-muted/20 text-[10px] font-mono">DRAFT</span>
                            ) : (
                                <span className="px-1.5 py-0.5 rounded-sm bg-tea-text/10 text-tea-text border border-tea-text/20 text-[10px] font-mono">ACTIVE</span>
                            )}
                        </td>
                        <td className={`p-2 text-tea-muted ${isMissingOrUnknown(row.type) ? 'bg-tea-accent/10' : ''}`}>{row.type}</td>
                        <td className="p-2 text-tea-text">{row.givenName}</td>
                        <td className="p-2 text-tea-text font-serif">{row.productName}</td>
                        <td className="p-2 text-tea-muted font-serif italic">{row.year}</td>
                        
                        <td className={`p-2 bg-tea-bg/30 font-mono ${isMissingOrUnknown(row.grams) ? 'text-tea-muted italic' : 'text-tea-text'}`}>{row.grams}</td>
                        <td className={`p-2 bg-tea-bg/30 font-mono ${isMissingOrUnknown(row.stockAmount) ? 'text-tea-muted italic' : 'text-tea-text'}`}>{row.stockAmount}</td>
                        <td className={`p-2 bg-tea-bg/30 font-mono ${isMissingOrUnknown(row.costAmount) ? 'text-tea-muted italic' : 'text-tea-text'}`}>{row.costAmount}</td>
                        <td className={`p-2 bg-tea-bg/30 font-mono ${isMissingOrUnknown(row.currency) ? 'text-tea-muted italic' : 'text-tea-text'}`}>{row.currency}</td>
                        
                        <td className="p-2 text-tea-muted">{row.vendor}</td>
                        
                        <td className="p-2 text-center">
                            {row.canReorder ? <span className="text-tea-text font-serif italic">Yes</span> : <span className="text-tea-muted/50">-</span>}
                        </td>
                        <td className="p-2 text-center">
                             {row.isPersonal ? <span className="text-tea-accent font-serif italic">Yes</span> : <span className="text-tea-muted/50">-</span>}
                        </td>
                        
                        <td className="p-2 text-center"><button onClick={() => deleteRow(row.id)} className="text-tea-muted hover:text-tea-accent transition-colors"><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {stage === 'uploading' && (
            <div className="h-full flex flex-col items-center justify-center">
              <Loader2 size={48} className="text-tea-accent animate-spin mb-4" />
              <h3 className="text-xl font-serif text-tea-text">Importing Data...</h3>
              <div className="w-64 h-1 bg-tea-border rounded-full mt-6 overflow-hidden">
                 <div 
                    className="h-full bg-tea-accent transition-all duration-300"
                    style={{ width: `${totalRecords > 0 ? (uploadProgress / totalRecords) * 100 : 0}%` }}
                 ></div>
              </div>
              <p className="text-xs text-tea-muted mt-4 font-mono">{uploadProgress} / {totalRecords}</p>
            </div>
          )}
        </div>

        {stage === 'staging' && (
          <div className="p-6 border-t border-tea-border bg-tea-surface flex justify-between items-center rounded-b-xl">
            <button onClick={() => setStage('upload')} className="text-tea-muted hover:text-tea-text transition-colors text-xs uppercase tracking-[0.2em]">Back</button>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-6 py-3 text-tea-muted hover:text-tea-text transition-colors text-xs uppercase tracking-[0.2em]">Cancel</button>
              <button onClick={handleCommit} disabled={stagingData.length === 0} className="px-6 py-3 bg-tea-accent text-tea-bg rounded-lg font-bold text-xs uppercase tracking-[0.2em] hover:bg-tea-accent/90 disabled:opacity-50 transition-colors">
                  Import All ({stagingData.length})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};