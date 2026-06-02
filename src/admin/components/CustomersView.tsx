import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Plus, X, Trash2, Edit3, Phone, Mail, MessageCircle, MapPin, Loader2, ChevronDown, ChevronUp, Leaf, ExternalLink, Users, ArrowUpDown, ArrowUp, ArrowDown, Check, Calendar, Link, AtSign, Send, Lock, Hash, MessagesSquare, Columns, Download, MoreHorizontal } from 'lucide-react';
import Papa from 'papaparse';
import { useCustomers, useProducts } from '../hooks/useAdminData';
import { useToast } from './Toast';
import { api } from '../../lib/api';
import { CONTACT_RELATIONSHIP_ORDER, CONTACT_RELATIONSHIP_TAXONOMY } from '../../lib/contactTaxonomy';
import { Customer, CustomerTag, ContactType, ContactChannel, ContactEntry, ContactRelationshipKind, Product, Invoice } from '../types';
import { useSampleStore } from '../../samples/sampleStore';
import { SAMPLE_STATUS_CONFIG } from '../../samples/types';
import { STATUS_PILL_BASE, STATUS_PILL_VARIANTS, type StatusPillVariant } from '../constants';
import { ConfirmModal } from './ConfirmModal';

/** Canonical status pill — see DesignSystemShowcase §8 */
const StatusPill: React.FC<{ variant?: StatusPillVariant; className?: string; children: React.ReactNode }> = ({
  variant = 'draft',
  className = '',
  children,
}) => (
  <span className={`${STATUS_PILL_BASE} ${STATUS_PILL_VARIANTS[variant]} ${className}`}>{children}</span>
);

