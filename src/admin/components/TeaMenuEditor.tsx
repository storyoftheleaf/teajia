import React, { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Search, Leaf, Loader2, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useTeaMenu } from '../hooks/useEventData';
import { useProducts } from '../hooks/useAdminData';
import { useToast } from './Toast';
import { TeaMenuItem } from '../../types/events';
import { ConfirmModal } from './ConfirmModal';

interface TeaMenuEditorProps {
  eventId: string;
}

export const TeaMenuEditor: React.FC<TeaMenuEditorProps> = ({ eventId }) => {
  const { showToast } = useToast();
  const { data: menuItems = [], refetch } = useTeaMenu(eventId);
  const { data: products = [] } = useProducts();
  const [showPicker, setShowPicker] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [customTeaType, setCustomTeaType] = useState('');
  const [customOriginRegion, setCustomOriginRegion] = useState('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  const sortedItems = [...menuItems].sort((a, b) => a.brewOrder - b.brewOrder);

  const handleAddFromInventory = async (productId: string, productName: string) => {
    setLoadingAction('add');
    try {
      await api.events.upsertTeaMenu(eventId, [{
        product_id: productId,
        custom_name: productName,
        brew_order: menuItems.length,
      }]);
      refetch();
      setShowPicker(false);
      setSearchQuery('');
      showToast(`${productName} added to menu`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not add tea to menu. Try again.', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAddCustom = async () => {
    if (!customName.trim()) return;
    setLoadingAction('add');
    try {
      await api.events.upsertTeaMenu(eventId, [{
        custom_name: customName,
        custom_description: customDescription || null,
        tea_type: customTeaType || null,
        origin_region: customOriginRegion || null,
        brew_order: menuItems.length,
      }]);
      refetch();
      setShowCustom(false);
      setCustomName('');
      setCustomDescription('');
      setCustomTeaType('');
      setCustomOriginRegion('');
      showToast('Custom tea added to menu', 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not add custom tea to menu. Try again.', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRemove = async (itemId: string) => {
    setLoadingAction(itemId);
    try {
      await api.events.deleteTeaMenuItem(eventId, itemId);
      refetch();
      showToast('Removed from menu', 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not remove tea from menu. Try again.', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleMove = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= sortedItems.length) return;
    const reordered = [...sortedItems];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    // Use upsertTeaMenu with updated brew_order values
    const updatedItems = reordered.map((item, i) => ({
      id: item.id,
      product_id: item.productId || undefined,
      custom_name: item.customName || item.productName || '',
      custom_description: item.customDescription || '',
      tea_type: item.teaType || undefined,
      origin_region: item.originRegion || undefined,
      brew_order: i,
    }));
    try {
      await api.events.upsertTeaMenu(eventId, updatedItems);
      refetch();
    } catch (err: any) {
      showToast(err.message || 'Could not reorder menu items. Try again.', 'error');
    }
  };

  const handleUpdateRevealDate = async (item: TeaMenuItem, date: string) => {
    try {
      await api.events.upsertTeaMenu(eventId, [{
        id: item.id,
        product_id: item.productId || undefined,
        custom_name: item.customName || item.productName || '',
        custom_description: item.customDescription || '',
        tea_type: item.teaType || undefined,
        origin_region: item.originRegion || undefined,
        brew_order: item.brewOrder,
        reveal_date: date || null,
      }]);
      refetch();
    } catch (err: any) {
      showToast(err.message || 'Could not update reveal date. Try again.', 'error');
    }
  };

  const handleUpdateDescription = async (item: TeaMenuItem, description: string) => {
    try {
      await api.events.upsertTeaMenu(eventId, [{
        id: item.id,
        product_id: item.productId || undefined,
        custom_name: item.customName || item.productName || '',
        custom_description: description || null,
        tea_type: item.teaType || undefined,
        origin_region: item.originRegion || undefined,
        brew_order: item.brewOrder,
      }]);
      refetch();
    } catch (err: any) {
      showToast(err.message || 'Could not update menu item description. Try again.', 'error');
    }
  };

  // Filter products for picker
  const teaProducts = products.filter(p =>
    p.type !== 'Teaware' && p.type !== 'Misc' &&
    p.status === 'Active' &&
    (!searchQuery || p.productName.toLowerCase().includes(searchQuery.toLowerCase()) || p.givenName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="relative">
      {/* Menu Items */}
      {sortedItems.length === 0 ? (
        <div className="text-center py-8 text-tea-text-sec text-sm">
          <Leaf className="mx-auto mb-2" size={20} />
          Nothing on the menu yet
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {sortedItems.map((item, idx) => (
            <div key={item.id} className="bg-tea-surface border border-tea-border rounded-md p-3 flex items-start gap-3">
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5 shrink-0 mt-0.5">
                <button
                  onClick={() => handleMove(idx, -1)}
                  disabled={idx === 0}
                  className="text-tea-text-sec hover:text-tea-text disabled:opacity-20 transition-colors"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  onClick={() => handleMove(idx, 1)}
                  disabled={idx === sortedItems.length - 1}
                  className="text-tea-text-sec hover:text-tea-text disabled:opacity-20 transition-colors"
                >
                  <ArrowDown size={12} />
                </button>
              </div>

              {/* Brew order badge */}
              <div className="w-6 h-6 rounded-full bg-tea-gold/10 text-tea-gold text-ui-10 font-bold flex items-center justify-center shrink-0 mt-0.5">
                {idx + 1}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-tea-text font-medium">{item.customName || item.productName || ''}</div>
                {(item.customDescription) && (
                  <p className="text-xs text-tea-text-sec mt-0.5">{item.customDescription}</p>
                )}
                {!item.customDescription && (
                  <input
                    type="text"
                    placeholder="Add description..."
                    className="w-full border-b border-transparent hover:border-tea-border focus:border-tea-gold bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg text-xs text-tea-text-sec py-1 mt-0.5 transition-colors"
                    onBlur={(e) => {
                      if (e.target.value) handleUpdateDescription(item, e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                  />
                )}

                {/* Reveal date */}
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-ui-9 uppercase tracking-[0.15em] text-tea-text-sec">Reveal</label>
                  <input
                    type="datetime-local"
                    value={item.revealDate ? item.revealDate.slice(0, 16) : ''}
                    onChange={(e) => handleUpdateRevealDate(item, e.target.value)}
                    className="border-b border-tea-border bg-transparent focus:border-tea-gold outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg text-ui-11 text-tea-text-sec py-0.5"
                  />
                </div>
              </div>

              {/* Remove */}
              <button
                onClick={() => setPendingRemoveId(item.id)}
                disabled={loadingAction === item.id}
                className="text-tea-text-sec hover:text-tea-text p-1 transition-colors shrink-0"
              >
                {loadingAction === item.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => { setShowPicker(true); setShowCustom(false); }}
          className="flex items-center gap-1.5 text-xs text-tea-gold hover:text-tea-gold-lt transition-colors px-3 py-2 border border-tea-border rounded-md hover:border-tea-gold/30"
        >
          <Plus size={12} /> Add from Inventory
        </button>
        <button
          onClick={() => { setShowCustom(true); setShowPicker(false); }}
          className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-text transition-colors px-3 py-2 border border-tea-border rounded-md hover:border-tea-gold/30"
        >
          <Plus size={12} /> Add Custom Tea
        </button>
      </div>

      {/* Product Picker */}
      {showPicker && (
        <div className="mt-3 bg-tea-bg border border-tea-border rounded-md p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-1">
              <Search size={14} className="text-tea-text-sec shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border-b border-tea-border bg-transparent focus:border-tea-gold outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg text-sm text-tea-text py-1 placeholder:text-tea-text-sec/50"
                placeholder="Search inventory..."
                autoFocus
              />
            </div>
            <button onClick={() => setShowPicker(false)} className="text-tea-text-sec hover:text-tea-text p-1 ml-2">
              <X size={14} />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {teaProducts.slice(0, 20).map(product => (
              <button
                key={product.id}
                onClick={() => handleAddFromInventory(product.id, product.productName)}
                disabled={loadingAction === 'add'}
                className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-tea-elevated/50 transition-colors text-left"
              >
                <Leaf size={12} className="text-tea-text-sec shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-tea-text">{product.productName}</span>
                  {product.givenName && (
                    <span className="text-xs text-tea-text-sec ml-2">{product.givenName}</span>
                  )}
                </div>
                <span className="text-ui-10 text-tea-text-sec">{product.type}</span>
              </button>
            ))}
            {teaProducts.length === 0 && (
              <div className="text-center py-4 text-tea-text-sec text-xs">No matching products</div>
            )}
          </div>
        </div>
      )}

      {/* Custom Tea Form */}
      {showCustom && (
        <div className="mt-3 bg-tea-bg border border-tea-border rounded-md p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec">Custom Tea</span>
            <button onClick={() => setShowCustom(false)} className="text-tea-text-sec hover:text-tea-text p-1">
              <X size={14} />
            </button>
          </div>
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="w-full border-b border-tea-border bg-transparent focus:border-tea-gold outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg text-sm text-tea-text py-2 placeholder:text-tea-text-sec/50"
            placeholder="Tea name"
            autoFocus
          />
          <input
            type="text"
            value={customDescription}
            onChange={(e) => setCustomDescription(e.target.value)}
            className="w-full border-b border-tea-border bg-transparent focus:border-tea-gold outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg text-sm text-tea-text py-2 placeholder:text-tea-text-sec/50"
            placeholder="Description (optional)"
          />
          <div className="flex gap-2">
            <select
              value={customTeaType}
              onChange={(e) => setCustomTeaType(e.target.value)}
              className="flex-1 border-b border-tea-border bg-transparent focus:border-tea-gold outline-none text-sm text-tea-text py-2 text-tea-text-sec"
            >
              <option value="">Type (optional)</option>
              <option value="Oolong">Oolong</option>
              <option value="Puerh">Puerh</option>
              <option value="White">White</option>
              <option value="Green">Green</option>
              <option value="Black">Black</option>
              <option value="Yellow">Yellow</option>
            </select>
            <input
              type="text"
              value={customOriginRegion}
              onChange={(e) => setCustomOriginRegion(e.target.value)}
              className="flex-1 border-b border-tea-border bg-transparent focus:border-tea-gold outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg text-sm text-tea-text py-2 placeholder:text-tea-text-sec/50"
              placeholder="Region (optional)"
            />
          </div>
          <button
            onClick={handleAddCustom}
            disabled={!customName.trim() || loadingAction === 'add'}
            className="flex items-center gap-1.5 text-xs bg-tea-gold text-tea-bg px-3 py-1.5 rounded-md hover:bg-tea-gold-lt transition-colors disabled:opacity-50"
          >
            {loadingAction === 'add' ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Add
          </button>
        </div>
      )}

      <ConfirmModal
        isOpen={!!pendingRemoveId}
        onClose={() => setPendingRemoveId(null)}
        onConfirm={async () => {
          if (pendingRemoveId) {
            await handleRemove(pendingRemoveId);
            setPendingRemoveId(null);
          }
        }}
        title="Remove from menu?"
        description="This tea will be removed from the session menu."
        confirmLabel="Remove"
        variant="destructive"
        isLoading={loadingAction === pendingRemoveId}
      />
    </div>
  );
};
