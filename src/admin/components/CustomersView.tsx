import React, { useState, useMemo } from 'react';
import { Search, Plus, X, Eye, Trash2, Edit3, Phone, Mail, MessageCircle, MapPin, Tag, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useCustomers } from '../hooks/useAdminData';
import { useToast } from './Toast';
import { api } from '../../lib/api';
import { Customer, CustomerTag } from '../types';

const TAG_OPTIONS: CustomerTag[] = ['wholesale', 'retail', 'friend', 'vendor', 'vip', 'inactive'];

const TAG_COLORS: Record<CustomerTag, string> = {
  wholesale: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  retail: 'bg-green-500/10 text-green-400 border-green-500/30',
  friend: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  vendor: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  vip: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  inactive: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/30',
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
      <label className="block text-xs text-tea-muted mb-1 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={form[name] as string}
        onChange={e => setForm(prev => ({ ...prev, [name]: e.target.value }))}
        placeholder={placeholder}
        className="w-full bg-tea-bg border border-tea-border rounded-lg px-3 py-2 text-sm text-tea-text outline-none focus:border-tea-muted transition-colors"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-tea-bg border border-tea-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <div className="sticky top-0 bg-tea-bg border-b border-tea-border p-6 flex justify-between items-center z-10">
          <h3 className="text-xl font-serif text-tea-text">{isEditing ? 'Edit Customer' : 'Add Customer'}</h3>
          <button onClick={onClose} className="text-tea-muted hover:text-tea-text transition-colors"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Field label="Name *" name="name" placeholder="Full name" />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Company" name="company" placeholder="Business name" />
            <Field label="Source" name="source" placeholder="e.g. Referral, Online" />
          </div>

          <div className="h-px bg-tea-border my-2" />
          <h4 className="text-xs text-tea-muted uppercase tracking-wider">Contact</h4>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Email" name="email" type="email" placeholder="email@example.com" />
            <Field label="Phone" name="phone" type="tel" placeholder="+1 234 567 8900" />
          </div>

          <Field label="WhatsApp" name="whatsapp" placeholder="WhatsApp number" />

          <div className="h-px bg-tea-border my-2" />
          <h4 className="text-xs text-tea-muted uppercase tracking-wider">Location</h4>

          <Field label="Address" name="address" placeholder="Street address" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="City" name="city" placeholder="City" />
            <Field label="Country" name="country" placeholder="Country" />
          </div>

          <div className="h-px bg-tea-border my-2" />

          <div>
            <label className="block text-xs text-tea-muted mb-2 uppercase tracking-wider">Tags</label>
            <div className="flex flex-wrap gap-2">
              {TAG_OPTIONS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    form.tags.includes(tag)
                      ? TAG_COLORS[tag]
                      : 'border-tea-border text-tea-muted hover:border-tea-muted'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-tea-muted mb-1 uppercase tracking-wider">Preferred Currency</label>
            <select
              value={form.preferred_currency}
              onChange={e => setForm(prev => ({ ...prev, preferred_currency: e.target.value }))}
              className="w-full bg-tea-bg border border-tea-border rounded-lg px-3 py-2 text-sm text-tea-text outline-none focus:border-tea-muted transition-colors"
            >
              {['USD', 'NT', 'Yuan', 'IDR', 'JPY', 'MYR', 'HKD'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-tea-muted mb-1 uppercase tracking-wider">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Private notes about this customer..."
              rows={3}
              className="w-full bg-tea-bg border border-tea-border rounded-lg px-3 py-2 text-sm text-tea-text outline-none focus:border-tea-muted transition-colors resize-none"
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
  customer, onClose, onEdit, onDelete,
}: {
  customer: Customer;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [showOrders, setShowOrders] = useState(true);

  React.useEffect(() => {
    setLoadingOrders(true);
    api.customers.getOrders(customer.id)
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoadingOrders(false));
  }, [customer.id]);

  const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-3 text-sm">
        <span className="text-tea-muted mt-0.5 flex-shrink-0">{icon}</span>
        <div>
          <div className="text-tea-muted text-xs">{label}</div>
          <div className="text-tea-text">{value}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-tea-bg border border-tea-border rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <div className="sticky top-0 bg-tea-bg border-b border-tea-border p-6 flex justify-between items-center z-10">
          <div>
            <h3 className="text-2xl font-serif text-tea-text">{customer.name}</h3>
            {customer.company && <p className="text-tea-muted text-sm">{customer.company}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="p-2 text-tea-muted hover:text-tea-text transition-colors" title="Edit">
              <Edit3 size={16} />
            </button>
            <button onClick={onDelete} className="p-2 text-tea-muted hover:text-red-400 transition-colors" title="Delete">
              <Trash2 size={16} />
            </button>
            <button onClick={onClose} className="p-2 text-tea-muted hover:text-tea-text transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Tags */}
          {customer.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {customer.tags.map(tag => (
                <span key={tag} className={`text-xs px-2.5 py-1 rounded-full border ${TAG_COLORS[tag]}`}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-tea-surface border border-tea-border rounded-xl p-4 text-center">
              <div className="text-2xl font-serif text-tea-accent">{customer.orderCount || 0}</div>
              <div className="text-[10px] text-tea-muted uppercase tracking-wider mt-1">Orders</div>
            </div>
            <div className="bg-tea-surface border border-tea-border rounded-xl p-4 text-center">
              <div className="text-2xl font-serif text-tea-accent">${(customer.totalSpentUSD || 0).toFixed(0)}</div>
              <div className="text-[10px] text-tea-muted uppercase tracking-wider mt-1">Total Spent</div>
            </div>
            <div className="bg-tea-surface border border-tea-border rounded-xl p-4 text-center">
              <div className="text-sm font-serif text-tea-text">
                {customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString() : '—'}
              </div>
              <div className="text-[10px] text-tea-muted uppercase tracking-wider mt-1">Last Order</div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-tea-surface border border-tea-border rounded-xl p-5 space-y-4">
            <h4 className="text-xs uppercase tracking-[0.2em] text-tea-muted">Contact Information</h4>
            <InfoRow icon={<Mail size={14} />} label="Email" value={customer.email} />
            <InfoRow icon={<Phone size={14} />} label="Phone" value={customer.phone} />
            <InfoRow icon={<MessageCircle size={14} />} label="WhatsApp" value={customer.whatsapp} />
            <InfoRow icon={<MapPin size={14} />} label="Location" value={[customer.address, customer.city, customer.country].filter(Boolean).join(', ') || undefined} />
            {!customer.email && !customer.phone && !customer.whatsapp && (
              <p className="text-tea-muted text-sm italic">No contact information on file.</p>
            )}
          </div>

          {/* Notes */}
          {customer.notes && (
            <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
              <h4 className="text-xs uppercase tracking-[0.2em] text-tea-muted mb-3">Notes</h4>
              <p className="text-sm text-tea-text whitespace-pre-wrap leading-relaxed">{customer.notes}</p>
            </div>
          )}

          {/* Order History */}
          <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
            <button
              onClick={() => setShowOrders(!showOrders)}
              className="w-full flex justify-between items-center"
            >
              <h4 className="text-xs uppercase tracking-[0.2em] text-tea-muted">Order History</h4>
              {showOrders ? <ChevronUp size={14} className="text-tea-muted" /> : <ChevronDown size={14} className="text-tea-muted" />}
            </button>

            {showOrders && (
              <div className="mt-4 space-y-2">
                {loadingOrders ? (
                  <div className="flex justify-center py-4"><Loader2 className="animate-spin text-tea-muted" size={16} /></div>
                ) : orders.length === 0 ? (
                  <p className="text-tea-muted text-sm italic">No orders yet.</p>
                ) : (
                  orders.map((order: any) => (
                    <div key={order.id} className="flex justify-between items-center text-sm py-2 border-b border-tea-border last:border-0">
                      <div>
                        <span className="text-tea-text font-medium">{order.invoice_number}</span>
                        <span className="text-tea-muted text-xs ml-2">{new Date(order.created_at).toLocaleDateString()}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium uppercase tracking-wider ${
                        order.status === 'Void' ? 'border-tea-muted/50 text-tea-muted' :
                        order.status === 'Pending' ? 'border-tea-accent/50 text-tea-accent' :
                        'border-tea-text/50 text-tea-text'
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
          <div className="text-xs text-tea-muted/50 space-y-1">
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
  const { showToast } = useToast();
  const { data: customers = [], isLoading, refetch } = useCustomers();

  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState<CustomerTag | ''>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);

  const filtered = useMemo(() => {
    let list = customers;
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
    return list;
  }, [customers, search, filterTag]);

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

  if (isLoading) return <div className="p-12 text-center text-tea-muted flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-tea-border pb-6">
        <div>
          <h2 className="text-2xl font-serif text-tea-text">Customers & Sources</h2>
          <p className="text-tea-muted text-sm mt-1">
            {customers.length} contact{customers.length !== 1 ? 's' : ''} on file
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-muted" size={16} />
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-tea-surface border border-tea-border rounded-lg pl-10 pr-4 py-2 text-sm text-tea-text outline-none focus:border-tea-muted transition-colors"
            />
          </div>
          <select
            value={filterTag}
            onChange={e => setFilterTag(e.target.value as CustomerTag | '')}
            className="bg-tea-surface border border-tea-border rounded-lg px-3 py-2 text-sm text-tea-text outline-none focus:border-tea-muted transition-colors"
          >
            <option value="">All Tags</option>
            {TAG_OPTIONS.map(tag => <option key={tag} value={tag}>{tag}</option>)}
          </select>
          <button
            onClick={() => { setEditingCustomer(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-tea-accent text-tea-bg px-4 py-2 rounded-lg text-sm font-medium hover:bg-tea-accent/90 transition-colors"
          >
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      {/* Customer Cards Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-tea-muted">
          <p className="font-serif text-lg mb-2">No customers found</p>
          <p className="text-sm">{search || filterTag ? 'Try adjusting your search or filter.' : 'Add your first customer to get started.'}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(customer => (
            <div
              key={customer.id}
              onClick={() => setViewingCustomer(customer)}
              className="bg-tea-surface border border-tea-border rounded-xl p-5 cursor-pointer hover:border-tea-muted/50 hover:bg-tea-surface/80 transition-all group"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-tea-text font-medium group-hover:text-tea-accent transition-colors">{customer.name}</h3>
                  {customer.company && <p className="text-tea-muted text-xs">{customer.company}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={e => { e.stopPropagation(); openEdit(customer); }}
                    className="p-1.5 text-tea-muted hover:text-tea-text transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Edit3 size={14} />
                  </button>
                </div>
              </div>

              {/* Tags */}
              {customer.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {customer.tags.map(tag => (
                    <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full border ${TAG_COLORS[tag]}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Contact icons */}
              <div className="flex items-center gap-3 text-tea-muted mb-3">
                {customer.email && <Mail size={12} />}
                {customer.phone && <Phone size={12} />}
                {customer.whatsapp && <MessageCircle size={12} />}
                {customer.country && (
                  <span className="text-xs flex items-center gap-1">
                    <MapPin size={10} /> {customer.country}
                  </span>
                )}
              </div>

              {/* Stats row */}
              <div className="flex justify-between items-center text-xs text-tea-muted border-t border-tea-border pt-3 mt-auto">
                <span>{customer.orderCount || 0} order{(customer.orderCount || 0) !== 1 ? 's' : ''}</span>
                <span className="font-medium text-tea-text">${(customer.totalSpentUSD || 0).toFixed(0)} spent</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingCustomer(null); }}
        onSave={handleSave}
        initialData={editingCustomer ? formDataFromCustomer(editingCustomer) : undefined}
        isEditing={!!editingCustomer}
      />

      {/* Detail Panel */}
      {viewingCustomer && (
        <CustomerDetail
          customer={viewingCustomer}
          onClose={() => setViewingCustomer(null)}
          onEdit={() => openEdit(viewingCustomer)}
          onDelete={() => handleDelete(viewingCustomer)}
        />
      )}
    </div>
  );
};