/** Two-letter initials for the identity-card avatar */
function customerInitials(name: string | undefined): string {
  if (!name) return '·';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Map a CustomerTag to a canonical StatusPill variant */
function tagVariant(tag: CustomerTag | string): StatusPillVariant {
  switch (tag) {
    case 'vip':
    case 'wholesale':
    case 'friend':
    case 'vendor':
      return 'active';
    case 'inactive':
      return 'archived';
    default:
      return 'draft';
  }
}

/** Map a ContactRelationshipKind to a canonical StatusPill variant */
function relationshipVariant(kind: ContactRelationshipKind): StatusPillVariant {
  switch (kind) {
    case 'buyer':
    case 'vendor':
      return 'active';
    case 'event_guest':
    case 'collection_recipient':
    case 'contributor':
    default:
      return 'draft';
  }
}

/** Vendor-supplied product row from api.customers.getSuppliedProducts() */
interface SuppliedProduct {
  id: string;
  given_name?: string;
  product_name?: string;
  type?: string;
  origin_region?: string;
  stock_grams?: number;
  cost_per_gram?: number;
  cost_amount?: number;
  image_url?: string;
  year?: number;
  last_ordered_date?: string;
}

/** Tea history row from api.customers.getTeas() */
interface CustomerTea {
  id: string;
  given_name?: string;
  product_name?: string;
  type?: string;
  origin_region?: string;
  image_url?: string;
  total_quantity: number;
  order_count: number;
}

/** Event row from api.customers.getEvents() */
interface CustomerEvent {
  id: string;
  slug?: string;
  title: string;
  event_date?: string;
  location_name?: string;
  attendee_status?: string;
  attended?: 0 | 1 | null;
  rsvp_date?: string;
}

/** Tea journey data from api.events.getCustomerJourney() */
interface CustomerJourney {
  sessionsAttended?: number;
  totalTeas?: number;
  milestones?: string[];
  teaTypeMap?: Record<string, number>;
  favorites?: string[];
  impressions?: Array<{ impression: string; teaName: string; eventTitle: string }>;
  memberSince?: string;
}

const TAG_OPTIONS: CustomerTag[] = ['wholesale', 'retail', 'friend', 'vendor', 'vip', 'inactive'];

const CHANNEL_CONFIG: Record<ContactChannel, { label: string; Icon: React.ElementType }> = {
  phone:     { label: 'Phone',     Icon: Phone },
  email:     { label: 'Email',     Icon: Mail },
  whatsapp:  { label: 'WhatsApp',  Icon: MessageCircle },
  wechat:    { label: 'WeChat',    Icon: MessagesSquare },
  line:      { label: 'Line',      Icon: Hash },
  instagram: { label: 'Instagram', Icon: AtSign },
  telegram:  { label: 'Telegram',  Icon: Send },
  signal:    { label: 'Signal',    Icon: Lock },
  other:     { label: 'Other',     Icon: Hash },
};

const TAG_COLORS: Record<CustomerTag, string> = {
  wholesale: 'bg-tea-elevated text-tea-text',
  retail: 'bg-tea-elevated text-tea-text-sec',
  friend: 'bg-tea-gold-lt text-tea-text',
  vendor: 'bg-tea-elevated text-tea-gold',
  vip: 'bg-tea-gold-lt text-tea-text',
  inactive: 'bg-tea-elevated/60 text-tea-text-dim',
};

// Active (selected) tag chip style — used in the edit modal
const TAG_ACTIVE_COLORS: Record<CustomerTag, string> = {
  wholesale: 'bg-tea-elevated text-tea-text',
  retail: 'bg-tea-elevated text-tea-text',
  friend: 'bg-tea-gold-lt text-tea-text',
  vendor: 'bg-tea-elevated text-tea-gold',
  vip: 'bg-tea-gold-lt text-tea-text',
  inactive: 'bg-tea-elevated/60 text-tea-text-dim',
};

const RELATIONSHIP_BADGE_CLASSES: Record<ContactRelationshipKind, string> = {
  buyer: 'bg-tea-gold-lt text-tea-text',
  vendor: 'bg-tea-elevated text-tea-gold',
  event_guest: 'bg-tea-surface text-tea-text',
  collection_recipient: 'bg-tea-elevated text-tea-text-sec',
  contributor: 'bg-tea-surface text-tea-text-sec',
  personal_connection: 'bg-tea-bg text-tea-text-sec border border-tea-border',
};

const relationshipLabel = (kind: ContactRelationshipKind) =>
  CONTACT_RELATIONSHIP_TAXONOMY[kind]?.shortLabel ?? kind;

// ── Table column definitions ──
const CUSTOMER_COLUMN_DEFS = [
  { key: 'name',    label: 'Contact', defaultWidth: 'w-[22%]', alwaysVisible: true },
  { key: 'company', label: 'Company',  defaultWidth: 'w-[16%]' },
  { key: 'country', label: 'Country',  defaultWidth: 'w-[11%]' },
  { key: 'tags',    label: 'Tags',     defaultWidth: 'w-[15%]' },
  { key: 'contact', label: 'Contact',  defaultWidth: 'w-[12%]' },
  { key: 'spent',   label: 'Spent',    defaultWidth: 'w-[10%]' },
  { key: 'orders',  label: 'Orders',   defaultWidth: 'w-[8%]' },
  { key: 'added',   label: 'Added',    defaultWidth: 'w-[11%]' },
] as const;

type CustomerSortKey = 'name' | 'company' | 'country' | 'spent' | 'orders' | 'added';

/** Format a USD amount as "$1,234.50" */
function formatUSD(value: number | undefined | null): string {
  const n = Number(value) || 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/** Return a relative time string like "2 days ago", "just now" */
function relativeTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}yr ago`;
}

interface CustomerFormData {
  type: ContactType;
  name: string;
  company: string;
  relationship_kinds: ContactRelationshipKind[];
  contacts: ContactEntry[];
  address: string;
  city: string;
  country: string;
  preferred_currency: string;
  tags: string[];
  notes: string;
  source: string;
}

const emptyForm: CustomerFormData = {
  type: 'customer',
  name: '', company: '', contacts: [],
  relationship_kinds: [],
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
  const [customTagInput, setCustomTagInput] = useState('');
  const [newChannel, setNewChannel] = useState<ContactChannel>('whatsapp');
  const [newHandle, setNewHandle] = useState('');
  const [showOptional, setShowOptional] = useState(false);

  React.useEffect(() => {
    setForm(initialData || emptyForm);
    setCustomTagInput('');
    setNewChannel('whatsapp');
    setNewHandle('');
    setShowOptional(false);
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

  const toggleTag = (tag: string) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag as CustomerTag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag as CustomerTag],
    }));
  };

  const toggleRelationship = (kind: ContactRelationshipKind) => {
    setForm(prev => ({
      ...prev,
      relationship_kinds: prev.relationship_kinds.includes(kind)
        ? prev.relationship_kinds.filter(k => k !== kind)
        : [...prev.relationship_kinds, kind],
    }));
  };

  const addCustomTag = () => {
    const tag = customTagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (!tag || form.tags.includes(tag as CustomerTag)) {
      setCustomTagInput('');
      return;
    }
    setForm(prev => ({ ...prev, tags: [...prev.tags, tag as CustomerTag] }));
    setCustomTagInput('');
  };

  // Tags not in the standard set (custom tags from data)
  const customTags = form.tags.filter(t => !TAG_OPTIONS.includes(t as CustomerTag));

  const Field = ({ label, name, type = 'text', placeholder }: { label: string; name: keyof CustomerFormData; type?: string; placeholder?: string }) => (
    <div>
      <label className="block text-xs text-tea-text-sec mb-1 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={form[name] as string}
        onChange={e => setForm(prev => ({ ...prev, [name]: e.target.value }))}
        placeholder={placeholder}
        className="w-full bg-tea-bg border border-tea-border rounded-xl px-3 py-2 text-base md:text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-text-sec transition-colors"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-tea-bg border border-tea-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto overscroll-contain shadow-2xl relative">
        <div className="sticky top-0 bg-tea-bg border-b border-tea-border p-6 flex justify-between items-center z-10">
          <button onClick={onClose} className="text-tea-text-sec hover:text-tea-text transition-colors" aria-label="Close"><X size={20} /></button>
          <h3 className="text-xl font-serif text-tea-text">
            {isEditing ? `Edit ${form.type === 'supplier' ? 'Supplier' : 'Customer'}` : `Add ${form.type === 'supplier' ? 'Supplier' : 'Customer'}`}
          </h3>
          <div className="w-5" />
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type toggle */}
          <div className="flex rounded-xl overflow-hidden border border-tea-border">
            {(['customer', 'supplier'] as ContactType[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setForm(prev => ({ ...prev, type: t }))}
                className={`flex-1 py-2 text-xs uppercase tracking-[0.15em] transition-colors ${
                  form.type === t
                    ? 'bg-tea-elevated text-tea-text font-medium'
                    : 'text-tea-text-sec hover:text-tea-text'
                }`}
              >
                {t === 'customer' ? 'Customer' : 'Supplier'}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs text-tea-text-sec mb-2 uppercase tracking-wider">Relationships</label>
            <div className="flex flex-wrap gap-1.5">
              {CONTACT_RELATIONSHIP_ORDER.map(kind => {
                const active = form.relationship_kinds.includes(kind);
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => toggleRelationship(kind)}
                    className={`text-ui-11 px-2 py-1 rounded-full transition-colors ${active ? (RELATIONSHIP_BADGE_CLASSES[kind] || 'bg-tea-elevated text-tea-text') : 'bg-tea-surface text-tea-text-sec hover:text-tea-text'}`}
                  >
                    {relationshipLabel(kind)}
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="Name *" name="name" placeholder="Full name" />

          <div className="h-px bg-tea-border my-2" />
          <h4 className="text-xs text-tea-text-sec uppercase tracking-wider">Contact</h4>

          {/* Existing contacts */}
          {form.contacts.length > 0 && (
            <div className="space-y-2">
              {form.contacts.map((c, i) => {
                const { label, Icon } = CHANNEL_CONFIG[c.channel] ?? CHANNEL_CONFIG.other;
                return (
                  <div key={i} className="flex items-center gap-2 bg-tea-surface border border-tea-border rounded-xl px-3 py-2">
                    <Icon size={13} className="text-tea-text-sec shrink-0" />
                    <span className="text-ui-10 uppercase tracking-wider text-tea-text-dim w-16 shrink-0">{label}</span>
                    <span className="text-sm text-tea-text flex-1 min-w-0 truncate">{c.handle}</span>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, contacts: prev.contacts.filter((_, j) => j !== i) }))}
                      className="text-tea-text-sec hover:text-tea-text transition-colors shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add contact row */}
          <div className="flex items-center gap-2">
            <select
              value={newChannel}
              onChange={e => setNewChannel(e.target.value as ContactChannel)}
              className="bg-tea-bg border border-tea-border rounded-xl px-2 py-2 text-xs text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-text-sec transition-colors shrink-0"
            >
              {(Object.keys(CHANNEL_CONFIG) as ContactChannel[]).map(ch => (
                <option key={ch} value={ch}>{CHANNEL_CONFIG[ch].label}</option>
              ))}
            </select>
            <input
              type="text"
              value={newHandle}
              onChange={e => setNewHandle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (!newHandle.trim()) return;
                  setForm(prev => ({ ...prev, contacts: [...prev.contacts, { channel: newChannel, handle: newHandle.trim() }] }));
                  setNewHandle('');
                }
              }}
              placeholder="Handle or number…"
              className="flex-1 bg-tea-bg border border-tea-border rounded-xl px-3 py-2 text-base md:text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-text-sec transition-colors"
            />
            <button
              type="button"
              disabled={!newHandle.trim()}
              onClick={() => {
                if (!newHandle.trim()) return;
                setForm(prev => ({ ...prev, contacts: [...prev.contacts, { channel: newChannel, handle: newHandle.trim() }] }));
                setNewHandle('');
              }}
              className="px-3 py-2 text-xs bg-tea-elevated text-tea-text-sec rounded-xl hover:text-tea-text transition-colors disabled:opacity-40 shrink-0"
            >
              Add
            </button>
          </div>

          {/* More details toggle */}
          <button
            type="button"
            onClick={() => setShowOptional(s => !s)}
            className="w-full mt-4 text-left flex items-center justify-between text-xs text-tea-text-sec hover:text-tea-text transition-colors font-medium uppercase tracking-wider py-2"
          >
            <span>More details</span>
            <span className="text-ui-14">{showOptional ? '▴' : '▾'}</span>
          </button>

          {/* Optional fields - collapsed by default */}
          {showOptional && (
            <>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Company" name="company" placeholder="Business name" />
                  <Field label="Source" name="source" placeholder="e.g. Referral, Online" />
                </div>

                <div className="h-px bg-tea-border" />
                <h4 className="text-xs text-tea-text-sec uppercase tracking-wider">Location</h4>

                <Field label="Address" name="address" placeholder="Street address" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="City" name="city" placeholder="City" />
                  <Field label="Country" name="country" placeholder="Country" />
                </div>

                <div className="h-px bg-tea-border" />

                <div>
                  <label className="block text-xs text-tea-text-sec mb-2 uppercase tracking-wider">Tags</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {TAG_OPTIONS.map(tag => {
                      const isActive = form.tags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                            isActive
                              ? TAG_ACTIVE_COLORS[tag]
                              : 'bg-tea-elevated/60 text-tea-text-dim hover:bg-tea-elevated hover:text-tea-text-sec'
                          }`}
                        >
                          {isActive && <span className="mr-1 opacity-60">✓</span>}{tag}
                        </button>
                      );
                    })}
                    {/* Custom tags already on the customer */}
                    {customTags.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className="text-xs px-3 py-1.5 rounded-full bg-tea-elevated text-tea-text transition-all"
                      >
                        <span className="mr-1 opacity-60">✓</span>{tag}
                      </button>
                    ))}
                  </div>
                  {/* Custom tag input */}
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      value={customTagInput}
                      onChange={e => setCustomTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag(); } }}
                      placeholder="Add custom tag…"
                      className="flex-1 bg-tea-bg border border-tea-border rounded-xl px-3 py-1.5 text-xs text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-text-sec transition-colors placeholder-tea-text-dim"
                    />
                    <button
                      type="button"
                      onClick={addCustomTag}
                      disabled={!customTagInput.trim()}
                      className="px-3 py-1.5 text-xs bg-tea-elevated text-tea-text-sec rounded-xl hover:text-tea-text transition-colors disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-tea-text-sec mb-1 uppercase tracking-wider">Preferred Currency</label>
                  <select
                    value={form.preferred_currency}
                    onChange={e => setForm(prev => ({ ...prev, preferred_currency: e.target.value }))}
                    className="w-full bg-tea-bg border border-tea-border rounded-xl px-3 py-2 text-base md:text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-text-sec transition-colors"
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
                    className="w-full bg-tea-bg border border-tea-border rounded-xl px-3 py-2 text-base md:text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-text-sec transition-colors resize-none"
                  />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={saving || !form.name.trim()}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-3 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 active:bg-tea-gold/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : isEditing ? 'Update Customer' : 'Add Customer'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ── Customer Detail Panel ──
