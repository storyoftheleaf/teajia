import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Trash2, Edit3, Loader2, ChevronDown, ChevronUp, Leaf, MapPin, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, X } from 'lucide-react';
import { useCustomers, useProducts } from '../hooks/useAdminData';
import { useToast } from './Toast';
import { api } from '../../lib/api';
import { Customer, CustomerTag } from '../types';
import { Product } from '../types';

// ── Add/Edit Source Modal ──
const SourceModal = ({
  isOpen, onClose, onSave, initialData, isEditing,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; company: string; country: string; notes: string; phone: string; whatsapp: string; email: string }) => Promise<void>;
  initialData?: { name: string; company: string; country: string; notes: string; phone: string; whatsapp: string; email: string };
  isEditing: boolean;
}) => {
  const [form, setForm] = useState(initialData || { name: '', company: '', country: '', notes: '', phone: '', whatsapp: '', email: '' });
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setForm(initialData || { name: '', company: '', country: '', notes: '', phone: '', whatsapp: '', email: '' });
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  const inputStyle = "w-full bg-transparent border-b border-tea-border px-0 py-2 text-sm text-tea-text outline-none focus:border-tea-accent transition-colors placeholder-tea-text-sec/50";

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-tea-text/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <form onSubmit={handleSubmit} className="bg-tea-bg border border-tea-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center p-6 border-b border-tea-border">
          <h3 className="text-lg font-serif text-tea-text">{isEditing ? 'Edit Source' : 'New Source'}</h3>
          <button type="button" onClick={onClose} className="text-tea-text-sec hover:text-tea-text"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-tea-gold/70 font-bold mb-1">Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputStyle} placeholder="Vendor name" autoFocus />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-tea-gold/70 font-bold mb-1">Company</label>
            <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className={inputStyle} placeholder="Company or shop name" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-tea-gold/70 font-bold mb-1">Country</label>
            <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className={inputStyle} placeholder="Country of origin" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-tea-gold/70 font-bold mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputStyle} placeholder="Phone" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-tea-gold/70 font-bold mb-1">WhatsApp</label>
              <input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} className={inputStyle} placeholder="WhatsApp" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-tea-gold/70 font-bold mb-1">Email</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputStyle} placeholder="Email" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-tea-gold/70 font-bold mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={`${inputStyle} min-h-[60px] resize-none`} placeholder="Notes about this source..." />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-6 border-t border-tea-border">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-tea-text-sec hover:text-tea-text transition-colors">Cancel</button>
          <button type="submit" disabled={saving || !form.name.trim()} className="px-5 py-2 bg-tea-gold text-tea-bg text-sm font-medium rounded-lg hover:bg-tea-gold/90 transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : isEditing ? 'Update' : 'Add Source'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ── Expanded Source Detail Row ──
