import React, { useState } from 'react';
import { InventoryItem, CostCurrency, TEA_TYPES } from '../../types';
import { convertToUSD, CURRENCY_SYMBOLS, loadExchangeRates } from '../../utils/currency';
import { CURRENCY_BY_LOCATION, SUPPLIER_LOCATIONS } from './currencyHelpers';
import { fmtPricePerGram } from '../../utils/formatNumber';

export const InventoryEditor: React.FC<{ item: InventoryItem; onSave: (i: InventoryItem) => void; onCancel: () => void; }> = ({ item, onSave, onCancel }) => {
    const [currentItem, setCurrentItem] = useState(item);
    const [showCurrencyOverride, setShowCurrencyOverride] = useState(false);
    const [hasManualCurrencyOverride, setHasManualCurrencyOverride] = useState(false);
    const exchangeRates = loadExchangeRates();

    // Auto-detect currency from supplier location (unless manually overridden)
    const getDetectedCurrency = () => {
      if (hasManualCurrencyOverride) {
        return currentItem.cost_currency || 'USD';
      }
      const location = currentItem.supplier_location as keyof typeof CURRENCY_BY_LOCATION;
      return location && CURRENCY_BY_LOCATION[location] ? CURRENCY_BY_LOCATION[location] : 'USD';
    };

    const handleLocationChange = (newLocation: string) => {
      setCurrentItem({...currentItem, supplier_location: newLocation});
      setShowCurrencyOverride(false);
      setHasManualCurrencyOverride(false);

      // Auto-update currency to match location
      const detectedCurrency = (newLocation && CURRENCY_BY_LOCATION[newLocation as keyof typeof CURRENCY_BY_LOCATION]) || 'USD';
      const cost = parseFloat(currentItem.cost_price) || 0;
      const mult = currentItem.multiplier || 1;
      const costInUSD = convertToUSD(cost, detectedCurrency, exchangeRates);
      const newPrice = (costInUSD * mult).toFixed(2);

      if (currentItem.category === 'tea') {
        setCurrentItem({...currentItem, supplier_location: newLocation, cost_currency: detectedCurrency, price_per_gram: newPrice});
      } else {
        setCurrentItem({...currentItem, supplier_location: newLocation, cost_currency: detectedCurrency, price_50g: newPrice});
      }
    };

    const handleManualCurrencyOverride = (newCurrency: CostCurrency) => {
      const cost = parseFloat(currentItem.cost_price) || 0;
      const mult = currentItem.multiplier || 1;
      const costInUSD = convertToUSD(cost, newCurrency, exchangeRates);
      const newPrice = (costInUSD * mult).toFixed(2);

      setCurrentItem({...currentItem, cost_currency: newCurrency, ...(currentItem.category === 'tea' ? {price_per_gram: newPrice} : {price_50g: newPrice})});
      setHasManualCurrencyOverride(true);
      setShowCurrencyOverride(false);
    };

    const handleCostChange = (newCost: string) => {
        const cost = parseFloat(newCost) || 0;
        const mult = currentItem.multiplier || 1;
        const currency = getDetectedCurrency();
        // Convert cost to USD, then apply multiplier
        const costInUSD = convertToUSD(cost, currency, exchangeRates);
        const newPrice = (costInUSD * mult).toFixed(2);
        if (currentItem.category === 'tea') {
            setCurrentItem({...currentItem, cost_price: newCost, price_per_gram: newPrice});
        } else {
            setCurrentItem({...currentItem, cost_price: newCost, price_50g: newPrice});
        }
    };

    const handleMultiplierChange = (newMult: string) => {
        const mult = parseFloat(newMult) || 1;
        const cost = parseFloat(currentItem.cost_price) || 0;
        const currency = getDetectedCurrency();
        // Convert cost to USD, then apply multiplier
        const costInUSD = convertToUSD(cost, currency, exchangeRates);
        const newPrice = (costInUSD * mult).toFixed(2);
        if (currentItem.category === 'tea') {
            setCurrentItem({...currentItem, multiplier: mult, price_per_gram: newPrice});
        } else {
            setCurrentItem({...currentItem, multiplier: mult, price_50g: newPrice});
        }
    };

    const handlePriceChange = (newPrice: string) => {
        const price = parseFloat(newPrice) || 0;
        const cost = parseFloat(currentItem.cost_price) || 0;
        const currency = getDetectedCurrency();
        const costInUSD = convertToUSD(cost, currency, exchangeRates);
        const newMult = costInUSD > 0 ? parseFloat((price / costInUSD).toFixed(2)) : 1;
        if (currentItem.category === 'tea') {
            setCurrentItem({...currentItem, price_per_gram: newPrice, multiplier: newMult});
        } else {
            setCurrentItem({...currentItem, price_50g: newPrice, multiplier: newMult});
        }
    };

    return (
        <div className="fixed inset-0 z-modal bg-tea-bg flex flex-col">
            {/* Header with Title and Action Buttons */}
            <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-tea-border shrink-0 bg-tea-surface">
                <h2 className="text-xl md:text-2xl font-serif text-tea-text">Edit Inventory Item</h2>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-tea-text hover:text-white transition-colors duration-200 text-sm uppercase tracking-wider font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(currentItem)}
                        className="px-6 py-2 bg-tea-gold hover:bg-tea-gold/90 text-white rounded-sm text-sm uppercase tracking-wider font-medium transition-colors duration-200 shadow-lg"
                    >
                        Save
                    </button>
                </div>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto pb-24 md:pb-32">
                <div className="p-4 md:p-6 space-y-3 md:space-y-4">

                    {/* BASIC INFO SECTION - 3 column grid */}
                    <div className="bg-tea-surface rounded-md p-4 animate-[fadeIn_0.3s_ease-out]">
                        {/* Row 1: Name (2 cols) | Type (1 col) */}
                        <div className="grid grid-cols-3 gap-3 mb-3">
                            <div className="col-span-2">
                                <label className="text-xs uppercase text-tea-gold block mb-2 tracking-wider font-semibold">Name</label>
                                <input
                                    className="w-full bg-tea-bg border border-tea-gold/15 p-2.5 text-white text-sm outline-none transition-all duration-200 focus:border-tea-gold focus:ring-1 focus:ring-tea-gold/50 rounded-sm h-9"
                                    value={currentItem.name}
                                    onChange={e => setCurrentItem({...currentItem, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-xs uppercase text-tea-gold block mb-2 tracking-wider font-semibold">Type</label>
                                <select className="w-full bg-tea-bg border border-tea-gold/15 p-2 text-white text-sm outline-none transition-all duration-200 focus:border-tea-gold focus:ring-1 focus:ring-tea-gold/50 rounded-sm h-9" value={currentItem.type} onChange={e => setCurrentItem({...currentItem, type: e.target.value})}>
                                    <option value="">Select</option>
                                    {currentItem.category === 'tea' ? TEA_TYPES.map(t => <option key={t} value={t}>{t}</option>) : <option value={currentItem.type}>{currentItem.type}</option>}
                                </select>
                            </div>
                        </div>

                        {/* Row 2: Variant (2) | Origin (2) | Year (1) */}
                        <div className="grid grid-cols-5 gap-3">
                            <div className="col-span-2">
                                <label className="text-xs uppercase text-tea-gold block mb-2 tracking-wider font-semibold">Variant</label>
                                <input className="w-full bg-tea-bg border border-tea-gold/15 p-2 text-white text-sm outline-none transition-all duration-200 focus:border-tea-gold focus:ring-1 focus:ring-tea-gold/50 rounded-sm h-9" value={currentItem.variant} onChange={e => setCurrentItem({...currentItem, variant: e.target.value})} />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs uppercase text-tea-gold block mb-2 tracking-wider font-semibold">Origin</label>
                                <input className="w-full bg-tea-bg border border-tea-gold/15 p-2 text-white text-sm outline-none transition-all duration-200 focus:border-tea-gold focus:ring-1 focus:ring-tea-gold/50 rounded-sm h-9" value={currentItem.origin} onChange={e => setCurrentItem({...currentItem, origin: e.target.value})} />
                            </div>
                            <div className="col-span-1">
                                <label className="text-xs uppercase text-tea-gold block mb-2 tracking-wider font-semibold">Year</label>
                                <input className="w-full bg-tea-bg border border-tea-gold/15 p-2 text-white text-sm outline-none transition-all duration-200 focus:border-tea-gold focus:ring-1 focus:ring-tea-gold/50 rounded-sm h-9" value={currentItem.year} onChange={e => setCurrentItem({...currentItem, year: e.target.value})} />
                            </div>
                        </div>
                    </div>

                    {/* SOURCING SECTION - Supplier (2/3) | Location (1/3) */}
                    {currentItem.category === 'tea' && (
                        <div className="bg-tea-surface rounded-md p-4 animate-[fadeIn_0.3s_ease-out]">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-2">
                                    <label className="text-xs uppercase text-tea-gold block mb-2 tracking-wider font-semibold">Supplier</label>
                                    <input className="w-full bg-tea-bg border border-tea-gold/15 p-2 text-white text-sm outline-none transition-all duration-200 focus:border-tea-gold focus:ring-1 focus:ring-tea-gold/50 rounded-sm h-9" value={currentItem.supplier || ''} onChange={e => setCurrentItem({...currentItem, supplier: e.target.value})} />
                                </div>
                                <div className="col-span-1">
                                    <label className="text-xs uppercase text-tea-gold block mb-2 tracking-wider font-semibold">Location</label>
                                    <select className="w-full bg-tea-bg border border-tea-gold/15 p-2 text-white text-sm outline-none transition-all duration-200 focus:border-tea-gold focus:ring-1 focus:ring-tea-gold/50 rounded-sm h-9" value={currentItem.supplier_location || ''} onChange={e => handleLocationChange(e.target.value)}>
                                        <option value="">Select</option>
                                        {SUPPLIER_LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}


                    {/* COST & STOCK SECTION - 3 column grid */}
                    <div className="bg-tea-surface rounded-md p-4 animate-[fadeIn_0.3s_ease-out]">
                        <div className="grid grid-cols-3 gap-3">
                            {/* Stock field */}
                            <div>
                                <label className="text-xs uppercase text-tea-gold block mb-2 tracking-wider font-semibold">Stock</label>
                                <div className="flex items-center gap-1 bg-tea-bg border border-tea-gold/15 rounded-sm h-9 px-2 min-w-0">
                                    <input
                                        type="number"
                                        value={currentItem.stock_g}
                                        onChange={e => setCurrentItem({...currentItem, stock_g: parseFloat(e.target.value) || 0})}
                                        className="flex-1 min-w-0 bg-transparent text-white text-sm outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
                                    />
                                    <span className="text-xs text-tea-text font-medium flex-shrink-0">g</span>
                                </div>
                            </div>

                            {/* Cost field with currency */}
                            <div>
                                <label className="text-xs uppercase text-tea-gold block mb-2 tracking-wider font-semibold">Cost</label>
                                <div className="flex items-center gap-1 bg-tea-bg border border-tea-gold/15 rounded-sm h-9 px-2 min-w-0">
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={currentItem.cost_price}
                                        onChange={e => handleCostChange(e.target.value)}
                                        className="flex-1 min-w-0 bg-transparent text-white text-sm outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
                                    />
                                    <span className="text-xs text-tea-text font-medium whitespace-nowrap flex-shrink-0">{getDetectedCurrency()}/g</span>
                                </div>
                            </div>

                            {/* Multiplier field */}
                            <div>
                                <label className="text-xs uppercase text-tea-gold block mb-2 tracking-wider font-semibold">Markup</label>
                                <div className="flex items-center gap-1 bg-tea-bg border border-tea-gold/15 rounded-sm h-9 px-2 min-w-0">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={currentItem.multiplier || 1}
                                        onChange={e => handleMultiplierChange(e.target.value)}
                                        className="flex-1 min-w-0 bg-transparent text-white text-sm outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
                                    />
                                    <span className="text-xs text-tea-text font-medium flex-shrink-0">×</span>
                                </div>
                            </div>
                        </div>

                        {/* Price Result - Full width below */}
                        <div className="mt-3">
                            <label className="text-xs uppercase text-tea-gold block mb-2 tracking-wider font-semibold">Calculated Price</label>
                            <div className="bg-tea-bg border border-tea-gold/10 rounded-sm p-3 text-center">
                                <div className="text-2xl font-semibold text-white">
                                    {fmtPricePerGram(parseFloat(currentItem.category === 'tea' ? currentItem.price_per_gram || '0' : currentItem.price_50g || '0') || 0)}
                                </div>
                            </div>
                        </div>

                        {/* Currency Change Button */}
                        <button
                            onClick={() => setShowCurrencyOverride(!showCurrencyOverride)}
                            className="text-xs text-tea-gold hover:text-white transition-colors mt-2 tracking-wider font-semibold"
                        >
                            Change Currency
                        </button>

                        {/* Currency Override Dropdown */}
                        {showCurrencyOverride && (
                            <div className="flex gap-2 bg-tea-bg border border-tea-gold/15 p-2.5 rounded-sm mt-2 animate-[fadeIn_0.2s_ease-out]">
                                <label className="text-xs uppercase text-tea-gold font-semibold self-center whitespace-nowrap">Override:</label>
                                <select className="flex-1 bg-black border border-tea-gold/15 p-2 text-white text-sm outline-none transition-all duration-200 focus:border-tea-gold focus:ring-1 focus:ring-tea-gold/50 rounded-sm" onChange={e => handleManualCurrencyOverride(e.target.value as CostCurrency)}>
                                    <option value="">Select Currency</option>
                                    {(['USD', 'IDR', 'CNY', 'TWD', 'MYR', 'HKD', 'JPY'] as const).map(c => <option key={c} value={c}>{c} {CURRENCY_SYMBOLS[c]}</option>)}
                                </select>
                                <button onClick={() => setShowCurrencyOverride(false)} className="px-2 py-1 text-xs text-tea-text hover:text-white transition-colors duration-200 whitespace-nowrap">Done</button>
                            </div>
                        )}
                    </div>

                    {/* MEDIA SECTION */}
                    <div className="bg-tea-surface rounded-md p-4 space-y-3 animate-[fadeIn_0.3s_ease-out]">
                        <div>
                            <label className="text-sm uppercase text-tea-gold block mb-2 tracking-wider font-semibold">Description</label>
                            <textarea className="w-full bg-tea-bg border border-tea-gold/15 p-3 text-white text-sm outline-none transition-all duration-200 focus:border-tea-gold focus:ring-1 focus:ring-tea-gold/50 rounded-sm h-20" value={currentItem.description} onChange={e => setCurrentItem({...currentItem, description: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-sm uppercase text-tea-gold block mb-2 tracking-wider font-semibold">Image URL</label>
                            <input className="w-full bg-tea-bg border border-tea-gold/15 p-3 text-white text-sm outline-none transition-all duration-200 focus:border-tea-gold focus:ring-1 focus:ring-tea-gold/50 rounded-sm" value={currentItem.image} onChange={e => setCurrentItem({...currentItem, image: e.target.value})} />
                        </div>
                    </div>

                    {/* IMAGE PREVIEW */}
                    {(currentItem.image || true) && (
                        <div className="bg-tea-surface rounded-md p-4 animate-[fadeIn_0.3s_ease-out]">
                            <label className="text-sm uppercase text-tea-gold block mb-3 tracking-wider font-semibold">Preview</label>
                            <div className="flex gap-4">
                                {currentItem.image ? (
                                    <div className="w-32 h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 flex-shrink-0 bg-black border border-tea-gold/15 rounded-sm flex items-center justify-center overflow-hidden">
                                        <img src={currentItem.image} alt={currentItem.name || 'Product preview'} className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="w-32 h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 flex-shrink-0 bg-black border border-tea-gold/15 rounded-sm flex items-center justify-center">
                                        <span className="text-tea-text text-sm">No Image</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};