export const CustomerDetail = ({
  customer, onClose, onEdit, onDelete, allProducts, filterAttendedEvents,
}: {
  customer: Customer;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  allProducts?: Product[];
  filterAttendedEvents?: boolean;
}) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Invoice[]>([]);
  const [teas, setTeas] = useState<CustomerTea[]>([]);
  const [events, setEvents] = useState<CustomerEvent[]>([]);
  const [suppliedProducts, setSuppliedProducts] = useState<SuppliedProduct[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingTeas, setLoadingTeas] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingSupplied, setLoadingSupplied] = useState(true);
  const [showOrders, setShowOrders] = useState(true);
  const [showTeas, setShowTeas] = useState(true);
  const [showEvents, setShowEvents] = useState(!!filterAttendedEvents);
  const [showSupplied, setShowSupplied] = useState(true);
  const [showLinkDropdown, setShowLinkDropdown] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkAccountInput, setLinkAccountInput] = useState('');
  const [showLinkAccount, setShowLinkAccount] = useState(false);
  const [linkingAccount, setLinkingAccount] = useState(false);
  const [journey, setJourney] = useState<CustomerJourney | null>(null);
  const [loadingJourney, setLoadingJourney] = useState(false);
  const [showJourney, setShowJourney] = useState(false);
  const [showSampleTastings, setShowSampleTastings] = useState(false);

  const allSamples = useSampleStore((s) => s.samples);
  const customerTastings = useMemo(() => {
    const results: Array<{ sampleName: string; verdict: string; date: string; rating?: number }> = [];
    allSamples.forEach(sample => {
      sample.tastings
        .filter(t => t.tasterId === customer.id)
        .forEach(t => {
          results.push({
            sampleName: sample.name,
            verdict: t.verdict,
            date: t.createdAt,
            rating: t.rating,
          });
        });
    });
    return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allSamples, customer.id]);

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
    setLoadingEvents(true);
    setJourney(null);
    setShowJourney(false);
    api.customers.getOrders(customer.id)
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoadingOrders(false));
    api.customers.getTeas(customer.id)
      .then(setTeas)
      .catch(() => setTeas([]))
      .finally(() => setLoadingTeas(false));
    api.customers.getEvents(customer.id)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false));
    setLoadingJourney(true);
    api.events.getCustomerJourney(customer.id)
      .then(data => setJourney(data))
      .catch(() => {})
      .finally(() => setLoadingJourney(false));
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

  const allRelationships = customer.relationshipKinds ?? [];
  const allLegacyTags = customer.tags ?? [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-drawer bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className="fixed inset-y-0 right-0 z-drawer w-full max-w-md bg-tea-surface border-l border-tea-border flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-label={`${customer.name} details`}
      >
        {/* Header — close X top-LEFT per panel rule §15, toolbar on the right */}
        <div className="flex items-center justify-between gap-2 px-4 h-14 border-b border-tea-border flex-shrink-0">
          <button
            onClick={onClose}
            className="text-tea-text-sec hover:text-tea-text transition-colors tap-target"
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onClose(); navigate(`/admin/people/${customer.id}`); }}
              className="p-2 text-tea-text-sec hover:text-tea-text transition-colors tap-target"
              title="View full profile"
            >
              <ExternalLink size={16} />
            </button>
            <button onClick={onEdit} className="p-2 text-tea-text-sec hover:text-tea-text transition-colors tap-target" title="Edit">
              <Edit3 size={16} />
            </button>
            <button onClick={onDelete} className="p-2 text-tea-text-sec hover:text-tea-error transition-colors tap-target" title="Delete">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-5 pb-nav-gap">
          {/* Identity card */}
          <div className="bg-tea-surface border border-tea-border rounded-xl p-5 flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-tea-elevated text-tea-text-sec font-display text-ui-15 flex items-center justify-center flex-shrink-0">
              {customerInitials(customer.name)}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="h3 text-tea-text truncate">{customer.name}</h3>
              {customer.company && (
                <p className="text-ui-13 text-tea-text-sec mt-0.5 truncate">{customer.company}</p>
              )}
              {(customer.country || customer.city) && (
                <p className="text-ui-12 text-tea-text-dim mt-0.5 truncate">
                  {[customer.city, customer.country].filter(Boolean).join(', ')}
                </p>
              )}
              {(allRelationships.length > 0 || allLegacyTags.length > 0) && (
                <div className="flex items-center gap-1 flex-wrap mt-3">
                  {allRelationships.map(kind => (
                    <StatusPill key={`r-${kind}`} variant={relationshipVariant(kind)}>{relationshipLabel(kind)}</StatusPill>
                  ))}
                  {allLegacyTags.map(tag => (
                    <StatusPill key={`t-${tag}`} variant={tagVariant(tag)}>{tag}</StatusPill>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stats summary card */}
          <div className={`grid gap-3 grid-cols-2 ${(customer.eventCount || 0) > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
            <button
              onClick={() => { onClose(); navigate(`/admin/activity?tab=orders&search=${encodeURIComponent(customer.name || '')}`); }}
              className="bg-tea-surface border border-tea-border rounded-xl p-4 text-center hover:bg-tea-elevated transition-colors group"
              title="View orders for this customer"
            >
              <div className="font-mono tabular-nums text-2xl text-tea-gold">{customer.orderCount || 0}</div>
              <div className="text-ui-10 text-tea-text-sec uppercase tracking-wider mt-1">Orders</div>
            </button>
            <div className="bg-tea-surface border border-tea-border rounded-xl p-4 text-center">
              <div className="font-mono tabular-nums text-ui-15 text-tea-gold leading-tight">{formatUSD(customer.totalSpentUSD)}</div>
              <div className="text-ui-10 text-tea-text-sec uppercase tracking-wider mt-1">Total Spent</div>
            </div>
            {(customer.eventCount || 0) > 0 && (
              <div className="bg-tea-surface border border-tea-border rounded-xl p-4 text-center">
                <div className="font-mono tabular-nums text-2xl text-tea-gold">{customer.eventCount}</div>
                <div className="text-ui-10 text-tea-text-sec uppercase tracking-wider mt-1">Events</div>
              </div>
            )}
            <div className="bg-tea-surface border border-tea-border rounded-xl p-4 text-center">
              <div className="font-display text-ui-13 text-tea-text leading-tight">
                {relativeTime(customer.lastOrderDate)}
              </div>
              {customer.lastOrderDate && (
                <div className="font-mono tabular-nums text-ui-10 text-tea-text-dim mt-0.5">{new Date(customer.lastOrderDate).toLocaleDateString()}</div>
              )}
              <div className="text-ui-10 text-tea-text-sec uppercase tracking-wider mt-1">Last Order</div>
            </div>
          </div>

          {/* Vendor section (for vendor-tagged contacts) */}
          {isVendor && (
            <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
              <button
                onClick={() => setShowSupplied(!showSupplied)}
                className="w-full flex justify-between items-center"
              >
                <h4 className="text-xs uppercase tracking-[0.2em] text-tea-text-sec flex items-center gap-2">
                  <Leaf size={12} /> Vendor — Products Sourced
                  {!loadingSupplied && suppliedProducts.length > 0 && <span className="text-tea-gold">({suppliedProducts.length})</span>}
                </h4>
                {showSupplied ? <ChevronUp size={14} className="text-tea-text-sec" /> : <ChevronDown size={14} className="text-tea-text-sec" />}
              </button>

              {showSupplied && (
                <div className="mt-4">
                  {loadingSupplied ? (
                    <div className="flex justify-center py-4"><Loader2 className="animate-spin text-tea-text-sec" size={16} /></div>
                  ) : (
                    <>
                      {/* Vendor summary stats */}
                      {suppliedProducts.length > 0 && (() => {
                        const totalValue = suppliedProducts.reduce((sum, p) => sum + (Number(p.cost_amount) || 0), 0);
                        const costsPerGram = suppliedProducts.map((p) => Number(p.cost_per_gram)).filter(Boolean);
                        const avgCostPerGram = costsPerGram.length > 0 ? costsPerGram.reduce((a, b) => a + b, 0) / costsPerGram.length : null;
                        return (
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="bg-tea-bg rounded-xl p-3 text-center">
                              <div className="text-lg font-serif text-tea-gold">{suppliedProducts.length}</div>
                              <div className="text-ui-9 uppercase tracking-[0.15em] text-tea-text-sec mt-0.5">Products</div>
                            </div>
                            <div className="bg-tea-bg rounded-xl p-3 text-center">
                              <div className="text-sm font-serif text-tea-gold">{formatUSD(totalValue)}</div>
                              <div className="text-ui-9 uppercase tracking-[0.15em] text-tea-text-sec mt-0.5">Total Value</div>
                            </div>
                            <div className="bg-tea-bg rounded-xl p-3 text-center">
                              <div className="text-sm font-serif text-tea-text">{avgCostPerGram != null ? `$${avgCostPerGram.toFixed(3)}/g` : '—'}</div>
                              <div className="text-ui-9 uppercase tracking-[0.15em] text-tea-text-sec mt-0.5">Avg Cost/g</div>
                            </div>
                          </div>
                        );
                      })()}

                      {suppliedProducts.length > 0 && (
                        <div className="space-y-2 mb-4">
                          {suppliedProducts.map((p) => (
                            <div key={p.id} className="flex items-center gap-3 py-2 border-b border-tea-border last:border-0">
                              {p.image_url ? (
                                <img src={p.image_url} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" loading="lazy" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-tea-bg flex items-center justify-center flex-shrink-0">
                                  <Leaf size={14} className="text-tea-text-sec" />
                                </div>
                              )}
                              <button
                                onClick={() => { onClose(); navigate(`/admin/stock?search=${encodeURIComponent(p.given_name || p.product_name || '')}`); }}
                                className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                                title="View in Stock"
                              >
                                <div className="text-sm text-tea-text font-medium truncate hover:text-tea-gold transition-colors">
                                  {p.given_name || p.product_name}
                                  {p.year && <span className="text-tea-text-dim ml-1 font-normal">{p.year}</span>}
                                </div>
                                <div className="text-xs text-tea-text-sec flex items-center gap-2">
                                  <span className="uppercase">{p.type}</span>
                                  {p.origin_region && <span>· {p.origin_region}</span>}
                                  {p.stock_grams != null && <span>· {p.stock_grams}g stock</span>}
                                  {p.cost_per_gram != null && <span className="text-tea-text-dim">· ${Number(p.cost_per_gram).toFixed(3)}/g</span>}
                                </div>
                                {p.last_ordered_date && (
                                  <div className="text-ui-10 text-tea-text-dim mt-0.5">
                                    Last ordered {relativeTime(p.last_ordered_date)}
                                  </div>
                                )}
                              </button>
                              <button
                                onClick={async () => {
                                  await api.customers.unlinkProduct(customer.id, p.id);
                                  refreshSupplied();
                                  showToast('Product unlinked', 'info');
                                }}
                                className="text-tea-text-sec hover:text-tea-text transition-colors p-1"
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
                          className="flex items-center gap-2 text-xs text-tea-text-sec hover:text-tea-gold transition-colors"
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
                                className="w-full input-warm rounded-xl px-3 py-1.5 text-base md:text-xs outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
                                autoFocus
                              />
                            </div>
                            {allProducts
                              .filter(p => {
                                const q = linkSearch.toLowerCase();
                                const alreadyLinked = suppliedProducts.some((sp) => sp.id === p.id);
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
                                  <span className="text-ui-10 text-tea-text-sec uppercase">{p.type}</span>
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

          {/* ── Contact ────────────────────────────────── */}
          <div className="flex items-center gap-3 pt-1">
            <span className="text-ui-9 uppercase tracking-[0.2em] text-tea-gold/40 font-sans font-medium">Contact</span>
            <div className="flex-1 h-px bg-tea-accent-sub"></div>
          </div>

          {/* Contact Info */}
          <div className="bg-tea-surface border border-tea-border rounded-xl p-5 space-y-3">
            <h4 className="text-xs uppercase tracking-[0.2em] text-tea-text-sec">Contact</h4>
            {(() => {
              const contacts: ContactEntry[] = customer.contacts?.length > 0
                ? customer.contacts
                : [
                    ...(customer.phone    ? [{ channel: 'phone'    as ContactChannel, handle: customer.phone    }] : []),
                    ...(customer.whatsapp ? [{ channel: 'whatsapp' as ContactChannel, handle: customer.whatsapp }] : []),
                    ...(customer.email    ? [{ channel: 'email'    as ContactChannel, handle: customer.email    }] : []),
                  ];
              if (contacts.length === 0) {
                return <p className="text-tea-text-sec text-sm italic">No contact information on file.</p>;
              }
              return contacts.map((c, i) => {
                const { label, Icon } = CHANNEL_CONFIG[c.channel] ?? CHANNEL_CONFIG.other;
                return (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <Icon size={14} className="text-tea-text-sec shrink-0" />
                    <div>
                      <div className="text-tea-text-sec text-xs">{label}</div>
                      <div className="text-tea-text">{c.handle}</div>
                    </div>
                  </div>
                );
              });
            })()}
            <InfoRow icon={<MapPin size={14} />} label="Location" value={[customer.address, customer.city, customer.country].filter(Boolean).join(', ') || undefined} />
          </div>

          {/* Notes */}
          {customer.notes && (
            <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
              <h4 className="text-xs uppercase tracking-[0.2em] text-tea-text-sec mb-3">Notes</h4>
              <p className="text-sm text-tea-text whitespace-pre-wrap leading-relaxed">{customer.notes}</p>
            </div>
          )}

          {/* ── History ────────────────────────────────── */}
          <div className="flex items-center gap-3 pt-1">
            <span className="text-ui-9 uppercase tracking-[0.2em] text-tea-gold/40 font-sans font-medium">History</span>
            <div className="flex-1 h-px bg-tea-accent-sub"></div>
          </div>

          {/* Events Attended */}
          <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
            <button
              onClick={() => setShowEvents(!showEvents)}
              className="w-full flex justify-between items-center"
            >
              <h4 className="text-xs uppercase tracking-[0.2em] text-tea-text-sec flex items-center gap-2">
                <Calendar size={12} /> Events Attended
                {!loadingEvents && events.length > 0 && <span className="text-tea-gold">({events.length})</span>}
              </h4>
              {showEvents ? <ChevronUp size={14} className="text-tea-text-sec" /> : <ChevronDown size={14} className="text-tea-text-sec" />}
            </button>

            {showEvents && (
              <div className="mt-4 space-y-2">
                {loadingEvents ? (
                  <div className="flex justify-center py-4"><Loader2 className="animate-spin text-tea-text-sec" size={16} /></div>
                ) : events.length === 0 ? (
                  <p className="text-tea-text-sec text-sm italic">No events attended yet.</p>
                ) : (
                  events.map((evt) => (
                    <div key={evt.id + '-' + evt.rsvp_date} className="flex justify-between items-center text-sm py-2 border-b border-tea-border last:border-0">
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => { onClose(); navigate(`/admin/events/${evt.slug || evt.id}`); }}
                          className="text-tea-text font-medium hover:text-tea-gold transition-colors truncate block text-left"
                          title="View in Events"
                        >
                          {evt.title}
                        </button>
                        <div className="text-xs text-tea-text-sec flex items-center gap-2 mt-0.5">
                          {evt.event_date && <span>{new Date(evt.event_date).toLocaleDateString()}</span>}
                          {evt.location_name && <span>· {evt.location_name}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        {evt.attended === 1 && (
                          <StatusPill variant="success">Attended</StatusPill>
                        )}
                        {evt.attended === 0 && (
                          <StatusPill variant="archived">No-show</StatusPill>
                        )}
                        {evt.attended == null && (
                          <StatusPill variant="active">{evt.attendee_status}</StatusPill>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Tea Journey */}
          <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
            <button
              onClick={() => setShowJourney(!showJourney)}
              className="w-full flex justify-between items-center"
            >
              <h4 className="text-xs uppercase tracking-[0.2em] text-tea-text-sec flex items-center gap-2">
                <Leaf size={12} /> Tea Journey
              </h4>
              {showJourney ? <ChevronUp size={14} className="text-tea-text-sec" /> : <ChevronDown size={14} className="text-tea-text-sec" />}
            </button>

            {showJourney && (
              <div className="mt-4 space-y-3">
                {loadingJourney ? (
                  <div className="flex justify-center py-4"><Loader2 className="animate-spin text-tea-text-sec" size={16} /></div>
                ) : !journey ? (
                  <p className="text-tea-text-sec text-sm italic">No journey data available.</p>
                ) : (
                  <>
                    {/* Journey stats row */}
                    {(journey.sessionsAttended > 0 || journey.totalTeas > 0 || (journey.milestones?.length > 0)) && (
                      <div className="flex gap-3">
                        {journey.sessionsAttended > 0 && (
                          <div className="bg-tea-accent-sub/30 rounded px-2.5 py-1.5">
                            <p className="text-lg font-mono text-tea-gold">{journey.sessionsAttended}</p>
                            <p className="text-ui-10 font-sans text-tea-text-dim uppercase">Sessions</p>
                          </div>
                        )}
                        {journey.totalTeas > 0 && (
                          <div className="bg-tea-accent-sub/30 rounded px-2.5 py-1.5">
                            <p className="text-lg font-mono text-tea-gold">{journey.totalTeas}</p>
                            <p className="text-ui-10 font-sans text-tea-text-dim uppercase">Teas Tasted</p>
                          </div>
                        )}
                        {journey.milestones?.length > 0 && (
                          <div className="bg-tea-accent-sub/30 rounded px-2.5 py-1.5">
                            <p className="text-lg font-display text-tea-gold">{journey.milestones[journey.milestones.length - 1]}</p>
                            <p className="text-ui-10 font-sans text-tea-text-dim uppercase">Milestone</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tea type preferences */}
                    {journey.teaTypeMap && Object.keys(journey.teaTypeMap).length > 0 && (
                      <div>
                        <p className="text-ui-10 font-sans text-tea-text-dim uppercase tracking-wider mb-1.5">Preferences</p>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(journey.teaTypeMap)
                            .sort(([, a], [, b]) => b - a)
                            .map(([type, count]) => (
                              <span key={type} className="text-xs font-sans text-tea-text-sec bg-tea-surface px-2 py-0.5 rounded">
                                {type} <span className="text-tea-text-dim">({count})</span>
                              </span>
                            ))
                          }
                        </div>
                      </div>
                    )}

                    {/* Favorite teas */}
                    {journey.favorites?.length > 0 && (
                      <div>
                        <p className="text-ui-10 font-sans text-tea-text-dim uppercase tracking-wider mb-1.5">Favorites</p>
                        <div className="space-y-1">
                          {journey.favorites.map((name: string, i: number) => (
                            <p key={i} className="text-xs font-sans text-tea-text-sec">{name}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent impressions */}
                    {journey.impressions?.length > 0 && (
                      <div>
                        <p className="text-ui-10 font-sans text-tea-text-dim uppercase tracking-wider mb-1.5">Impressions</p>
                        <div className="space-y-1.5">
                          {journey.impressions.slice(0, 3).map((imp: any, i: number) => (
                            <div key={i} className="text-xs">
                              <p className="font-serif italic text-tea-text-sec">"{imp.impression}"</p>
                              <p className="font-sans text-tea-text-dim mt-0.5">
                                {imp.teaName} — {imp.eventTitle}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Member since */}
                    {journey.memberSince && (
                      <p className="text-ui-10 font-sans text-tea-text-dim">
                        Member since {new Date(journey.memberSince).toLocaleDateString()}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Tea History — purchased teas + event tastings merged */}
          <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
            <button
              onClick={() => setShowTeas(!showTeas)}
              className="w-full flex justify-between items-center"
            >
              <h4 className="text-xs uppercase tracking-[0.2em] text-tea-text-sec flex items-center gap-2">
                <Leaf size={12} /> Tea History
                {!loadingTeas && (teas.length + events.filter((e) => e.attended === 1).length) > 0 && (
                  <span className="text-tea-gold">({teas.length + events.filter((e) => e.attended === 1).length})</span>
                )}
              </h4>
              {showTeas ? <ChevronUp size={14} className="text-tea-text-sec" /> : <ChevronDown size={14} className="text-tea-text-sec" />}
            </button>

            {showTeas && (
              <div className="mt-4 space-y-3">
                {(loadingTeas || loadingEvents) ? (
                  <div className="flex justify-center py-4"><Loader2 className="animate-spin text-tea-text-sec" size={16} /></div>
                ) : (teas.length === 0 && events.filter((e) => e.attended === 1).length === 0) ? (
                  <p className="text-tea-text-sec text-sm italic">No tea history yet.</p>
                ) : (
                  <>
                    {teas.length > 0 && (
                      <>
                        {events.filter((e) => e.attended === 1).length > 0 && (
                          <p className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-dim">Purchased</p>
                        )}
                        {teas.map((tea) => (
                          <div key={tea.id} className="flex items-center gap-3 py-2 border-b border-tea-border last:border-0">
                            {tea.image_url ? (
                              <img src={tea.image_url} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" loading="lazy" />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-tea-bg flex items-center justify-center flex-shrink-0">
                                <Leaf size={14} className="text-tea-text-sec" />
                              </div>
                            )}
                            <button
                              onClick={() => { onClose(); navigate(`/admin/stock?search=${encodeURIComponent(tea.given_name || tea.product_name || '')}`); }}
                              className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                              title="View in Stock"
                            >
                              <div className="text-sm text-tea-text font-medium truncate hover:text-tea-gold transition-colors">
                                {tea.given_name || tea.product_name}
                              </div>
                              <div className="text-xs text-tea-text-sec flex items-center gap-2">
                                <span className="uppercase">{tea.type}</span>
                                {tea.origin_region && <span>· {tea.origin_region}</span>}
                              </div>
                            </button>
                            <div className="text-right flex-shrink-0">
                              <div className="text-sm text-tea-text">{tea.total_quantity}g</div>
                              <div className="text-ui-10 text-tea-text-sec">
                                {tea.order_count} order{tea.order_count !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                    {events.filter((e) => e.attended === 1).length > 0 && (
                      <>
                        <p className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-dim mt-2">Tasted at Events</p>
                        {events.filter((e) => e.attended === 1).map((evt) => (
                          <div key={evt.id + '-tasting'} className="flex items-center gap-3 py-2 border-b border-tea-border last:border-0">
                            <div className="w-10 h-10 rounded-xl bg-tea-gold-lt flex items-center justify-center flex-shrink-0">
                              <Calendar size={14} className="text-tea-gold" />
                            </div>
                            <button
                              onClick={() => { onClose(); navigate(`/admin/events/${evt.slug || evt.id}`); }}
                              className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                              title="View Event"
                            >
                              <div className="text-sm text-tea-text font-medium truncate hover:text-tea-gold transition-colors">
                                {evt.title}
                              </div>
                              <div className="text-xs text-tea-text-dim">
                                {evt.event_date ? new Date(evt.event_date).toLocaleDateString() : ''} · Tasting details in event record
                              </div>
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Sample Tastings */}
          <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
            <button
              onClick={() => setShowSampleTastings(!showSampleTastings)}
              className="w-full flex justify-between items-center"
            >
              <h4 className="text-xs uppercase tracking-[0.2em] text-tea-text-sec flex items-center gap-2">
                <span>⬡</span> Sample Tastings
                {customerTastings.length > 0 && (
                  <span className="text-tea-gold num">{customerTastings.length}</span>
                )}
              </h4>
              {showSampleTastings
                ? <ChevronUp size={14} className="text-tea-text-sec" />
                : <ChevronDown size={14} className="text-tea-text-sec" />}
            </button>

            {showSampleTastings && (
              <div className="mt-4 space-y-2">
                {customerTastings.length === 0 ? (
                  <p className="text-tea-text-sec text-sm italic">No sample tastings yet.</p>
                ) : (
                  customerTastings.map((t, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b border-tea-border last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-tea-text font-medium truncate">{t.sampleName}</div>
                        <div className="text-ui-11 text-tea-text-sec">
                          {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`text-ui-11 font-medium capitalize ${
                          t.verdict === 'love' ? 'text-tea-gold' :
                          t.verdict === 'like' ? 'text-tea-text' :
                          t.verdict === 'pass' ? 'text-tea-text-dim' :
                          'text-tea-text-sec'
                        }`}>{t.verdict}</div>
                        {t.rating && <div className="text-ui-10 text-tea-text-dim num">{t.rating}/10</div>}
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
                  orders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => { onClose(); navigate(`/admin/activity?tab=orders&search=${encodeURIComponent(customer.name || '')}`); }}
                      className="w-full flex justify-between items-center text-sm py-2 border-b border-tea-border last:border-0 hover:bg-tea-accent-sub/50 rounded px-2 -mx-2 transition-colors group"
                      title="View orders in Activity"
                    >
                      <div>
                        <span className="text-tea-text font-medium group-hover:text-tea-gold transition-colors inline-flex items-center gap-1">
                          {order.invoice_number}
                          <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                        <span className="text-tea-text-sec text-xs ml-2">{new Date(order.created_at).toLocaleDateString()}</span>
                      </div>
                      <StatusPill
                        variant={
                          order.status === 'Void' ? 'archived' :
                          order.status === 'Pending' ? 'active' :
                          'success'
                        }
                      >
                        {order.status}
                      </StatusPill>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Account Link */}
          <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs uppercase tracking-[0.2em] text-tea-text-sec flex items-center gap-2">
                <Link size={12} /> Account Link
              </h4>
              {customer.userId ? (
                <button
                  onClick={async () => {
                    if (!confirm('Unlink this account?')) return;
                    await api.customers.update(customer.id, { user_id: null, user_linked_at: null });
                    showToast('Account unlinked', 'info');
                    onClose();
                  }}
                  className="text-ui-10 text-tea-text-sec hover:text-tea-error transition-colors uppercase tracking-wider"
                >
                  Unlink
                </button>
              ) : (
                <button
                  onClick={() => setShowLinkAccount(!showLinkAccount)}
                  className="text-ui-10 text-tea-text-sec hover:text-tea-text transition-colors uppercase tracking-wider"
                >
                  {showLinkAccount ? 'Cancel' : 'Link'}
                </button>
              )}
            </div>

            {customer.userId ? (
              <div className="mt-2">
                <p className="text-sm text-tea-text font-mono">{customer.userId}</p>
                {customer.userLinkedAt && (
                  <p className="text-ui-10 text-tea-text-sec mt-0.5">
                    Linked {new Date(customer.userLinkedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            ) : showLinkAccount ? (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={linkAccountInput}
                  onChange={e => setLinkAccountInput(e.target.value)}
                  placeholder="User ID or email…"
                  className="flex-1 bg-tea-bg border border-tea-border rounded-xl px-3 py-1.5 text-sm text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-text-sec transition-colors"
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && linkAccountInput.trim()) {
                      setLinkingAccount(true);
                      try {
                        await api.customers.update(customer.id, {
                          user_id: linkAccountInput.trim(),
                          user_linked_at: new Date().toISOString(),
                        });
                        showToast('Account linked', 'success');
                        setShowLinkAccount(false);
                        setLinkAccountInput('');
                        onClose();
                      } finally { setLinkingAccount(false); }
                    }
                  }}
                  autoFocus
                />
                <button
                  disabled={!linkAccountInput.trim() || linkingAccount}
                  onClick={async () => {
                    setLinkingAccount(true);
                    try {
                      await api.customers.update(customer.id, {
                        user_id: linkAccountInput.trim(),
                        user_linked_at: new Date().toISOString(),
                      });
                      showToast('Account linked', 'success');
                      setShowLinkAccount(false);
                      setLinkAccountInput('');
                      onClose();
                    } finally { setLinkingAccount(false); }
                  }}
                  className="px-3 py-1.5 text-xs bg-tea-elevated text-tea-text-sec rounded-xl hover:text-tea-text transition-colors disabled:opacity-40"
                >
                  {linkingAccount ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                </button>
              </div>
            ) : (
              <p className="text-sm text-tea-text-sec italic mt-2">Not linked to a user account.</p>
            )}
          </div>

          {/* Meta */}
          <div className="text-ui-11 text-tea-text-dim space-y-1 pt-2 border-t border-tea-border">
            <p>Type: <span className="text-tea-text-sec">{customer.type || 'customer'}</span></p>
            {customer.source && <p>Source: <span className="text-tea-text-sec">{customer.source}</span></p>}
            <p>Added: <span className="text-tea-text-sec font-mono tabular-nums">{new Date(customer.createdAt).toLocaleDateString()}</span></p>
            <p>Currency: <span className="text-tea-text-sec font-mono">{customer.preferredCurrency}</span></p>
          </div>
        </div>
      </aside>
    </>
  );
};

// ── Main CustomersView ──
export const CustomersView = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { data: customers = [], isLoading, refetch } = useCustomers();
  const { data: allProducts = [] } = useProducts();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [filterTags, setFilterTags] = useState<CustomerTag[]>([]);
  const [relationshipFilter, setRelationshipFilter] = useState<ContactRelationshipKind | 'all'>('all');
  const [filterAttendedEvents, setFilterAttendedEvents] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'customer' | 'supplier'>('all');
  const [sortConfig, setSortConfig] = useState<{ key: CustomerSortKey; direction: 'asc' | 'desc' }[]>([{ key: 'name', direction: 'asc' }]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['name', 'company', 'country', 'tags', 'contact', 'spent', 'orders', 'added']);
  const [showColumnsPopover, setShowColumnsPopover] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [pendingDeleteCustomer, setPendingDeleteCustomer] = useState<Customer | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Auto-open a specific customer when navigated from another view (e.g. event attendee)
  useEffect(() => {
    const id = searchParams.get('customerId');
    if (!id || customers.length === 0 || viewingCustomer) return;
    const found = customers.find(c => c.id === id);
    if (found) setViewingCustomer(found);
  }, [customers, searchParams]);

  const filtered = useMemo(() => {
    let list = customers;
    if (typeFilter !== 'all') {
      list = list.filter(c => (c.type || 'customer') === typeFilter);
    }
    if (relationshipFilter !== 'all') {
      list = list.filter(c => c.relationshipKinds?.includes(relationshipFilter));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q) ||
        c.country?.toLowerCase().includes(q) ||
        c.contacts?.some(ct => ct.handle.toLowerCase().includes(q)) ||
        c.email?.toLowerCase().includes(q) ||
        c.whatsapp?.includes(q)
      );
    }
    if (filterTags.length > 0) {
      // AND logic: customer must have ALL selected tags
      list = list.filter(c => filterTags.every(ft => c.tags.includes(ft)));
    }
    if (filterAttendedEvents) {
      list = list.filter(c => (c.eventCount || 0) > 0);
    }
    // Sort
    list = [...list].sort((a, b) => {
      for (const sort of sortConfig) {
        let cmp = 0;
        switch (sort.key) {
          case 'name':    cmp = a.name.localeCompare(b.name); break;
          case 'company': cmp = (a.company || '').localeCompare(b.company || ''); break;
          case 'country': cmp = (a.country || '').localeCompare(b.country || ''); break;
          case 'spent':   cmp = (a.totalSpentUSD || 0) - (b.totalSpentUSD || 0); break;
          case 'orders':  cmp = (a.orderCount || 0) - (b.orderCount || 0); break;
          case 'added':   cmp = (a.createdAt || '').localeCompare(b.createdAt || ''); break;
        }
        const result = sort.direction === 'asc' ? cmp : -cmp;
        if (result !== 0) return result;
      }
      return 0;
    });
    return list;
  }, [customers, typeFilter, relationshipFilter, search, filterTags, filterAttendedEvents, sortConfig]);

  const handleSave = async (data: CustomerFormData) => {
    try {
      if (editingCustomer) {
        await api.customers.update(editingCustomer.id, data);
        await api.customers.updateRelationships(editingCustomer.id, data.relationship_kinds);
        showToast('Contact updated', 'success');
      } else {
        const created = await api.customers.create(data);
        if (created?.id) await api.customers.updateRelationships(created.id, data.relationship_kinds);
        showToast('Contact added', 'success');
      }
      setIsModalOpen(false);
      setEditingCustomer(null);
      refetch();
    } catch (err: any) {
      showToast('Could not save contact: ' + err.message, 'error');
    }
  };

  const handleDelete = (customer: Customer) => {
    setPendingDeleteCustomer(customer);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteCustomer) return;
    setDeleteLoading(true);
    try {
      await api.customers.delete(pendingDeleteCustomer.id);
      showToast('Contact deleted', 'success');
      setViewingCustomer(null);
      setPendingDeleteCustomer(null);
      refetch();
    } catch (err: any) {
      showToast('Could not delete contact: ' + err.message, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setViewingCustomer(null);
    setIsModalOpen(true);
  };

  const handleSort = (key: CustomerSortKey) => {
    const existing = sortConfig.find(s => s.key === key);
    if (existing) {
      if (existing.direction === 'asc') {
        setSortConfig(sortConfig.map(s => s.key === key ? { ...s, direction: 'desc' as const } : s));
      } else {
        setSortConfig(sortConfig.filter(s => s.key !== key));
      }
    } else {
      setSortConfig([...sortConfig, { key, direction: 'asc' }]);
    }
  };

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const [showOptions, setShowOptions] = useState(false);

  const handleExport = () => {
    const csv = Papa.unparse(filtered.map(c => ({
      Name: c.name,
      Type: c.type || 'customer',
      Relationships: (c.relationshipKinds || []).map(relationshipLabel).join(', '),
      Company: c.company || '',
      Country: c.country || '',
      Tags: c.tags.join(', '),
      Contact: (c.contacts?.length > 0 ? c.contacts.map(ct => `${ct.channel}: ${ct.handle}`).join(' | ') : [
        ...(c.phone    ? [`phone: ${c.phone}`]    : []),
        ...(c.whatsapp ? [`whatsapp: ${c.whatsapp}`] : []),
        ...(c.email    ? [`email: ${c.email}`]    : []),
      ].join(' | ')),
      Orders: c.orderCount || 0,
      Spent_USD: c.totalSpentUSD ? Number(c.totalSpentUSD).toFixed(2) : '0.00',
      Events: c.eventCount || 0,
      Added: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '',
      Notes: c.notes || '',
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', 'contacts_export.csv');
    link.click();
    showToast('Export generated', 'success');
  };

  const formDataFromCustomer = (c: Customer): CustomerFormData => {
    // Prefer contacts array; fall back to synthesizing from legacy flat fields
    const contacts: ContactEntry[] = c.contacts && c.contacts.length > 0
      ? c.contacts
      : [
          ...(c.phone    ? [{ channel: 'phone'    as ContactChannel, handle: c.phone    }] : []),
          ...(c.whatsapp ? [{ channel: 'whatsapp' as ContactChannel, handle: c.whatsapp }] : []),
          ...(c.email    ? [{ channel: 'email'    as ContactChannel, handle: c.email    }] : []),
        ];
    return {
      type: c.type || 'customer',
      name: c.name,
      company: c.company || '',
      relationship_kinds: c.relationshipKinds || [],
      contacts,
      address: c.address || '',
      city: c.city || '',
      country: c.country || '',
      preferred_currency: c.preferredCurrency,
      tags: c.tags,
      notes: c.notes || '',
      source: c.source || '',
    };
  };

  // Mobile sort menu
  const [showMobileSort, setShowMobileSort] = useState(false);

  // ── Derived table state ──
  const visibleCols = CUSTOMER_COLUMN_DEFS.filter(col => visibleColumns.includes(col.key));

  const SortHeader = ({ colKey, label, align = 'left' }: { colKey: CustomerSortKey; label: string; align?: 'left' | 'right' | 'center' }) => {
    const sortIndex = sortConfig.findIndex(s => s.key === colKey);
    const sortEntry = sortIndex >= 0 ? sortConfig[sortIndex] : null;
    const showBadge = sortConfig.length > 1 && sortEntry;
    return (
      <th
        className={`px-4 py-2 cursor-pointer hover:text-tea-text transition-colors select-none border-b border-tea-border group font-serif text-ui-11 uppercase tracking-display text-tea-text-sec font-normal text-${align} truncate`}
        onClick={() => handleSort(colKey)}
      >
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
          {label}
          <div className="flex-shrink-0 flex items-center">
            {sortEntry ? (
              <span className="flex items-center">
                {sortEntry.direction === 'asc' ? <ArrowUp size={10} className="ml-1 text-tea-text-sec" /> : <ArrowDown size={10} className="ml-1 text-tea-text-sec" />}
                {showBadge && <span className="ml-0.5 text-ui-8 text-tea-gold font-bold">{sortIndex + 1}</span>}
              </span>
            ) : <ArrowUpDown size={10} className="opacity-0 group-hover:opacity-100 text-tea-text-sec/50 ml-1 transition-opacity" />}
          </div>
        </div>
      </th>
    );
  };

  const renderCell = (customer: Customer, colKey: string) => {
    switch (colKey) {
      case 'name':
        return (
          <td key="name" className="px-4 align-middle overflow-hidden">
            <span className="text-sm font-serif text-tea-text tracking-wide group-hover:text-tea-gold transition-colors truncate block">
              {customer.name}
            </span>
          </td>
        );
      case 'company':
        return (
          <td key="company" className="px-4 align-middle overflow-hidden">
            <span className="text-xs text-tea-text-sec font-sans truncate block">{customer.company || '—'}</span>
          </td>
        );
      case 'country':
        return (
          <td key="country" className="px-4 align-middle overflow-hidden">
            {customer.country
              ? <span className="text-xs text-tea-text-sec flex items-center gap-1 truncate"><MapPin size={10} className="flex-shrink-0" /> {customer.country}</span>
              : <span className="text-xs text-tea-text-dim">—</span>}
          </td>
        );
      case 'tags': {
        const contactTags = customer.contact_tags ?? [];
        const relationships = customer.relationshipKinds ?? [];
        const legacyShown = customer.tags.slice(0, 2);
        const contactShown = contactTags.slice(0, 3);
        const relationshipShown = relationships.slice(0, 3);
        const extra = (relationships.length - relationshipShown.length) + (customer.tags.length - legacyShown.length) + (contactTags.length - contactShown.length);
        const empty = relationships.length === 0 && customer.tags.length === 0 && contactTags.length === 0;
        return (
          <td key="tags" className="px-4 align-middle overflow-hidden">
            <div className="flex items-center gap-1 flex-wrap">
              {relationshipShown.map(kind => (
                <span key={`r-${kind}`} className={`text-ui-9 px-1.5 py-0.5 rounded-full ${RELATIONSHIP_BADGE_CLASSES[kind] || 'bg-tea-elevated text-tea-text-sec'}`}>
                  {relationshipLabel(kind)}
                </span>
              ))}
              {legacyShown.map(tag => (
                <span key={`l-${tag}`} className="text-ui-9 text-tea-text-sec uppercase tracking-[0.08em] truncate max-w-[120px]">{tag}</span>
              ))}
              {contactShown.map(tag => (
                <span key={`c-${tag}`} className="text-ui-9 text-tea-text-sec uppercase tracking-[0.08em] truncate max-w-[120px]">{tag}</span>
              ))}
              {extra > 0 && <span className="text-ui-9 text-tea-text-dim">+{extra}</span>}
              {empty && <span className="text-xs text-tea-text-dim">—</span>}
            </div>
          </td>
        );
      }
      case 'contact':
        return (
          <td key="contact" className="px-4 align-middle overflow-hidden">
            <div className="flex items-center gap-1.5 text-tea-text-sec/60">
              {(customer.contacts?.length > 0
                ? customer.contacts.slice(0, 4)
                : [
                    ...(customer.phone    ? [{ channel: 'phone'    as ContactChannel }] : []),
                    ...(customer.whatsapp ? [{ channel: 'whatsapp' as ContactChannel }] : []),
                    ...(customer.email    ? [{ channel: 'email'    as ContactChannel }] : []),
                  ]
              ).map((c, i) => {
                const { Icon } = CHANNEL_CONFIG[c.channel] ?? CHANNEL_CONFIG.other;
                return <Icon key={i} size={11} />;
              })}
              {(customer.contacts?.length === 0 && !customer.phone && !customer.whatsapp && !customer.email) && (
                <span className="text-ui-10 text-tea-text-dim">—</span>
              )}
            </div>
          </td>
        );
      case 'spent':
        return (
          <td key="spent" className="px-4 align-middle overflow-hidden text-right">
            <span className="text-xs text-tea-text tabular-nums font-medium">{formatUSD(customer.totalSpentUSD)}</span>
          </td>
        );
      case 'orders':
        return (
          <td key="orders" className="px-4 align-middle overflow-hidden text-center">
            <span className={`text-xs tabular-nums ${(customer.orderCount || 0) > 0 ? 'text-tea-text' : 'text-tea-text-dim'}`}>
              {customer.orderCount || 0}
              {(customer.eventCount || 0) > 0 && (
                <span className="ml-1 text-tea-gold text-ui-9">+{customer.eventCount}e</span>
              )}
            </span>
          </td>
        );
      case 'added':
        return (
          <td key="added" className="px-4 align-middle overflow-hidden">
            <span className="text-xs text-tea-text-sec font-sans tabular-nums">
              {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : '—'}
            </span>
          </td>
        );
      default:
        return <td key={colKey} className="px-4 align-middle text-xs text-tea-text-sec">—</td>;
    }
  };

  const renderRow = (customer: Customer) => (
    <tr
      key={customer.id}
      className={`transition-colors border-b border-tea-border group hover:bg-tea-bg/50 cursor-pointer ${viewingCustomer?.id === customer.id ? 'bg-tea-gold/5' : ''}`}
      style={{ height: 36 }}
      onClick={() => setViewingCustomer(customer)}
    >
      {visibleCols.map(col => renderCell(customer, col.key))}
      <td className="px-3 py-2 align-middle text-right">
        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => openEdit(customer)}
            className="text-tea-text-sec hover:text-tea-text p-1 transition-colors"
            title="Edit"
          ><Edit3 size={13} /></button>
          <button
            onClick={() => handleDelete(customer)}
            className="text-tea-text-sec hover:text-tea-error p-1 transition-colors"
            title="Delete"
          ><Trash2 size={13} /></button>
        </div>
      </td>
    </tr>
  );

  if (isLoading) return <div className="p-12 text-center text-tea-text-sec flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">

      {/* --- STICKY HEADER (filter + actions only; parent PeopleView owns the page title) --- */}
      <div className="sticky top-0 z-sticky bg-tea-bg/90 backdrop-blur-md border-b border-tea-border flex-shrink-0">
        <div className="px-3 md:px-6 lg:px-10 max-w-7xl mx-auto flex items-center gap-3 md:gap-4 py-3">
          <div className="flex items-center gap-2 shrink-0 md:hidden">
            <Users size={16} className="text-tea-gold" />
            <span className="text-tea-text-sec text-xs">
              {filtered.length} contact{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Tag filter pills — multi-select, scrollable on mobile */}
          <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar md:ml-2">
            {/* Customer / Supplier segment */}
            <button onClick={() => setTypeFilter('all')} className={typeFilter === 'all' ? 'pill-active' : 'pill'}>
              All
              <span className="text-ui-9 opacity-70 ml-0.5">{customers.length}</span>
            </button>
            {(['customer', 'supplier'] as const).map(t => {
              const count = customers.filter(c => (c.type || 'customer') === t).length;
              if (count === 0) return null;
              return (
                <button key={t} onClick={() => setTypeFilter(t)} className={typeFilter === t ? 'pill-active' : 'pill'}>
                  {t === 'customer' ? 'Customers' : 'Suppliers'}
                  <span className="text-ui-9 opacity-70 ml-0.5">{count}</span>
                </button>
              );
            })}
            <span className="w-px h-4 bg-tea-border flex-shrink-0" />
            {CONTACT_RELATIONSHIP_ORDER.map(kind => {
              const count = customers.filter(c => c.relationshipKinds?.includes(kind)).length;
              if (count === 0) return null;
              return (
                <button
                  key={kind}
                  onClick={() => setRelationshipFilter(prev => prev === kind ? 'all' : kind)}
                  className={relationshipFilter === kind ? 'pill-active' : 'pill'}
                >
                  {relationshipLabel(kind)}
                  <span className="text-ui-9 opacity-70 ml-0.5">{count}</span>
                </button>
              );
            })}
            <span className="w-px h-4 bg-tea-border flex-shrink-0" />
            {TAG_OPTIONS.map(tag => {
              const count = customers.filter(c => c.tags.includes(tag)).length;
              if (count === 0) return null;
              const isActive = filterTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => setFilterTags(prev =>
                    isActive ? prev.filter(t => t !== tag) : [...prev, tag]
                  )}
                  className={isActive ? 'pill-active' : 'pill'}
                >
                  {tag}
                  <span className="text-ui-9 opacity-70 ml-0.5">{count}</span>
                </button>
              );
            })}

            {/* Attended Events segment filter */}
            {(() => {
              const attendedCount = customers.filter(c => (c.eventCount || 0) > 0).length;
              if (attendedCount === 0) return null;
              return (
                <>
                  <span className="w-px h-4 bg-tea-border flex-shrink-0" />
                  <button
                    onClick={() => setFilterAttendedEvents(!filterAttendedEvents)}
                    className={filterAttendedEvents ? 'pill-active' : 'pill'}
                  >
                    <Calendar size={11} className="mr-0.5 -ml-0.5" />
                    Events
                    <span className="text-ui-9 opacity-70 ml-0.5">{attendedCount}</span>
                  </button>
                </>
              );
            })()}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1 ml-auto shrink-0">
            {/* Mobile sort */}
            <div className="relative md:hidden">
              <button
                onClick={() => setShowMobileSort(!showMobileSort)}
                className={`w-9 h-9 flex items-center justify-center transition-colors rounded-md ${showMobileSort ? 'text-tea-gold' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
              >
                <ArrowUpDown size={15} />
              </button>
              {showMobileSort && (
                <>
                  <div className="fixed inset-0 z-modal" onClick={() => setShowMobileSort(false)} />
                  <div className="absolute right-0 top-9 w-40 bg-tea-surface border border-tea-border shadow-2xl rounded-xl z-popover py-1" role="menu">
                    {([
                      { key: 'name'    as CustomerSortKey, label: 'Name' },
                      { key: 'added'   as CustomerSortKey, label: 'Recent' },
                      { key: 'spent'   as CustomerSortKey, label: 'Top Spent' },
                      { key: 'orders'  as CustomerSortKey, label: 'Most Orders' },
                    ]).map(opt => {
                      const current = sortConfig[0];
                      const isActive = current?.key === opt.key;
                      return (
                        <button
                          key={opt.key}
                          onClick={() => {
                            setSortConfig([{ key: opt.key, direction: isActive && current.direction === 'asc' ? 'desc' : 'asc' }]);
                            setShowMobileSort(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-ui-11 flex items-center gap-2 hover:bg-tea-bg transition-colors ${isActive ? 'text-tea-gold' : 'text-tea-text-sec'}`}
                        >
                          {opt.label}
                          {isActive && (current.direction === 'asc' ? <ArrowUp size={12} className="ml-auto" /> : <ArrowDown size={12} className="ml-auto" />)}
                        </button>
                      );
                    })}
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
                className="w-full bg-transparent border-b border-tea-border rounded-none pl-8 pr-3 py-1.5 text-base md:text-xs text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-text-sec font-serif placeholder-tea-text-sec/50 transition-colors"
              />
            </div>

            {/* Desktop: Columns toggle */}
            <div className="relative hidden md:block">
              <button
                onClick={() => setShowColumnsPopover(!showColumnsPopover)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs transition-colors ${showColumnsPopover ? 'text-tea-gold bg-tea-surface' : 'text-tea-text-sec hover:text-tea-text hover:bg-tea-surface'}`}
                title="Show/Hide Columns"
              >
                <Columns size={14} />
                <span className="hidden xl:inline tracking-wide">Cols</span>
              </button>
              {showColumnsPopover && (
                <>
                  <div className="fixed inset-0 z-modal" onClick={() => setShowColumnsPopover(false)} />
                  <div className="absolute right-0 top-full mt-2 w-44 bg-tea-surface border border-tea-border shadow-2xl rounded-xl z-popover py-2">
                    <div className="px-3 pb-1.5 text-ui-9 text-tea-text-sec/60 uppercase tracking-[0.2em]">Visible Columns</div>
                    {CUSTOMER_COLUMN_DEFS.map(col => (
                      <label
                        key={col.key}
                        className={`flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-tea-bg transition-colors cursor-pointer ${'alwaysVisible' in col && col.alwaysVisible ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={visibleColumns.includes(col.key)}
                          onChange={() => !('alwaysVisible' in col && col.alwaysVisible) && toggleColumn(col.key)}
                          disabled={'alwaysVisible' in col && col.alwaysVisible}
                          className="accent-tea-gold"
                        />
                        <span className="text-tea-text">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Desktop: options (export) */}
            <div className="relative hidden md:block">
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="p-1.5 text-tea-text-sec hover:text-tea-text transition-colors rounded-xl hover:bg-tea-surface"
              >
                <MoreHorizontal size={16} />
              </button>
              {showOptions && (
                <>
                  <div className="fixed inset-0 z-modal" onClick={() => setShowOptions(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-tea-surface border border-tea-border shadow-2xl rounded-xl z-popover py-1 flex flex-col">
                    <button
                      onClick={() => { handleExport(); setShowOptions(false); }}
                      className="px-4 py-2 text-left text-xs text-tea-text-sec hover:text-tea-text hover:bg-tea-bg flex items-center gap-2 transition-colors"
                    >
                      <Download size={14} /> Export CSV
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Add button */}
            <button
              onClick={() => { setEditingCustomer(null); setIsModalOpen(true); }}
              className="w-9 h-9 flex items-center justify-center text-tea-text-sec hover:text-tea-gold transition-colors rounded-md md:hidden"
              title="Add customer"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => { setEditingCustomer(null); setIsModalOpen(true); }}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 active:bg-tea-gold/80 transition-colors"
            >
              <Plus size={13} />
              <span>New</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- CONTENT --- */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-tea-bg md:px-6">

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-tea-text-sec">
            <Users size={32} className="opacity-40" />
            <span className="font-serif italic">{search || filterTags.length > 0 || filterAttendedEvents ? 'Nothing matched — try different words.' : 'No customers yet.'}</span>
            {(search || filterTags.length > 0 || filterAttendedEvents) && (
              <button onClick={() => { setSearch(''); setFilterTags([]); setFilterAttendedEvents(false); }} className="text-xs text-tea-gold hover:text-tea-gold/80 transition-colors">
                Clear filters
              </button>
            )}
            {search && filterTags.length === 0 && !filterAttendedEvents && (
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
                        <span className="text-ui-9 text-tea-text-sec uppercase tracking-[0.08em]">
                          {customer.tags[0]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-ui-10 text-tea-text-sec/70 mt-0.5">
                      {customer.company && <span className="truncate">{customer.company}</span>}
                      {customer.company && customer.country && <span className="opacity-40">·</span>}
                      {customer.country && (
                        <span className="flex items-center gap-0.5"><MapPin size={8} /> {customer.country}</span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs text-tea-text tabular-nums">{formatUSD(customer.totalSpentUSD)}</div>
                    <div className="text-ui-10 text-tea-text-sec/60 tabular-nums flex items-center justify-end gap-1.5">
                      <span>{customer.orderCount || 0} order{(customer.orderCount || 0) !== 1 ? 's' : ''}</span>
                      {(customer.eventCount || 0) > 0 && (
                        <span className="flex items-center gap-0.5 text-tea-gold">
                          <Calendar size={8} />
                          {customer.eventCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Contact channel dots */}
                  {(customer.contacts?.length > 0 || customer.email || customer.phone || customer.whatsapp) && (
                    <div className="flex flex-col items-center gap-0.5 text-tea-text-sec/40 flex-shrink-0">
                      {(customer.contacts?.length > 0
                        ? customer.contacts.slice(0, 3)
                        : [
                            ...(customer.phone    ? [{ channel: 'phone'    as ContactChannel }] : []),
                            ...(customer.whatsapp ? [{ channel: 'whatsapp' as ContactChannel }] : []),
                            ...(customer.email    ? [{ channel: 'email'    as ContactChannel }] : []),
                          ]
                      ).map((c, i) => {
                        const { Icon } = CHANNEL_CONFIG[c.channel] ?? CHANNEL_CONFIG.other;
                        return <Icon key={i} size={10} />;
                      })}
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* DESKTOP TABLE */}
            <div className="w-full max-w-7xl mx-auto bg-tea-surface min-h-full hidden md:block">
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  {visibleCols.map(col => <col key={col.key} className={col.defaultWidth} />)}
                  <col className="w-[6%]" />
                </colgroup>
                <thead className="sticky top-0 z-sticky bg-tea-bg">
                  <tr>
                    {visibleCols.map(col => {
                      const SORTABLE = new Set<string>(['name', 'company', 'country', 'spent', 'orders', 'added']);
                      if (!SORTABLE.has(col.key)) {
                        return (
                          <th key={col.key} className="px-4 py-2 border-b border-tea-border font-serif text-ui-11 uppercase tracking-display text-tea-text-sec font-normal text-left truncate">
                            {col.label}
                          </th>
                        );
                      }
                      return (
                        <SortHeader
                          key={col.key}
                          colKey={col.key as CustomerSortKey}
                          label={col.label}
                          align={col.key === 'orders' ? 'center' : col.key === 'spent' ? 'right' : 'left'}
                        />
                      );
                    })}
                    <th className="px-2 py-2 border-b border-tea-border" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(customer => renderRow(customer))}
                </tbody>
              </table>
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
          filterAttendedEvents={filterAttendedEvents}
        />
      )}

      <ConfirmModal
        isOpen={!!pendingDeleteCustomer}
        onClose={() => setPendingDeleteCustomer(null)}
        onConfirm={handleConfirmDelete}
        title={`Delete ${pendingDeleteCustomer?.type === 'supplier' ? 'supplier' : 'customer'}?`}
        description={`"${pendingDeleteCustomer?.name}" will be removed. Their invoices will be preserved but unlinked.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteLoading}
      />
    </div>
  );
};
