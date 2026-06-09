import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MessageCircle, Leaf, Loader2, ShoppingBag,
  Calendar, Edit3, Package, Search, Check, Copy, X,
  Lock, Save,
} from 'lucide-react';
import { api } from '../../lib/api';
import { CONTACT_RELATIONSHIP_ORDER, CONTACT_RELATIONSHIP_TAXONOMY } from '../../lib/contactTaxonomy';
import { ContactRelationshipKind, Customer, Product } from '../types';
import { useProducts } from '../hooks/useAdminData';
import { useToast } from './Toast';
import { RecommendationModal } from './RecommendationModal';
import { QuickInvoiceModal } from './QuickInvoiceModal';
import { ContactTagEditor } from './contactTags/ContactTagEditor';
import { STATUS_PILL_BASE, STATUS_PILL_VARIANTS, type StatusPillVariant } from '../constants';
import { THREADS, threadsFromStored } from '../../components/TeaDiscovery/threads';

interface CustomerTea {
  id: string;
  given_name?: string;
  product_name?: string;
  type?: string;
  origin_region?: string;
  image_url?: string;
  total_quantity: number;
  order_count: number;
  source?: 'purchased' | 'tasted_at_event';
}

interface CustomerEvent {
  id: string;
  slug?: string;
  title: string;
  event_date?: string;
  location_name?: string;
  attendee_status?: string;
  attended?: 0 | 1 | null;
}

interface CustomerJourney {
  sessionsAttended?: number;
  totalTeas?: number;
  milestones?: string[];
  teaTypeMap?: Record<string, number>;
  favorites?: string[];
  impressions?: Array<{ text: string; teaName: string; eventTitle: string; eventSlug?: string; date: string }>;
  memberSince?: string;
  portrait?: string;
  teaDiscoveryProfile?: {
    dispositionId: string | null;
    dispositionName: string | null;
    level: string | null;
    completedAt: string | null;
  } | null;
}

const fmtUSD = (v?: number | null) =>
  v == null ? '—' : `$${v.toFixed(0)}`;

const RELATIONSHIP_PILL_VARIANT: Record<ContactRelationshipKind, StatusPillVariant> = {
  buyer: 'active',
  vendor: 'success',
  event_guest: 'draft',
  collection_recipient: 'draft',
  contributor: 'draft',
  personal_connection: 'draft',
};

const relationshipLabel = (kind: ContactRelationshipKind) =>
  CONTACT_RELATIONSHIP_TAXONOMY[kind]?.shortLabel ?? kind;

const initialsFromName = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || '·';

const StatusPill: React.FC<{ variant?: StatusPillVariant; children: React.ReactNode }> = ({
  variant = 'draft',
  children,
}) => (
  <span className={`${STATUS_PILL_BASE} ${STATUS_PILL_VARIANTS[variant]}`}>{children}</span>
);