const SourceDetailRow = ({
  source,
  products,
  allProducts,
  onClose,
  onEdit,
  onDelete,
}: {
  source: Customer;
  products: any[];
  allProducts: Product[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [supplied, setSupplied] = useState<any[]>([]);
  const [showLinkSearch, setShowLinkSearch] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');

  const refresh = () => {
    setLoading(true);
    api.customers.getSuppliedProducts(source.id)
      .then(setSupplied)
      .catch(() => setSupplied([]))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => { refresh(); }, [source.id]);

  return (
    <tr>
      <td colSpan={6} className="p-0">
        <div className="bg-tea-surface/50 border-t border-b border-tea-accent-sub p-5 animate-in slide-in-from-top-1 duration-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-serif text-tea-text">{source.name}</h3>
              <div className="flex items-center gap-3 text-xs text-tea-text-sec mt-1">
                {source.company && <span>{source.company}</span>}
                {source.country && <span className="flex items-center gap-1"><MapPin size={10} /> {source.country}</span>}
                {source.email && <span>{source.email}</span>}
                {source.phone && <span>{source.phone}</span>}
              </div>
              {source.notes && <p className="text-xs text-tea-text-sec mt-2 italic">{source.notes}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onEdit} className="p-1.5 text-tea-text-sec hover:text-tea-text transition-colors" title="Edit"><Edit3 size={14} /></button>
              <button onClick={onDelete} className="p-1.5 text-tea-text-sec hover:text-red-400 transition-colors" title="Delete"><Trash2 size={14} /></button>
              <button onClick={onClose} className="p-1.5 text-tea-text-sec hover:text-tea-text transition-colors"><X size={16} /></button>
            </div>
          </div>

          {/* Supplied teas table */}
          <div className="text-[10px] uppercase tracking-wider text-tea-gold/50 font-bold mb-2 flex items-center gap-2">
            <Leaf size={10} /> Teas Supplied ({loading ? '...' : supplied.length})
          </div>

          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="animate-spin text-tea-text-sec" size={16} /></div>
          ) : (
            <>
              {supplied.length > 0 && (
                <div className="bg-tea-bg rounded-lg border border-tea-border overflow-hidden mb-3">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-tea-border text-tea-text-sec">
                        <th className="text-left px-3 py-2 font-medium">Tea</th>
                        <th className="text-left px-3 py-2 font-medium">Type</th>
                        <th className="text-left px-3 py-2 font-medium">Region</th>
                        <th className="text-right px-3 py-2 font-medium">Stock</th>
                        <th className="text-right px-3 py-2 font-medium">Cost</th>
                        <th className="text-center px-3 py-2 font-medium w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplied.map((p: any) => (
                        <tr key={p.id} className="border-b border-tea-border last:border-0 hover:bg-tea-surface/50 transition-colors">
                          <td className="px-3 py-2">
                            <button
                              onClick={() => navigate(`/admin/inventory?search=${encodeURIComponent(p.given_name || p.product_name || '')}`)}
                              className="text-tea-text hover:text-tea-accent transition-colors flex items-center gap-1.5"
                            >
                              {p.image_url && <img src={p.image_url} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" />}
                              <span className="truncate">{p.given_name || p.product_name}</span>
                              <ExternalLink size={9} className="text-tea-text-sec flex-shrink-0" />
                            </button>
                          </td>
                          <td className="px-3 py-2 text-tea-text-sec uppercase">{p.type}</td>
                          <td className="px-3 py-2 text-tea-text-sec">{p.origin_region || '—'}</td>
                          <td className="px-3 py-2 text-right text-tea-text">{p.stock_grams != null ? `${p.stock_grams}g` : '—'}</td>
                          <td className="px-3 py-2 text-right text-tea-text">
                            {p.cost_amount ? `${p.cost_amount} ${p.cost_currency || ''}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={async () => {
                                await api.customers.unlinkProduct(source.id, p.id);
                                refresh();
                                showToast('Unlinked', 'info');
                              }}
                              className="text-tea-text-sec hover:text-red-400 transition-colors"
                              title="Unlink"
                            >
                              <X size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Link a tea */}
              <div className="relative">
                {!showLinkSearch ? (
                  <button
                    onClick={() => setShowLinkSearch(true)}
                    className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-accent transition-colors"
                  >
                    <Plus size={12} /> Link a tea
                  </button>
                ) : (
                  <div className="bg-tea-bg border border-tea-border rounded-lg shadow-lg overflow-hidden max-w-sm">
                    <div className="p-2 border-b border-tea-border flex items-center gap-2">
                      <Search size={12} className="text-tea-text-sec" />
                      <input
                        type="text"
                        placeholder="Search teas..."
                        value={linkSearch}
                        onChange={e => setLinkSearch(e.target.value)}
                        className="flex-1 bg-transparent text-xs text-tea-text outline-none"
                        autoFocus
                      />
                      <button onClick={() => { setShowLinkSearch(false); setLinkSearch(''); }} className="text-tea-text-sec hover:text-tea-text"><X size={12} /></button>
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {allProducts
                        .filter(p => {
                          const q = linkSearch.toLowerCase();
                          const alreadyLinked = supplied.some((sp: any) => sp.id === p.id);
                          if (alreadyLinked) return false;
                          if (!q) return true;
                          return (p.givenName || '').toLowerCase().includes(q)
                            || (p.productName || '').toLowerCase().includes(q)
                            || (p.type || '').toLowerCase().includes(q);
                        })
                        .slice(0, 15)
                        .map(p => (
                          <button
                            key={p.id}
                            onClick={async () => {
                              await api.customers.linkProduct(source.id, p.id);
                              refresh();
                              setShowLinkSearch(false);
                              setLinkSearch('');
                              showToast(`Linked "${p.givenName || p.productName}"`, 'success');
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-tea-surface transition-colors flex items-center gap-2"
                          >
                            <span className="text-tea-text">{p.givenName || p.productName}</span>
                            <span className="text-[9px] text-tea-text-sec uppercase">{p.type}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};

// ── Main Sources View ──
type SortKey = 'name' | 'country' | 'teaCount' | 'created';
type SortDir = 'asc' | 'desc';

export const SourcesView = () => {
  const { showToast } = useToast();
  const { data: customers = [], isLoading, refetch } = useCustomers();
  const { data: allProducts = [] } = useProducts();

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<Customer | null>(null);

  // Only show vendor-tagged customers
  const sources = useMemo(() => {
    let list = customers.filter(c => c.tags?.includes('vendor'));

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.country?.toLowerCase().includes(q)
      );
    }

    // Count teas per vendor using vendor field on products
    const teaCountMap: Record<string, number> = {};
    for (const p of allProducts) {
      if (p.vendor) {
        const key = p.vendor.toLowerCase();
        for (const c of list) {
          if (c.name.toLowerCase() === key) {
            teaCountMap[c.id] = (teaCountMap[c.id] || 0) + 1;
          }
        }
      }
    }

    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'country': cmp = (a.country || '').localeCompare(b.country || ''); break;
        case 'teaCount': cmp = (teaCountMap[a.id] || 0) - (teaCountMap[b.id] || 0); break;
        case 'created': cmp = (a.createdAt || '').localeCompare(b.createdAt || ''); break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return list.map(c => ({ ...c, teaCount: teaCountMap[c.id] || 0 }));
  }, [customers, allProducts, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={11} className="text-tea-text-sec/40" />;
    return sortDir === 'asc'
      ? <ArrowUp size={11} className="text-tea-gold" />
      : <ArrowDown size={11} className="text-tea-gold" />;
  };

  const handleSave = async (data: { name: string; company: string; country: string; notes: string; phone: string; whatsapp: string; email: string }) => {
    try {
      const payload = { ...data, tags: ['vendor'] as CustomerTag[] };
      if (editingSource) {
        await api.customers.update(editingSource.id, payload);
        showToast('Source updated', 'success');
      } else {
        await api.customers.create(payload);
        showToast('Source added', 'success');
      }
      setIsModalOpen(false);
      setEditingSource(null);
      refetch();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  const handleDelete = async (source: Customer) => {
    if (!confirm(`Delete source "${source.name}"?\n\nProducts will keep the vendor name but the link will be removed.`)) return;
    try {
      await api.customers.delete(source.id);
      showToast('Source deleted', 'success');
      setExpandedId(null);
      refetch();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  if (isLoading) return <div className="p-12 text-center text-tea-text-sec flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-tea-border pb-4">
        <div>
          <h2 className="text-2xl font-serif text-tea-text">Sources</h2>
          <p className="text-tea-text-sec text-sm mt-1">
            {sources.length} vendor{sources.length !== 1 ? 's' : ''} · {allProducts.filter(p => p.vendor).length} teas linked
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-sec" size={14} />
            <input
              type="text"
              placeholder="Search sources..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-tea-surface border border-tea-border rounded-lg pl-9 pr-4 py-2 text-sm text-tea-text outline-none focus:border-tea-text-sec transition-colors w-56"
            />
          </div>
          <button
            onClick={() => { setEditingSource(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-tea-gold text-tea-bg px-4 py-2 rounded-lg text-sm font-medium hover:bg-tea-gold/90 transition-colors"
          >
            <Plus size={16} /> Add Source
          </button>
        </div>
      </div>

      {/* Spreadsheet Table */}
      {sources.length === 0 ? (
        <div className="text-center py-16 text-tea-text-sec">
          <p className="font-serif text-lg mb-2">No sources found</p>
          <p className="text-sm">{search ? 'Try a different search.' : 'Sources are auto-created when you set a vendor on a tea.'}</p>
        </div>
      ) : (
        <div className="bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tea-border bg-tea-bg/50">
                <th className="text-left w-[30%]">
                  <button onClick={() => toggleSort('name')} className="flex items-center gap-1.5 px-4 py-3 text-[10px] uppercase tracking-wider text-tea-text-sec font-bold hover:text-tea-text transition-colors w-full">
                    Source <SortIcon col="name" />
                  </button>
                </th>
                <th className="text-left w-[18%]">
                  <button onClick={() => toggleSort('country')} className="flex items-center gap-1.5 px-4 py-3 text-[10px] uppercase tracking-wider text-tea-text-sec font-bold hover:text-tea-text transition-colors w-full">
                    Country <SortIcon col="country" />
                  </button>
                </th>
                <th className="text-left w-[18%]">
                  <span className="px-4 py-3 text-[10px] uppercase tracking-wider text-tea-text-sec font-bold">Contact</span>
                </th>
                <th className="text-center w-[12%]">
                  <button onClick={() => toggleSort('teaCount')} className="flex items-center justify-center gap-1.5 px-4 py-3 text-[10px] uppercase tracking-wider text-tea-text-sec font-bold hover:text-tea-text transition-colors w-full">
                    Teas <SortIcon col="teaCount" />
                  </button>
                </th>
                <th className="text-left w-[15%]">
                  <button onClick={() => toggleSort('created')} className="flex items-center gap-1.5 px-4 py-3 text-[10px] uppercase tracking-wider text-tea-text-sec font-bold hover:text-tea-text transition-colors w-full">
                    Added <SortIcon col="created" />
                  </button>
                </th>
                <th className="w-[7%]"></th>
              </tr>
            </thead>
            <tbody>
              {sources.map(source => (
                <React.Fragment key={source.id}>
                  <tr
                    onClick={() => setExpandedId(expandedId === source.id ? null : source.id)}
                    className={`border-b border-tea-border cursor-pointer transition-colors ${
                      expandedId === source.id ? 'bg-tea-gold/5' : 'hover:bg-tea-elevated/30'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-tea-text font-medium">{source.name}</span>
                        {source.company && <span className="text-tea-text-sec text-xs">({source.company})</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {source.country ? (
                        <span className="text-tea-text-sec flex items-center gap-1"><MapPin size={11} /> {source.country}</span>
                      ) : (
                        <span className="text-tea-text-dim">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-tea-text-sec text-xs">
                        {source.phone && <span>{source.phone}</span>}
                        {source.whatsapp && <span>WA: {source.whatsapp}</span>}
                        {source.email && <span>{source.email}</span>}
                        {!source.phone && !source.whatsapp && !source.email && <span className="text-tea-text-dim">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                        source.teaCount > 0 ? 'text-tea-gold' : 'text-tea-text-dim'
                      }`}>
                        <Leaf size={11} /> {source.teaCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-tea-text-sec text-xs">
                      {source.createdAt ? new Date(source.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {expandedId === source.id ? (
                        <ChevronUp size={14} className="text-tea-gold mx-auto" />
                      ) : (
                        <ChevronDown size={14} className="text-tea-text-sec mx-auto" />
                      )}
                    </td>
                  </tr>
                  {expandedId === source.id && (
                    <SourceDetailRow
                      source={source}
                      products={allProducts.filter(p => p.vendor?.toLowerCase() === source.name.toLowerCase())}
                      allProducts={allProducts}
                      onClose={() => setExpandedId(null)}
                      onEdit={() => {
                        setEditingSource(source);
                        setIsModalOpen(true);
                      }}
                      onDelete={() => handleDelete(source)}
                    />
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <SourceModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingSource(null); }}
        onSave={handleSave}
        initialData={editingSource ? {
          name: editingSource.name,
          company: editingSource.company || '',
          country: editingSource.country || '',
          notes: editingSource.notes || '',
          phone: editingSource.phone || '',
          whatsapp: editingSource.whatsapp || '',
          email: editingSource.email || '',
        } : undefined}
        isEditing={!!editingSource}
      />
    </div>
  );
};
