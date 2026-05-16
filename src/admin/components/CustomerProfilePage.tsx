import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MessageCircle, Leaf, Loader2, ShoppingBag,
  Calendar, Edit3, Star, Package, Search, Check, Copy, X,
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
}

const fmtUSD = (v?: number | null) =>
  v == null ? '—' : `$${v.toFixed(0)}`;

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
    <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-tea-gold" />
            <p className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec">Owner private note</p>
          </div>
          <p className="text-ui-11 text-tea-text-sec mt-1">
            Visible only to owner-tier accounts.
          </p>
        </div>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-tea-gold text-tea-bg text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Save
        </button>
      </div>
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={4}
        placeholder="Context that belongs with the relationship, not in public or staff-facing notes..."
        className="w-full bg-tea-bg border border-tea-border rounded-xl p-3 text-sm text-tea-text resize-y min-h-[112px] focus:outline-none focus:border-tea-gold/50 placeholder:text-tea-text-sec"
      />
    </div>
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
        `Hi ${firstName}! 🍵`,
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
          <h3 className="font-serif text-tea-text text-lg">Send sample to {firstName}</h3>
          <button onClick={onClose} className="text-tea-text-sec hover:text-tea-text transition-colors p-1"><X size={20} /></button>
        </div>
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tea-text-dim" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pick a tea to sample…"
              className="w-full bg-tea-surface border border-tea-border rounded-xl pl-8 pr-3 py-1.5 text-sm text-tea-text focus:outline-none focus:border-tea-gold/50 placeholder:text-tea-text-dim"
            />
          </div>
          <div className="space-y-1.5 max-h-44 overflow-y-auto">
            {eligible.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${
                  selectedId === p.id ? 'bg-tea-gold/8 border-tea-gold/25' : 'bg-tea-surface border-tea-border hover:bg-tea-elevated'
                }`}
              >
                {p.imageUrl && <img src={p.imageUrl} alt="" className="w-8 h-8 rounded-xl object-cover shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-tea-text truncate">{p.givenName || p.productName}</p>
                  <p className="text-ui-11 text-tea-text-sec">{[p.type, p.originRegion].filter(Boolean).join(' · ')}</p>
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
                className="w-full bg-tea-surface border border-tea-border rounded-xl p-2.5 text-sm text-tea-text resize-none focus:outline-none focus:border-tea-gold/50 placeholder:text-tea-text-dim"
              />
              <pre className="text-ui-11 text-tea-text-sec leading-relaxed whitespace-pre-wrap bg-tea-surface rounded-xl p-3 font-sans">
                {message}
              </pre>
              <div className="flex gap-2">
                <button onClick={handleCopy} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-tea-elevated text-tea-text-sec hover:text-tea-text text-sm transition-colors">
                  <Copy size={13} />{copied ? 'Copied!' : 'Copy'}
                </button>
                {whatsappUrl && (
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-green-500/10 text-green-400 hover:bg-green-500/15 text-sm transition-colors">
                    <MessageCircle size={13} />WhatsApp
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-tea-bg">
        <Loader2 className="animate-spin text-tea-text-sec" size={24} />
      </div>
    );
  }

  if (!customer) {
    return <div className="p-8 text-tea-text-sec text-center bg-tea-bg h-full">Customer not found.</div>;
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

  return (
    <>
      <div className="h-full overflow-y-auto bg-tea-bg pb-nav-gap">
        {/* Sticky top bar */}
        <div className="sticky top-0 z-10 bg-tea-bg/95 backdrop-blur-sm border-b border-tea-border px-4 md:px-8 py-3 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text transition-colors text-sm"
          >
            <ArrowLeft size={15} />
            Back
          </button>
          <button
            onClick={() => navigate(`/admin/people?customerId=${customerId}`)}
            className="flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text transition-colors text-sm"
          >
            <Edit3 size={13} />
            Edit profile
          </button>
        </div>

        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-8">
          {/* Identity */}
          <div>
            <h1 className="font-serif text-3xl text-tea-text">{customer.name}</h1>
            {customer.company && <p className="text-tea-text-sec mt-1">{customer.company}</p>}
            {(customer.relationshipKinds?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {CONTACT_RELATIONSHIP_ORDER
                  .filter(kind => customer.relationshipKinds?.includes(kind))
                  .map(kind => (
                    <span key={kind} className={`text-ui-11 px-2 py-1 rounded-full ${RELATIONSHIP_BADGE_CLASSES[kind] || 'bg-tea-elevated text-tea-text-sec'}`}>
                      {relationshipLabel(kind)}
                    </span>
                  ))}
              </div>
            )}
            {journey?.memberSince && (
              <p className="text-tea-text-dim text-sm mt-1">
                Member since {new Date(journey.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            )}
            {journey?.portrait && (
              <p className="text-tea-text-sec text-sm mt-2 italic font-serif leading-relaxed">
                {journey.portrait}
              </p>
            )}
            {preferredTypes.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <Leaf size={11} className="text-tea-text-dim" />
                {preferredTypes.map(t => (
                  <span key={t} className="text-ui-11 bg-tea-elevated text-tea-text-sec px-2 py-0.5 rounded">{t}</span>
                ))}
              </div>
            )}
          </div>

          {/* Contact tags */}
          <ContactTagEditor customerId={customer.id} />

          <OwnerPrivateNote
            customerId={customer.id}
            onRelationshipKinds={(kinds) => setCustomer(prev => prev ? ({ ...prev, relationshipKinds: kinds }) : prev)}
          />

          {(customer.relationshipKinds?.length ?? 0) > 0 && (
            <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
              <p className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec mb-3">Relationship portrait</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CONTACT_RELATIONSHIP_ORDER
                  .filter(kind => customer.relationshipKinds?.includes(kind))
                  .map(kind => (
                    <div key={kind} className="bg-tea-bg border border-tea-border rounded-xl p-3">
                      <div className="text-sm font-serif text-tea-text mb-1">{CONTACT_RELATIONSHIP_TAXONOMY[kind].label}</div>
                      <div className="text-ui-11 text-tea-text-sec leading-relaxed">
                        {CONTACT_RELATIONSHIP_TAXONOMY[kind].description}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { value: sessionsCount, label: 'Sessions' },
              { value: teas.length, label: 'Teas tried' },
              { value: customer.orderCount ?? orders.length, label: 'Orders' },
              { value: fmtUSD(customer.totalSpentUSD), label: 'Total spent' },
            ].map(({ value, label }) => (
              <div key={label} className="bg-tea-surface border border-tea-border rounded-xl p-4 text-center">
                <div className="text-2xl font-serif text-tea-text leading-tight">{value}</div>
                <div className="text-ui-10 text-tea-text-sec uppercase tracking-wider mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Milestones */}
          {journey?.milestones && journey.milestones.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {journey.milestones.map((m) => (
                <span
                  key={m}
                  className="text-ui-10 uppercase tracking-[0.12em] bg-tea-gold/10 text-tea-gold px-2.5 py-1 rounded-full"
                >
                  {m}
                </span>
              ))}
            </div>
          )}

          {/* Action bar */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowRecommend(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-tea-gold/10 text-tea-gold hover:bg-tea-gold/15 text-sm font-medium transition-colors"
            >
              <Leaf size={14} />
              Recommend teas
            </button>
            <button
              onClick={() => setShowSample(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-tea-surface border border-tea-border text-tea-text-sec hover:text-tea-text text-sm transition-colors"
            >
              <Package size={14} />
              Send sample
            </button>
            <button
              onClick={() => setShowInvoice(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-tea-surface border border-tea-border text-tea-text-sec hover:text-tea-text text-sm transition-colors"
            >
              <ShoppingBag size={14} />
              Create invoice
            </button>
            {whatsappHandle && (
              <a
                href={`https://wa.me/${whatsappHandle.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/10 text-green-400 hover:bg-green-500/15 text-sm transition-colors"
              >
                <MessageCircle size={14} />
                WhatsApp
              </a>
            )}
          </div>

          {/* Last session context */}
          {lastEvent && (
            <div className="bg-tea-surface border border-tea-border rounded-xl p-5">
              <p className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec mb-3">Last session</p>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-tea-text">{lastEvent.title}</p>
                  <p className="text-sm text-tea-text-sec mt-0.5">
                    {lastEvent.event_date &&
                      new Date(lastEvent.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    {lastEvent.location_name && ` · ${lastEvent.location_name}`}
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/admin/events/${lastEvent.slug || lastEvent.id}`)}
                  className="flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-gold transition-colors shrink-0"
                >
                  <Calendar size={12} />
                  View event
                </button>
              </div>
              {attendedEvents.length > 1 && (
                <p className="text-ui-11 text-tea-text-dim mt-3">
                  +{attendedEvents.length - 1} earlier session{attendedEvents.length > 2 ? 's' : ''} — see Event history below
                </p>
              )}
            </div>
          )}

          {/* Teas tried */}
          {teas.length > 0 && (
            <div>
              <p className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec mb-3">
                Teas tried <span className="ml-1 normal-case text-tea-text-dim">({teas.length})</span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {teas.map(tea => (
                  <div key={tea.id} className="flex items-center gap-2 bg-tea-surface border border-tea-border rounded-xl p-2.5">
                    {tea.image_url ? (
                      <img src={tea.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-tea-elevated shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-tea-text truncate">{tea.given_name || tea.product_name}</p>
                      <p className="text-ui-10 text-tea-text-sec">{[tea.type, tea.origin_region].filter(Boolean).join(' · ')}</p>
                      {tea.source === 'tasted_at_event' && (
                        <p className="text-ui-9 text-tea-text-dim">at session</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Event history */}
          {events.length > 0 && (
            <div>
              <p className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec mb-3">
                Event history <span className="ml-1 normal-case text-tea-text-dim">({events.length})</span>
              </p>
              <div className="space-y-1.5">
                {events
                  .slice()
                  .sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''))
                  .map(evt => (
                    <div key={evt.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 bg-tea-surface border border-tea-border rounded-xl"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${evt.attended === 1 ? 'bg-green-400' : 'bg-tea-text-dim'}`} />
                        <span className="text-sm text-tea-text truncate">{evt.title}</span>
                        {evt.attendee_status && evt.attendee_status !== 'confirmed' && (
                          <span className="text-ui-10 text-tea-text-dim shrink-0">({evt.attendee_status})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {evt.event_date && (
                          <span className="text-ui-11 text-tea-text-sec">
                            {new Date(evt.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                        <button
                          onClick={() => navigate(`/admin/events/${evt.slug || evt.id}`)}
                          className="text-tea-text-dim hover:text-tea-gold text-xs transition-colors"
                        >
                          →
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Impressions */}
          {journey?.impressions && journey.impressions.length > 0 && (
            <div>
              <p className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec mb-3">
                Tasting notes <span className="ml-1 normal-case text-tea-text-dim">({journey.impressions.length})</span>
              </p>
              <div className="space-y-2">
                {journey.impressions.slice(0, 8).map((imp, i) => (
                  <div key={i} className="bg-tea-surface border border-tea-border rounded-xl px-4 py-3">
                    <p className="text-sm text-tea-text italic leading-relaxed">"{imp.text}"</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-ui-10 text-tea-text-sec">
                        {imp.teaName} · {imp.eventTitle} ·{' '}
                        {new Date(imp.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </p>
                      {imp.eventSlug && (
                        <button
                          onClick={() => navigate(`/admin/events/${imp.eventSlug}`)}
                          className="text-tea-text-dim hover:text-tea-gold text-xs transition-colors shrink-0 ml-3"
                        >
                          →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Orders */}
          {orders.length > 0 && (
            <div>
              <p className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec mb-3">
                Orders <span className="ml-1 normal-case text-tea-text-dim">({orders.length})</span>
              </p>
              <div className="space-y-1.5">
                {orders.map((order: any) => (
                  <div key={order.id}
                    className="flex items-center justify-between px-3 py-2.5 bg-tea-surface border border-tea-border rounded-xl text-sm"
                  >
                    <span className="text-tea-text">
                      #{order.invoice_number}
                      {order.source_event_title && (
                        <span className="text-tea-text-dim ml-2 text-ui-11">· {order.source_event_title}</span>
                      )}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-ui-11 text-tea-text-sec">{order.status}</span>
                      {order.payment_status && (
                        <span className={`text-ui-10 px-1.5 py-0.5 rounded ${
                          order.payment_status === 'paid' ? 'bg-green-500/10 text-green-400'
                          : order.payment_status === 'partial' ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-tea-elevated text-tea-text-dim'
                        }`}>
                          {order.payment_status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {customer.notes && (
            <div>
              <p className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec mb-2">Notes</p>
              <p className="text-sm text-tea-text-sec leading-relaxed">{customer.notes}</p>
            </div>
          )}

          {/* Empty state */}
          {!lastEvent && teas.length === 0 && orders.length === 0 && (
            <div className="text-center py-12 text-tea-text-dim text-sm">
              <p>No session history yet.</p>
              <p className="mt-1">When {customer.name.split(' ')[0]} attends an event and their record is linked, everything will appear here.</p>
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