const OwnerPrivateNote: React.FC<{
  customerId: string;
  onRelationshipKinds?: (kinds: ContactRelationshipKind[]) => void;
}> = ({ customerId, onRelationshipKinds }) => {
  const { showToast } = useToast();
  const [visible, setVisible] = useState(false);
  const [body, setBody] = useState('');
  const [savedBody, setSavedBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.customers.getPrivateNotes(customerId)
      .then(note => {
        if (cancelled) return;
        const nextBody = typeof note?.body === 'string' ? note.body : '';
        setBody(nextBody);
        setSavedBody(nextBody);
        setVisible(true);
      })
      .catch(() => {
        if (!cancelled) setVisible(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [customerId]);

  const save = async () => {
    setSaving(true);
    try {
      const result = await api.customers.updatePrivateNotes(customerId, body);
      setSavedBody(body);
      if (Array.isArray(result?.relationship_kinds)) {
        onRelationshipKinds?.(result.relationship_kinds);
      }
      showToast('Private note saved.', 'success');
    } catch {
      showToast('Could not save private note.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !visible) return null;

  const dirty = body !== savedBody;

  return (
    <section className="bg-tea-surface border border-tea-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Lock size={13} className="text-tea-gold" />
            <h3 className="h3">Owner Private Note</h3>
          </div>
          <p className="text-ui-12 text-tea-text-dim mt-1">
            Visible only to owner-tier accounts.
          </p>
        </div>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Save
        </button>
      </div>
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={4}
        placeholder="Context that belongs with the relationship, not in public or staff-facing notes…"
        className="w-full bg-tea-bg border border-tea-border rounded-md p-3 text-ui-13 text-tea-text resize-y min-h-[112px] focus:outline-none focus:border-tea-gold placeholder:text-tea-text-sec"
      />
    </section>
  );
};

// ── Sample offer modal (admin-side WhatsApp sample pitch) ──────────────────
const SampleOfferModal: React.FC<{
  customer: Customer;
  products: Product[];
  onClose: () => void;
}> = ({ customer, products, onClose }) => {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);

  const eligible = products.filter(
    p => p.status === 'Active' && p.type !== 'Teaware' &&
      (!search || (p.givenName + ' ' + p.productName).toLowerCase().includes(search.toLowerCase()))
  );

  const selected = selectedId ? products.find(p => p.id === selectedId) : null;
  const firstName = customer.name.split(' ')[0];

  const whatsappHandle =
    customer.contacts.find(c => c.channel === 'whatsapp')?.handle ||
    customer.whatsapp ||
    customer.phone;

  const message = selected
    ? [
        `Hi ${firstName}!`,
        '',
        `I have a sample of ${selected.givenName || selected.productName} I'd love to send you — ${[selected.type, selected.originRegion].filter(Boolean).join(', ')}.`,
        note.trim() ? note.trim() : '',
        `Would you be interested? Just let me know and I'll get it sorted.`,
      ].filter(l => l !== undefined).join('\n')
    : '';

  const whatsappUrl = whatsappHandle && selected
    ? `https://wa.me/${whatsappHandle.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
    : null;

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-modal flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
      <div className="bg-tea-bg border border-tea-border rounded-t-xl sm:rounded-xl w-full sm:max-w-lg shadow-2xl flex flex-col max-h-[88vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-tea-border flex-shrink-0">
          <button
            onClick={onClose}
            className="text-tea-text-sec hover:text-tea-text transition-colors p-1 tap-target"
            aria-label="Close"
          >
            <X size={18} />
          </button>
          <h3 className="h3">Send Sample to {firstName}</h3>
          <span className="w-7" aria-hidden="true" />
        </div>
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tea-text-dim" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pick a tea to sample…"
              className="w-full bg-tea-surface border border-tea-border rounded-md pl-8 pr-3 py-1.5 text-ui-13 text-tea-text focus:outline-none focus:border-tea-gold placeholder:text-tea-text-dim"
            />
          </div>
          <div className="space-y-1.5 max-h-44 overflow-y-auto">
            {eligible.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${
                  selectedId === p.id
                    ? 'bg-tea-gold/8 border-tea-gold'
                    : 'bg-tea-surface border-tea-border hover:bg-tea-elevated'
                }`}
              >
                {p.imageUrl && (
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="w-8 h-8 rounded-md object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-ui-13 text-tea-text truncate">
                    {p.givenName || p.productName}
                  </p>
                  <p className="text-ui-11 text-tea-text-sec">
                    {[p.type, p.originRegion].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {selectedId === p.id && <Check size={14} className="text-tea-gold shrink-0" />}
              </button>
            ))}
          </div>
          {selected && (
            <>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Add a personal note…"
                rows={2}
                className="w-full bg-tea-surface border border-tea-border rounded-md p-2.5 text-ui-13 text-tea-text resize-none focus:outline-none focus:border-tea-gold placeholder:text-tea-text-dim"
              />
              <pre className="text-ui-11 text-tea-text-sec leading-relaxed whitespace-pre-wrap bg-tea-surface rounded-xl p-3 font-sans">
                {message}
              </pre>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-tea-surface border border-tea-border text-tea-text-sec hover:text-tea-text text-xs font-semibold transition-colors"
                >
                  <Copy size={13} />
                  {copied ? 'Copied' : 'Copy'}
                </button>
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-tea-gold text-tea-bg hover:bg-tea-gold/90 text-xs font-semibold transition-colors"
                  >
                    <MessageCircle size={13} />
                    WhatsApp
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main profile page ──────────────────────────────────────────────────────
export const CustomerProfilePage: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: allProducts = [] } = useProducts();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [teas, setTeas] = useState<CustomerTea[]>([]);
  const [events, setEvents] = useState<CustomerEvent[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [journey, setJourney] = useState<CustomerJourney | null>(null);
  const [loading, setLoading] = useState(true);

  const [showRecommend, setShowRecommend] = useState(false);
  const [showSample, setShowSample] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    api.customers.get(customerId).then(async (c) => {
      const [teasResult, eventsResult, ordersResult] = await Promise.allSettled([
        api.customers.getTeas(customerId),
        api.customers.getEvents(customerId),
        api.customers.getOrders(customerId),
      ]);
      setCustomer({
        ...c,
        relationshipKinds: Array.isArray(c.relationship_kinds)
          ? c.relationship_kinds
          : (c.relationshipKinds || []),
      });
      setTeas(teasResult.status === 'fulfilled' ? (teasResult.value || []) : []);
      setEvents(eventsResult.status === 'fulfilled' ? (eventsResult.value || []) : []);
      setOrders(ordersResult.status === 'fulfilled' ? (ordersResult.value || []) : []);
    }).catch(() => {
      showToast('Failed to load profile', 'error');
    }).finally(() => setLoading(false));

    // Journey loads separately — non-blocking
    api.events.getCustomerJourney(customerId)
      .then(j => setJourney(j))
      .catch(() => {});
  }, [customerId]);

  // Build a unified activity timeline from orders, events, and impressions.
  const timeline = useMemo(() => {
    const items: Array<{ date: string; iso: string; label: string; body: string; system?: boolean }> = [];

    orders.forEach((order: any) => {
      const iso = order.created_at || order.createdAt || '';
      items.push({
        iso,
        date: iso
          ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '—',
        label: 'Order',
        body: `Invoice #${order.invoice_number}${order.status ? ` — ${order.status}` : ''}`,
      });
    });

    events.forEach((evt) => {
      if (!evt.event_date) return;
      items.push({
        iso: evt.event_date,
        date: new Date(evt.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        label: evt.attended === 1 ? 'Session attended' : 'Event',
        body: evt.title,
      });
    });

    journey?.impressions?.forEach((imp) => {
      items.push({
        iso: imp.date,
        date: new Date(imp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        label: 'Tasting note',
        body: `"${imp.text}" — ${imp.teaName}`,
        system: true,
      });
    });

    return items
      .filter(i => i.iso)
      .sort((a, b) => (b.iso || '').localeCompare(a.iso || ''))
      .slice(0, 10);
  }, [orders, events, journey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-tea-bg">
        <Loader2 className="animate-spin text-tea-text-sec" size={20} />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 text-tea-text-sec text-center bg-tea-bg h-full">
        Customer not found.
      </div>
    );
  }

  const whatsappHandle =
    customer.contacts.find(c => c.channel === 'whatsapp')?.handle ||
    customer.whatsapp ||
    customer.phone;

  const preferredTypes: string[] = journey?.favorites?.length
    ? journey.favorites
    : Object.entries(journey?.teaTypeMap || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k]) => k);

  const attendedEvents = events
    .filter(e => e.attended === 1)
    .sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''));

  const lastEvent = attendedEvents[0];

  const sessionsCount = journey?.sessionsAttended ?? customer.eventCount ?? attendedEvents.length;
  const initials = initialsFromName(customer.name);

  const orderedRelationshipKinds = CONTACT_RELATIONSHIP_ORDER.filter(
    kind => customer.relationshipKinds?.includes(kind),
  );

  const primaryContact =
    customer.email ||
    customer.contacts.find(c => c.channel === 'whatsapp')?.handle ||
    customer.whatsapp ||
    customer.phone ||
    '';

  const memberSinceText = journey?.memberSince
    ? `Member since ${new Date(journey.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
    : customer.company
      ? customer.company
      : '';

  return (
    <>
      <div className="h-full overflow-y-auto bg-tea-bg pb-nav-gap">
        {/* Narrow chrome */}
        <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 pb-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 text-ui-13 text-tea-text-sec hover:text-tea-text transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>
            <button
              onClick={() => navigate(`/admin/people?customerId=${customerId}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-surface border border-tea-border text-tea-text-sec hover:text-tea-text text-xs font-semibold transition-colors"
            >
              <Edit3 size={13} />
              <span>Edit Profile</span>
            </button>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 md:px-6 pb-12 space-y-6">
          {/* Identity card */}
          <section className="bg-tea-surface border border-tea-border rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-tea-elevated text-tea-text-sec font-display text-ui-15 flex items-center justify-center flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="h3">{customer.name}</h3>
                {primaryContact && (
                  <p className="text-ui-13 text-tea-text-sec mt-0.5 truncate">{primaryContact}</p>
                )}
                {memberSinceText && (
                  <p className="text-ui-12 text-tea-text-dim mt-0.5">{memberSinceText}</p>
                )}
                {orderedRelationshipKinds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {orderedRelationshipKinds.map(kind => (
                      <StatusPill key={kind} variant={RELATIONSHIP_PILL_VARIANT[kind] ?? 'draft'}>
                        {relationshipLabel(kind)}
                      </StatusPill>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick action bar */}
            <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-tea-border">
              <button
                onClick={() => setShowRecommend(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg hover:bg-tea-gold/90 text-xs font-semibold transition-colors"
              >
                <Leaf size={13} />
                <span>Recommend Teas</span>
              </button>
              <button
                onClick={() => setShowSample(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-surface border border-tea-border text-tea-text-sec hover:text-tea-text text-xs font-semibold transition-colors"
              >
                <Package size={13} />
                <span>Send Sample</span>
              </button>
              <button
                onClick={() => setShowInvoice(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-surface border border-tea-border text-tea-text-sec hover:text-tea-text text-xs font-semibold transition-colors"
              >
                <ShoppingBag size={13} />
                <span>Create Invoice</span>
              </button>
              {whatsappHandle && (
                <a
                  href={`https://wa.me/${whatsappHandle.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-surface border border-tea-border text-tea-text-sec hover:text-tea-text text-xs font-semibold transition-colors"
                >
                  <MessageCircle size={13} />
                  <span>WhatsApp</span>
                </a>
              )}
            </div>
          </section>

          {/* Portrait — editorial detail */}
          {(journey?.portrait || preferredTypes.length > 0 || (journey?.milestones?.length ?? 0) > 0) && (
            <section className="bg-tea-surface border border-tea-border rounded-xl p-5">
              <h3 className="h3 mb-1">Portrait</h3>
              <p className="label-caps text-tea-text-dim mb-4">Tea preferences & history</p>
              {journey?.portrait && (
                <p className="text-ui-13 text-tea-text-sec italic leading-relaxed">
                  {journey.portrait}
                </p>
              )}
              {preferredTypes.length > 0 && (
                <div className="flex items-center gap-1.5 mt-4 flex-wrap">
                  <Leaf size={11} className="text-tea-text-dim" />
                  {preferredTypes.map(t => (
                    <StatusPill key={t} variant="draft">{t}</StatusPill>
                  ))}
                </div>
              )}
              {journey?.milestones && journey.milestones.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {journey.milestones.map((m) => (
                    <StatusPill key={m} variant="active">{m}</StatusPill>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Tea Discovery — the threads that draw them, plus where they are in the
              practice. Stated preference, complementing the observed Portrait above. */}
          {journey?.teaDiscoveryProfile?.dispositionId && (() => {
            const disc = journey.teaDiscoveryProfile!;
            const threads = threadsFromStored(disc.dispositionId).map((id) => THREADS[id]).filter(Boolean);
            const name = threads.length
              ? threads.map((t) => t.name).join(' · ')
              : disc.dispositionName || 'Tea profile';
            return (
              <section className="bg-tea-surface border border-tea-border rounded-xl p-5">
                <h3 className="h3 mb-1">Tea Profile</h3>
                <p className="label-caps text-tea-text-dim mb-4">What draws them · from onboarding</p>
                <div className="bg-tea-bg border border-tea-border rounded-xl p-4">
                  <div className="font-display text-ui-20 text-tea-text leading-tight">{name}</div>
                  {threads.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {threads.map((t) => (
                        <p key={t.id} className="text-ui-13 text-tea-text-sec leading-relaxed">
                          <span className="text-tea-text">{t.name}</span> — {t.description}
                        </p>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    {disc.level && <StatusPill variant="draft">{disc.level}</StatusPill>}
                    {disc.completedAt && (
                      <span className="label-caps text-tea-text-dim">
                        {new Date(disc.completedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </section>
            );
          })()}

          {/* Stats row */}
          <section className="bg-tea-surface border border-tea-border rounded-xl p-5">
            <h3 className="h3 mb-4">At a Glance</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: String(sessionsCount), label: 'Sessions' },
                { value: String(teas.length), label: 'Teas tried' },
                { value: String(customer.orderCount ?? orders.length), label: 'Orders' },
                { value: fmtUSD(customer.totalSpentUSD), label: 'Total spent' },
              ].map(({ value, label }) => (
                <div key={label} className="bg-tea-bg border border-tea-border rounded-xl p-4">
                  <div className="font-mono text-ui-28 text-tea-text tabular-nums leading-none">
                    {value}
                  </div>
                  <div className="label-caps text-tea-text-dim mt-2">{label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Tags row */}
          <section className="bg-tea-surface border border-tea-border rounded-xl p-5">
            <h3 className="h3 mb-4">Tags</h3>
            <ContactTagEditor customerId={customer.id} />
          </section>

          {/* Relationship portrait */}
          {orderedRelationshipKinds.length > 0 && (
            <section className="bg-tea-surface border border-tea-border rounded-xl p-5">
              <h3 className="h3 mb-1">Relationship Portrait</h3>
              <p className="label-caps text-tea-text-dim mb-4">How we know them</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {orderedRelationshipKinds.map(kind => (
                  <div key={kind} className="bg-tea-bg border border-tea-border rounded-xl p-3">
                    <div className="h3 mb-1">{CONTACT_RELATIONSHIP_TAXONOMY[kind].label}</div>
                    <div className="text-ui-12 text-tea-text-sec leading-relaxed">
                      {CONTACT_RELATIONSHIP_TAXONOMY[kind].description}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recent orders */}
          {orders.length > 0 && (
            <section className="bg-tea-surface border border-tea-border rounded-xl p-5">
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="h3">Recent Orders</h3>
                <span className="label-caps text-tea-text-dim">{orders.length}</span>
              </div>
              <div className="border-t border-tea-border">
                {orders.slice(0, 8).map((order: any) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-3 py-3 border-b border-tea-border last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-ui-13 text-tea-text tabular-nums truncate">
                        #{order.invoice_number}
                      </p>
                      {order.created_at && (
                        <p className="label-caps text-tea-text-dim mt-0.5">
                          {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    {order.total != null && (
                      <span className="font-mono text-ui-13 text-tea-text tabular-nums">
                        ${Number(order.total).toFixed(2)}
                      </span>
                    )}
                    <StatusPill
                      variant={
                        order.payment_status === 'paid'
                          ? 'success'
                          : order.payment_status === 'partial'
                            ? 'active'
                            : order.status === 'Filled'
                              ? 'active'
                              : 'draft'
                      }
                    >
                      {order.payment_status || order.status || '—'}
                    </StatusPill>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Teas tried */}
          {teas.length > 0 && (
            <section className="bg-tea-surface border border-tea-border rounded-xl p-5">
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="h3">Teas Tried</h3>
                <span className="label-caps text-tea-text-dim">{teas.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {teas.map(tea => (
                  <div
                    key={tea.id}
                    className="flex items-center gap-3 bg-tea-bg border border-tea-border rounded-xl p-3"
                  >
                    {tea.image_url ? (
                      <img src={tea.image_url} alt="" className="w-9 h-9 rounded-md object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-md bg-tea-elevated shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-ui-13 text-tea-text truncate">{tea.given_name || tea.product_name}</p>
                      <p className="label-caps text-tea-text-dim mt-0.5 truncate">
                        {[tea.type, tea.origin_region].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {tea.source === 'tasted_at_event' && (
                      <StatusPill variant="draft">Session</StatusPill>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Last session highlight */}
          {lastEvent && (
            <section className="bg-tea-surface border border-tea-border rounded-xl p-5">
              <h3 className="h3 mb-1">Last Session</h3>
              <p className="label-caps text-tea-text-dim mb-4">Most recent event attended</p>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-ui-14 text-tea-text">{lastEvent.title}</p>
                  <p className="text-ui-12 text-tea-text-sec mt-0.5">
                    {lastEvent.event_date &&
                      new Date(lastEvent.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    {lastEvent.location_name && ` · ${lastEvent.location_name}`}
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/admin/events/${lastEvent.slug || lastEvent.id}`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-bg border border-tea-border text-tea-text-sec hover:text-tea-text text-xs font-semibold transition-colors shrink-0"
                >
                  <Calendar size={13} />
                  <span>View Event</span>
                </button>
              </div>
              {attendedEvents.length > 1 && (
                <p className="text-ui-12 text-tea-text-dim mt-3">
                  +{attendedEvents.length - 1} earlier session{attendedEvents.length > 2 ? 's' : ''} — see Activity below
                </p>
              )}
            </section>
          )}

          {/* Activity timeline */}
          {timeline.length > 0 && (
            <section className="bg-tea-surface border border-tea-border rounded-xl p-5">
              <h3 className="h3 mb-1">Activity</h3>
              <p className="text-ui-12 text-tea-text-dim mb-5">Customer audit thread</p>
              <ul className="relative pl-5 border-l border-tea-border space-y-5">
                {timeline.map((e, i) => (
                  <li key={i} className="relative">
                    <span
                      className={`absolute -left-[22px] top-1.5 w-2 h-2 rounded-full ${e.system ? 'bg-tea-text-dim' : 'bg-tea-gold'}`}
                    />
                    <div className="label-caps text-tea-text-dim mb-0.5">{e.date} · {e.label}</div>
                    <div className="text-ui-13 text-tea-text-sec">{e.body}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Notes (staff-facing) */}
          {customer.notes && (
            <section className="bg-tea-surface border border-tea-border rounded-xl p-5">
              <h3 className="h3 mb-1">Notes</h3>
              <p className="label-caps text-tea-text-dim mb-4">Staff-facing</p>
              <p className="text-ui-13 text-tea-text-sec leading-relaxed">{customer.notes}</p>
            </section>
          )}

          {/* Owner private note */}
          <OwnerPrivateNote
            customerId={customer.id}
            onRelationshipKinds={(kinds) => setCustomer(prev => prev ? ({ ...prev, relationshipKinds: kinds }) : prev)}
          />

          {/* Empty state */}
          {!lastEvent && teas.length === 0 && orders.length === 0 && timeline.length === 0 && (
            <div className="text-center py-12 text-tea-text-dim text-ui-13">
              <p>No session history yet.</p>
              <p className="mt-1">
                When {customer.name.split(' ')[0]} attends an event and their record is linked, everything will appear here.
              </p>
            </div>
          )}
        </div>
      </div>

      {showRecommend && (
        <RecommendationModal
          isOpen
          onClose={() => setShowRecommend(false)}
          customer={customer}
          products={allProducts}
          triedTeaIds={teas.map(t => t.id)}
          preferredTypes={preferredTypes}
          lastEventTitle={lastEvent?.title}
        />
      )}

      {showSample && (
        <SampleOfferModal
          customer={customer}
          products={allProducts}
          onClose={() => setShowSample(false)}
        />
      )}

      {showInvoice && (
        <QuickInvoiceModal
          isOpen
          onClose={() => setShowInvoice(false)}
          onSuccess={() => setShowInvoice(false)}
          products={allProducts}
          showToast={showToast}
          prefill={{ vendorName: customer.name }}
        />
      )}
    </>
  );
};
