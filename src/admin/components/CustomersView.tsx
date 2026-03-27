import React, { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Plus, X, Trash2, Edit3, Phone, Mail, MessageCircle, MapPin, Loader2, ChevronDown, ChevronUp, Leaf, ExternalLink, Users, ArrowUpDown, Check } from 'lucide-react';
import { useCustomers, useProducts } from '../hooks/useAdminData';
import { useToast } from './Toast';
import { api } from '../../lib/api';
import { Customer, CustomerTag } from '../types';

const TAG_OPTIONS: CustomerTag[] = ['wholesale', 'retail', 'friend', 'vendor', 'vip', 'inactive'];

const TAG_COLORS: Record<CustomerTag, string> = {
  wholesale: 'bg-blue-500/10 text-blue-400',
  retail: 'bg-green-500/10 text-green-400',
  friend: 'bg-purple-500/10 text-purple-400',
  vendor: 'bg-orange-500/10 text-orange-400',
  vip: 'bg-yellow-500/10 text-yellow-400',
  inactive: 'bg-tea-text-sec/10 text-tea-text-sec',
};

interface CustomerFormData {
  name: string;
  company: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  city: string;
  country: string;
  preferred_currency: string;
  tags: CustomerTag[];
  notes: string;
  source: string;
}

const emptyForm: CustomerFormData = {
  name: '', company: '', email: '', phone: '', whatsapp: '',
  address: '', city: '', country: '', preferred_currency: 'USD',
  tags: [], notes: '', source: '',
};

// ── Add/Edit Customer Modal ──
const CustomerModal = ({
  isOpen, onClose, onSave, initialData, isEditing,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CustomerFormData) => Promise<void>;
  initialData?: CustomerFormData;
  isEditing: boolean;
}) => {
  const [form, setForm] = useState<CustomerFormData>(initialData || emptyForm);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setForm(initialData || emptyForm);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const toggleTag = (tag: CustomerTag) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const Field = ({ label, name, type = 'text', placeholder }: { label: string; name: keyof CustomerFormData; type?: string; placeholder?: string }) => (
    <div>
      <label className="block text-xs text-tea-text-sec mb-1 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={form[name] as string}
        onChange={e => setForm(prev => ({ ...prev, [name]: e.target.value }))}
        placeholder={placeholder}
        className="w-full bg-tea-bg border border-tea-border rounded-lg px-3 py-2 text-sm text-tea-text outline-none focus:border-tea-text-sec transition-colors"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-tea-text/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-tea-bg border border-tea-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <div className="sticky top-0 bg-tea-bg border-b border-tea-border p-6 flex justify-between items-center z-10">
          <h3 className="text-xl font-serif text-tea-text">{isEditing ? 'Edit Customer' : 'Add Customer'}</h3>
          <button onClick={onClose} className="text-tea-text-sec hover:text-tea-text transition-colors"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Field label="Name *" name="name" placeholder="Full name" />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Company" name="company" placeholder="Business name" />
            <Field label="Source" name="source" placeholder="e.g. Referral, Online" />
          </div>

          <div className="h-px bg-tea-border my-2" />
          <h4 className="text-xs text-tea-text-sec uppercase tracking-wider">Contact</h4>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Email" name="email" type="email" placeholder="email@example.com" />
            <Field label="Phone" name="phone" type="tel" placeholder="+1 234 567 8900" />
          </div>

          <Field label="WhatsApp" name="whatsapp" placeholder="WhatsApp number" />

          <div className="h-px bg-tea-border my-2" />
          <h4 className="text-xs text-tea-text-sec uppercase tracking-wider">Location</h4>

          <Field label="Address" name="address" placeholder="Street address" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="City" name="city" placeholder="City" />
            <Field label="Country" name="country" placeholder="Country" />
          </div>

          <div className="h-px bg-tea-border my-2" />

          <div>
            <label className="block text-xs text-tea-text-sec mb-2 uppercase tracking-wider">Tags</label>
            <div className="flex flex-wrap gap-2">
              {TAG_OPTIONS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    form.tags.includes(tag)
                      ? TAG_COLORS[tag]
                      : 'border-tea-border text-tea-text-sec hover:border-tea-text-sec'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-tea-text-sec mb-1 uppercase tracking-wider">Preferred Currency</label>
            <select
              value={form.preferred_currency}
              onChange={e => setForm(prev => ({ ...prev, preferred_currency: e.target.value }))}
              className="w-full bg-tea-bg border border-tea-border rounded-lg px-3 py-2 text-sm text-tea-text outline-none focus:border-tea-text-sec transition-colors"
            >
              {['USD', 'NT', 'Yuan', 'IDR', 'JPY', 'MYR', 'HKD'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-tea-text-sec mb-1 uppercase tracking-wider">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Private notes about this customer..."
              rows={3}
              className="w-full bg-tea-bg border border-tea-border rounded-lg px-3 py-2 text-sm text-tea-text outline-none focus:border-tea-text-sec transition-colors resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !form.name.trim()}
            className="w-full py-3 bg-tea-accent hover:bg-tea-accent/90 text-tea-bg font-bold uppercase tracking-[0.2em] text-xs rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : isEditing ? 'Update Customer' : 'Add Customer'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ── Customer Detail Panel ──
const CustomerDetail = ({
  customer, onClose, onEdit, onDelete, allProducts,
}: {
  customer: Customer;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  allProducts?: any[];
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [teas, setTeas] = useState<any[]>([]);
  const [suppliedProducts, setSuppliedProducts] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingTeas, setLoadingTeas] = useState(true);
  const [loadingSupplied, setLoadingSupplied] = useState(true);
  const [showOrders, setShowOrders] = useState(true);
  const [showTeas, setShowTeas] = useState(true);
  const [showSupplied, setShowSupplied] = useState(true);
  const [showLinkDropdown, setShowLinkDropdown] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');

  const isVendor = customer.tags.includes('vendor');

  const refreshSupplied = () => {
    setLoadingSupplied(true);
    api.customers.getSuppliedProducts(customer.id)
      .then(setSuppliedProducts)
      .catch(() => setSuppliedProducts([]))
      .finally(() => setLoadingSupplied(false));
  };

  React.useEffect(() => {
    setLoadingOrders(true);
    setLoadingTeas(true);
    api.customers.getOrders(customer.id)
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoadingOrders(false));
    api.customers.getTeas(customer.id)
      .then(setTeas)
      .catch(() => setTeas([]))
      .finally(() => setLoadingTeas(false));
    if (isVendor) refreshSupplied();
    else setLoadingSupplied(false);
  }, [customer.id]);

  const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-3 text-sm">
        <span className="text-tea-text-sec mt-0.5 flex-shrink-0">{icon}</span>
        <div>
          <div className="text-tea-text-sec text-xs">{label}</div>
          <div className="text-tea-text">{value}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-tea-text/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-tea-bg border border-tea-border rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <div className="sticky top-0 bg-tea-bg border-b border-tea-border p-6 flex justify-between items-center z-10">
          <div>
            <h3 className="text-2xl font-serif text-tea-text">{customer.name}</h3>
            {customer.company && <p className="text-tea-text-sec text-sm">{customer.company}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="p-2 text-tea-text-sec hover:text-tea-text transition-colors" title="Edit">
              <Edit3 size={16} />
            </button>
            <button onClick={onDelete} className="p-2 text-tea-text-sec hover:text-red-400 transition-colors" title="Delete">
              <Trash2 size={16} />
            </button>
            <button onClick={onClose} className="p-2 text-tea-text-sec hover:text-tea-text transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Tags */}
          {customer.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {customer.tags.map(tag => (
                <span key={tag} className={`text-xs px-2.5 py-1 rounded-full ${TAG_COLORS[tag]}`}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-tea-surface border border-tea-border rounded-xl p-4 text-center">
              <div className="text-2xl font-serif text-tea-accent">{customer.orderCount || 0}</div>
              <div className="text-[10px] text-tea-text-sec uppercase tracking-wider mt-1">Orders</div>
            </div>
            <div className="bg-tea-surface border border-tea-border rounded-xl p-4 text-center">
              <div className="text-2xl font-serif text-tea-accent">${(customer.totalSpentUSD || 0).toFixed(0)}</div>
              <div className="text-[10px] text-tea-text-sec uppercase tracking-wider mt-1">Total Spent</div>
            </div>
            <div className="bg-tea-surface border border-tea-border rounded-xl p-4 text-center">
              <div className="text-sm font-serif text-tea-text">
                {customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString() : '—'}
              </div>
              <div className="text-[10px] text-tea-text-sec uppercase tracking-wider mt-1">Last Order</div>
            </div>
          </div>

          {/* Teas Supplied (for vendor contacts) */}
          {isVendor && (
            <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
              <button
                onClick={() => setShowSupplied(!showSupplied)}
                className="w-full flex justify-between items-center"
              >
                <h4 className="text-xs uppercase tracking-[0.2em] text-tea-text-sec flex items-center gap-2">
                  <Leaf size={12} /> Teas Supplied
                  {!loadingSupplied && <span className="text-tea-accent">({suppliedProducts.length})</span>}
                </h4>
                {showSupplied ? <ChevronUp size={14} className="text-tea-text-sec" /> : <ChevronDown size={14} className="text-tea-text-sec" />}
              </button>

              {showSupplied && (
                <div className="mt-4">
                  {loadingSupplied ? (
                    <div className="flex justify-center py-4"><Loader2 className="animate-spin text-tea-text-sec" size={16} /></div>
                  ) : (
                    <>
                      {suppliedProducts.length > 0 && (
                        <div className="space-y-2 mb-4">
                          {suppliedProducts.map((p: any) => (
                            <div key={p.id} className="flex items-center gap-3 py-2 border-b border-tea-border last:border-0">
                              {p.image_url ? (
                                <img src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-tea-bg flex items-center justify-center flex-shrink-0">
                                  <Leaf size={14} className="text-tea-text-sec" />
                                </div>
                              )}
                              <button
                                onClick={() => { onClose(); navigate(`/admin/inventory?search=${encodeURIComponent(p.given_name || p.product_name || '')}`); }}
                                className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                                title="View in Inventory"
                              >
                                <div className="text-sm text-tea-text font-medium truncate hover:text-tea-accent transition-colors">
                                  {p.given_name || p.product_name}
                                </div>
                                <div className="text-xs text-tea-text-sec flex items-center gap-2">
                                  <span className="uppercase">{p.type}</span>
                                  {p.origin_region && <span>· {p.origin_region}</span>}
                                  {p.stock_grams != null && <span>· {p.stock_grams}g in stock</span>}
                                </div>
                              </button>
                              <button
                                onClick={async () => {
                                  await api.customers.unlinkProduct(customer.id, p.id);
                                  refreshSupplied();
                                  showToast('Product unlinked', 'info');
                                }}
                                className="text-tea-text-sec hover:text-red-400 transition-colors p-1"
                                title="Unlink from this vendor"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Link a product */}
                      <div className="relative">
                        <button
                          onClick={() => setShowLinkDropdown(!showLinkDropdown)}
                          className="flex items-center gap-2 text-xs text-tea-text-sec hover:text-tea-accent transition-colors"
                        >
                          <Plus size={12} /> Link a tea to this vendor
                        </button>

                        {showLinkDropdown && allProducts && (
                          <div className="absolute left-0 top-full mt-2 w-full bg-tea-bg border border-tea-border rounded-xl shadow-2xl z-20 max-h-60 overflow-y-auto">
                            <div className="sticky top-0 bg-tea-bg p-2 border-b border-tea-border">
                              <input
                                type="text"
                                placeholder="Search teas..."
                                value={linkSearch}
                                onChange={e => setLinkSearch(e.target.value)}
                                className="w-full bg-tea-surface border border-tea-border rounded-lg px-3 py-1.5 text-xs text-tea-text outline-none"
                                autoFocus
                              />
                            </div>
                            {allProducts
                              .filter(p => {
                                const q = linkSearch.toLowerCase();
                                const alreadyLinked = suppliedProducts.some((sp: any) => sp.id === p.id);
                                if (alreadyLinked) return false;
                                if (!q) return true;
                                return (p.givenName || '').toLowerCase().includes(q)
                                  || (p.productName || '').toLowerCase().includes(q)
                                  || (p.type || '').toLowerCase().includes(q);
                              })
                              .slice(0, 20)
                              .map(p => (
                                <button
                                  key={p.id}
                                  onClick={async () => {
                                    await api.customers.linkProduct(customer.id, p.id);
                                    refreshSupplied();
                                    setShowLinkDropdown(false);
                                    setLinkSearch('');
                                    showToast(`Linked "${p.givenName || p.productName}"`, 'success');
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-tea-surface transition-colors flex items-center gap-2"
                                >
                                  <span className="text-tea-text">{p.givenName || p.productName}</span>
                                  <span className="text-[10px] text-tea-text-sec uppercase">{p.type}</span>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Contact Info */}
          <div className="bg-tea-surface border border-tea-border rounded-xl p-5 space-y-4">
            <h4 className="text-xs uppercase tracking-[0.2em] text-tea-text-sec">Contact Information</h4>
            <InfoRow icon={<Mail size={14} />} label="Email" value={customer.email} />
            <InfoRow icon={<Phone size={14} />} label="Phone" value={customer.phone} />
            <InfoRow icon={<MessageCircle size={14} />} label="WhatsApp" value={customer.whatsapp} />
            <InfoRow icon={<MapPin size={14} />} label="Location" value={[customer.address, customer.city, customer.country].filter(Boolean).join(', ') || undefined} />
            {!customer.email && !customer.phone && !customer.whatsapp && (
              <p className="text-tea-text-sec text-sm italic">No contact information on file.</p>
            )}
          </div>

          {/* Notes */}
          {customer.notes && (
            <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
              <h4 className="text-xs uppercase tracking-[0.2em] text-tea-text-sec mb-3">Notes</h4>
              <p className="text-sm text-tea-text whitespace-pre-wrap leading-relaxed">{customer.notes}</p>
            </div>
          )}

          {/* Teas Purchased */}
          <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
            <button
              onClick={() => setShowTeas(!showTeas)}
              className="w-full flex justify-between items-center"
            >
              <h4 className="text-xs uppercase tracking-[0.2em] text-tea-text-sec flex items-center gap-2">
                <Leaf size={12} /> Teas Purchased
              </h4>
              {showTeas ? <ChevronUp size={14} className="text-tea-text-sec" /> : <ChevronDown size={14} className="text-tea-text-sec" />}
            </button>

            {showTeas && (
              <div className="mt-4 space-y-3">
                {loadingTeas ? (
                  <div className="flex justify-center py-4"><Loader2 className="animate-spin text-tea-text-sec" size={16} /></div>
                ) : teas.length === 0 ? (
                  <p className="text-tea-text-sec text-sm italic">No tea purchases yet.</p>
                ) : (
                  teas.map((tea: any) => (
                    <div key={tea.id} className="flex items-center gap-3 py-2 border-b border-tea-border last:border-0">
                      {tea.image_url ? (
                        <img src={tea.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-tea-bg flex items-center justify-center flex-shrink-0">
                          <Leaf size={14} className="text-tea-text-sec" />
                        </div>
                      )}
                      <button
                        onClick={() => { onClose(); navigate(`/admin/inventory?search=${encodeURIComponent(tea.given_name || tea.product_name || '')}`); }}
                        className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                        title="View in Inventory"
                      >
                        <div className="text-sm text-tea-text font-medium truncate hover:text-tea-accent transition-colors">
                          {tea.given_name || tea.product_name}
                        </div>
                        <div className="text-xs text-tea-text-sec flex items-center gap-2">
                          <span className="uppercase">{tea.type}</span>
                          {tea.origin_region && <span>· {tea.origin_region}</span>}
                        </div>
                      </button>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm text-tea-text">{tea.total_quantity}g</div>
                        <div className="text-[10px] text-tea-text-sec">
                          {tea.order_count} order{tea.order_count !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Order History */}
          <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
            <button
              onClick={() => setShowOrders(!showOrders)}
              className="w-full flex justify-between items-center"
            >
              <h4 className="text-xs uppercase tracking-[0.2em] text-tea-text-sec">Order History</h4>
              {showOrders ? <ChevronUp size={14} className="text-tea-text-sec" /> : <ChevronDown size={14} className="text-tea-text-sec" />}
            </button>

            {showOrders && (
              <div className="mt-4 space-y-2">
                {loadingOrders ? (
                  <div className="flex justify-center py-4"><Loader2 className="animate-spin text-tea-text-sec" size={16} /></div>
                ) : orders.length === 0 ? (
                  <p className="text-tea-text-sec text-sm italic">No orders yet.</p>
                ) : (
                  orders.map((order: any) => (
                    <div key={order.id} className="flex justify-between items-center text-sm py-2 border-b border-tea-border last:border-0">
                      <div>
                        <button
                          onClick={() => { onClose(); navigate(`/admin/orders?search=${encodeURIComponent(order.invoice_number || '')}`); }}
                          className="text-tea-text font-medium hover:text-tea-accent transition-colors inline-flex items-center gap-1"
                          title="View in Orders"
                        >
                          {order.invoice_number}
                          <ExternalLink size={10} className="opacity-0 group-hover:opacity-100" />
                        </button>
                        <span className="text-tea-text-sec text-xs ml-2">{new Date(order.created_at).toLocaleDateString()}</span>
                      </div>
                      <span className={`badge-status ${
                        order.status === 'Void' ? 'badge-status-muted' :
                        order.status === 'Pending' ? 'badge-status-gold' :
                        'badge-status-default'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="text-xs text-tea-text-sec/50 space-y-1">
            {customer.source && <p>Source: {customer.source}</p>}
            <p>Added: {new Date(customer.createdAt).toLocaleDateString()}</p>
            <p>Currency: {customer.preferredCurrency}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main CustomersView ──
export const CustomersView = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { data: customers = [], isLoading, refetch } = useCustomers();
  const { data: allProducts = [] } = useProducts();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [filterTag, setFilterTag] = useState<CustomerTag | ''>('');
  const [sortBy, setSortBy] = useState<'name' | 'recent' | 'spent' | 'orders'>('name');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);

  // Exclude vendor-only customers (they appear in Sources view)
  const nonVendorCustomers = useMemo(() => {
    return customers.filter(c => {
      // Keep customers that have tags other than just 'vendor', or no vendor tag at all
      const hasNonVendorTag = c.tags.some((t: string) => t !== 'vendor');
      const isVendorOnly = c.tags.length === 1 && c.tags[0] === 'vendor';
      return !isVendorOnly;
    });
  }, [customers]);

  const filtered = useMemo(() => {
    let list = nonVendorCustomers;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.whatsapp?.includes(q) ||
        c.country?.toLowerCase().includes(q)
      );
    }
    if (filterTag) {
      list = list.filter(c => c.tags.includes(filterTag));
    }
    // Sort
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return (b.lastOrderDate || '').localeCompare(a.lastOrderDate || '');
        case 'spent':
          return (b.totalSpentUSD || 0) - (a.totalSpentUSD || 0);
        case 'orders':
          return (b.orderCount || 0) - (a.orderCount || 0);
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return list;
  }, [nonVendorCustomers, search, filterTag, sortBy]);

  const handleSave = async (data: CustomerFormData) => {
    try {
      if (editingCustomer) {
        await api.customers.update(editingCustomer.id, data);
        showToast('Customer updated', 'success');
      } else {
        await api.customers.create(data);
        showToast('Customer added', 'success');
      }
      setIsModalOpen(false);
      setEditingCustomer(null);
      refetch();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  const handleDelete = async (customer: Customer) => {
    if (!confirm(`Delete customer "${customer.name}"?\n\nTheir invoices will be preserved but unlinked.`)) return;
    try {
      await api.customers.delete(customer.id);
      showToast('Customer deleted', 'success');
      setViewingCustomer(null);
      refetch();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setViewingCustomer(null);
    setIsModalOpen(true);
  };

  const formDataFromCustomer = (c: Customer): CustomerFormData => ({
    name: c.name,
    company: c.company || '',
    email: c.email || '',
    phone: c.phone || '',
    whatsapp: c.whatsapp || '',
    address: c.address || '',
    city: c.city || '',
    country: c.country || '',
    preferred_currency: c.preferredCurrency,
    tags: c.tags,
    notes: c.notes || '',
    source: c.source || '',
  });

  // Mobile sort/filter menus
  const [showMobileSort, setShowMobileSort] = useState(false);
  const [showMobileFilter, setShowMobileFilter] = useState(false);

  if (isLoading) return <div className="p-12 text-center text-tea-text-sec flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">

      {/* --- STICKY HEADER --- */}
      <div className="sticky top-0 z-30 bg-tea-bg/90 backdrop-blur-md border-b border-tea-border py-2.5 flex-shrink-0">
        <div className="px-3 md:px-6 max-w-7xl mx-auto flex items-center gap-3 md:gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Users size={16} className="text-tea-accent" />
            <h2 className="text-sm font-serif text-tea-text uppercase tracking-[0.15em] hidden md:block">Customers</h2>
            <span className="text-tea-text-sec text-xs tracking-wide hidden md:inline">
              — {filtered.length} contact{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Tag filter pills — scrollable on mobile */}
          <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar md:ml-2">
            <button
              onClick={() => setFilterTag('')}
              className={filterTag === '' ? 'pill-active' : 'pill'}
            >
              All
              <span className="text-[9px] opacity-70 ml-0.5">{nonVendorCustomers.length}</span>
            </button>
            {TAG_OPTIONS.map(tag => {
              const count = nonVendorCustomers.filter(c => c.tags.includes(tag)).length;
              if (count === 0) return null;
              return (
                <button
                  key={tag}
                  onClick={() => setFilterTag(tag === filterTag ? '' : tag)}
                  className={filterTag === tag ? 'pill-active' : 'pill'}
                >
                  {tag}
                  <span className="text-[9px] opacity-70 ml-0.5">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1 ml-auto shrink-0">
            {/* Sort (mobile dropdown, desktop inline) */}
            <div className="relative">
              <button
                onClick={() => { setShowMobileSort(!showMobileSort); setShowMobileFilter(false); }}
                className={`w-9 h-9 flex items-center justify-center transition-colors rounded-md md:hidden ${showMobileSort ? 'text-tea-accent' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
              >
                <ArrowUpDown size={15} />
              </button>
              {/* Desktop sort dropdown */}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="hidden md:block bg-transparent border-b border-tea-border text-xs text-tea-text outline-none focus:border-tea-text-sec transition-colors py-1 pr-6 cursor-pointer"
              >
                <option value="name">Name</option>
                <option value="recent">Recent</option>
                <option value="spent">Top Spent</option>
                <option value="orders">Most Orders</option>
              </select>
              {/* Mobile sort dropdown */}
              {showMobileSort && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMobileSort(false)} />
                  <div className="absolute right-0 top-9 w-40 bg-tea-surface border border-tea-border shadow-2xl rounded-xl z-50 py-1" role="menu">
                    {([
                      { key: 'name', label: 'Name' },
                      { key: 'recent', label: 'Recent' },
                      { key: 'spent', label: 'Top Spent' },
                      { key: 'orders', label: 'Most Orders' },
                    ] as const).map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => { setSortBy(opt.key); setShowMobileSort(false); }}
                        className={`w-full px-3 py-2 text-left text-[11px] flex items-center gap-2 hover:bg-tea-bg transition-colors ${sortBy === opt.key ? 'text-tea-accent' : 'text-tea-text-sec'}`}
                      >
                        {opt.label}
                        {sortBy === opt.key && <Check size={12} className="ml-auto" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Search */}
            <div className="relative w-32 md:w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tea-text-sec" size={14} />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-transparent border-b border-tea-border rounded-none pl-8 pr-3 py-1.5 text-xs text-tea-text outline-none focus:border-tea-text-sec font-serif placeholder-tea-text-sec/50 transition-colors"
              />
            </div>

            {/* Add button */}
            <button
              onClick={() => { setEditingCustomer(null); setIsModalOpen(true); }}
              className="w-9 h-9 flex items-center justify-center text-tea-text-sec hover:text-tea-accent transition-colors rounded-md md:hidden"
              title="Add customer"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => { setEditingCustomer(null); setIsModalOpen(true); }}
              className="hidden md:flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-bold text-tea-text-sec hover:text-tea-text transition-colors px-3 py-1.5 border border-transparent hover:border-tea-border rounded-lg"
            >
              <Plus size={14} /> New
            </button>
          </div>
        </div>
      </div>

      {/* --- CONTENT --- */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-tea-bg md:px-6">

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-tea-text-sec">
            <Users size={32} strokeWidth={1} className="opacity-40" />
            <span className="font-serif italic">{search || filterTag ? 'No matching customers' : 'No customers yet'}</span>
            {(search || filterTag) && (
              <button onClick={() => { setSearch(''); setFilterTag(''); }} className="text-xs text-tea-gold hover:text-tea-gold/80 transition-colors">
                Clear filters
              </button>
            )}
            {search && !filterTag && (
              <button
                onClick={() => { setEditingCustomer(null); setIsModalOpen(true); }}
                className="text-xs text-tea-gold hover:text-tea-gold/80 transition-colors mt-1"
              >
                Add "{search}" as new customer
              </button>
            )}
          </div>
        ) : (
          <>
            {/* MOBILE LIST — compact rows like OrdersView */}
            <div className="md:hidden pb-24">
              {filtered.map((customer, idx) => (
                <button
                  key={customer.id}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors active:bg-tea-surface/80 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-tea-surface/20'}`}
                  onClick={() => setViewingCustomer(customer)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-tea-text text-sm font-serif truncate">{customer.name}</span>
                      {customer.tags.length > 0 && (
                        <span className={`text-[9px] px-1.5 py-0 rounded-full ${TAG_COLORS[customer.tags[0]]}`}>
                          {customer.tags[0]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-tea-text-sec/70 mt-0.5">
                      {customer.company && <span className="truncate">{customer.company}</span>}
                      {customer.company && customer.country && <span className="opacity-40">·</span>}
                      {customer.country && (
                        <span className="flex items-center gap-0.5"><MapPin size={8} /> {customer.country}</span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs text-tea-text tabular-nums">${(customer.totalSpentUSD || 0).toFixed(0)}</div>
                    <div className="text-[10px] text-tea-text-sec/60 tabular-nums">
                      {customer.orderCount || 0} order{(customer.orderCount || 0) !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Contact icons */}
                  <div className="flex flex-col items-center gap-0.5 text-tea-text-sec/40 flex-shrink-0">
                    {customer.email && <Mail size={10} />}
                    {customer.phone && <Phone size={10} />}
                    {customer.whatsapp && <MessageCircle size={10} />}
                  </div>
                </button>
              ))}
            </div>

            {/* DESKTOP CARD GRID */}
            <div className="hidden md:block py-6 max-w-7xl mx-auto">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map(customer => (
                  <div
                    key={customer.id}
                    onClick={() => setViewingCustomer(customer)}
                    className="bg-tea-surface border border-tea-border rounded-xl p-5 cursor-pointer hover:border-tea-text-sec/50 hover:bg-tea-surface/80 transition-all group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-tea-text font-medium group-hover:text-tea-accent transition-colors">{customer.name}</h3>
                        {customer.company && <p className="text-tea-text-sec text-xs">{customer.company}</p>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={e => { e.stopPropagation(); openEdit(customer); }}
                          className="p-1.5 text-tea-text-sec hover:text-tea-text transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Edit3 size={14} />
                        </button>
                      </div>
                    </div>

                    {customer.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {customer.tags.map(tag => (
                          <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full ${TAG_COLORS[tag]}`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-tea-text-sec mb-3">
                      {customer.email && <Mail size={12} />}
                      {customer.phone && <Phone size={12} />}
                      {customer.whatsapp && <MessageCircle size={12} />}
                      {customer.country && (
                        <span className="text-xs flex items-center gap-1">
                          <MapPin size={10} /> {customer.country}
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-xs text-tea-text-sec border-t border-tea-border pt-3 mt-auto">
                      <span>{customer.orderCount || 0} order{(customer.orderCount || 0) !== 1 ? 's' : ''}</span>
                      <span className="font-medium text-tea-text">${(customer.totalSpentUSD || 0).toFixed(0)} spent</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingCustomer(null); }}
        onSave={handleSave}
        initialData={editingCustomer ? formDataFromCustomer(editingCustomer) : (search && !editingCustomer ? { ...emptyForm, name: search } : undefined)}
        isEditing={!!editingCustomer}
      />

      {/* Detail Panel */}
      {viewingCustomer && (
        <CustomerDetail
          customer={viewingCustomer}
          onClose={() => setViewingCustomer(null)}
          onEdit={() => openEdit(viewingCustomer)}
          onDelete={() => handleDelete(viewingCustomer)}
          allProducts={allProducts}
        />
      )}
    </div>
  );
};
