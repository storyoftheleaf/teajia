import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Leaf, MessageCircle, Phone, Star,
  ShoppingCart, Edit3, Check, ExternalLink,
  Heart, ThumbsUp, Minus, ThumbsDown,
} from 'lucide-react';
import { useSampleStore } from '../samples/sampleStore';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/shared/Toast';
import type { TeaSample, SampleTasting, TastingVerdict, SampleStatus } from '../samples/types';
import { VERDICT_CONFIG, SAMPLE_STATUS_CONFIG } from '../samples/types';
import type { TastingData } from '../types';
import { TastingSession } from '../components/tasting/TastingSession';
import { TastingProfileStrip } from '../components/tasting/TastingProfileStrip';
import { SampleOrderModal } from '../components/samples/SampleOrderModal';
import { TeaReviewsComparison } from '../components/tasting/TeaReviewsComparison';
import { QuickInvoiceModal } from '../admin/components/QuickInvoiceModal';
import { useTeaCompassStore } from '../lib/teaCompassStore';
import { compassLifecycleForSample } from '../samples/sampleLifecycle';

/* ─── Verdict icons ─── */
const VERDICT_ICONS: Record<TastingVerdict, React.ComponentType<{ size?: number }>> = {
  love: Heart,
  like: ThumbsUp,
  neutral: Minus,
  pass: ThumbsDown,
};

/* ─── Status flow for admin ─── */
const STATUS_FLOW: SampleStatus[] = ['untasted', 'tasted', 'favorite', 'ordering', 'ordered', 'passed'];

const SamplePage: React.FC = () => {
  const { sampleId } = useParams<{ sampleId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin } = useAuth();

  const storeSample = useSampleStore((s) => s.getSample(sampleId || ''));
  const addTastingToStore = useSampleStore((s) => s.addTasting);
  const updateStatus = useSampleStore((s) => s.updateSampleStatus);
  const updateSample = useSampleStore((s) => s.updateSample);
  const updateCompassEntry = useTeaCompassStore((s) => s.updateEntry);

  const { toasts, dismiss, showError } = useToast();

  const [sample, setSample] = useState<TeaSample | null>(storeSample || null);
  const [loading, setLoading] = useState(!storeSample);
  const [error, setError] = useState<string | null>(null);

  // Tasting session state
  const [showTasting, setShowTasting] = useState(false);

  useEffect(() => {
    if (!sample || searchParams.get('taste') !== '1') return;
    setShowTasting(true);
    const next = new URLSearchParams(searchParams);
    next.delete('taste');
    setSearchParams(next, { replace: true });
  }, [sample, searchParams, setSearchParams]);

  // Customer order modal
  const [showOrderModal, setShowOrderModal] = useState(false);

  // Admin: purchase order modal
  const [showPOModal, setShowPOModal] = useState(false);

  // Admin edit mode
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Escape key closes tasting section
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showTasting) setShowTasting(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showTasting]);

  // Fetch from API if not in store
  useEffect(() => {
    if (storeSample) {
      setSample(storeSample);
      setLoading(false);
      return;
    }
    if (!sampleId) return;

    setLoading(true);
    api.samples.get(sampleId)
      .then((data: any) => {
        setSample(data as TeaSample);
        setLoading(false);
      })
      .catch(() => {
        setError('Sample not found');
        setLoading(false);
      });
  }, [sampleId, storeSample]);

  useEffect(() => {
    if (sample) {
      setEditName(sample.name);
      setEditNotes(sample.notes || '');
    }
  }, [sample?.id]);

  // Called by TastingSession — first on "Save to Journal", then optionally with verdict
  const handleTastingSave = useCallback(async (
    tastingData: TastingData,
    verdict?: TastingVerdict,
    wouldBuy?: boolean,
  ) => {
    if (!sample) return;

    const tasting: SampleTasting = {
      id: crypto.randomUUID(),
      tasterId: isAdmin ? 'admin' : 'guest',
      tasterName: isAdmin ? 'Adrian' : undefined,
      tasting: tastingData,
      rating: tastingData.quality ?? tastingData.rating,
      verdict: verdict ?? 'neutral',
      wouldBuy: wouldBuy ?? false,
      personalNote: tastingData.notes?.join('\n') || tastingData.voiceNote?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    // Write to sample store (sourcing record)
    addTastingToStore(sample.id, tasting);
    if (sample.compassEntryId) {
      updateCompassEntry(sample.compassEntryId, {
        isSample: true,
        sampleState: 'tasted',
        sampleSetId: sample.setId,
      });
    }

    // Sync to server
    try {
      await api.samples.addTasting(sample.id, {
        tasting: tastingData,
        rating: tasting.rating,
        verdict: verdict ?? 'neutral',
        wouldBuy: wouldBuy ?? false,
        personalNote: tasting.personalNote,
        tasterName: tasting.tasterName,
      });
    } catch {
      console.warn('Sample tasting failed to sync — saved locally');
    }

    setSample((prev) => prev ? {
      ...prev,
      tastings: [...(prev.tastings || []), tasting],
      status: ['requested', 'received', 'untasted'].includes(prev.status) ? 'tasted' : prev.status,
    } : prev);
  }, [sample, isAdmin, addTastingToStore, updateCompassEntry]);

  const handleStatusChange = useCallback((newStatus: SampleStatus) => {
    if (!sample) return;
    const prevStatus = sample.status;
    const previousCompassState = sample.compassEntryId
      ? useTeaCompassStore.getState().entries.find(entry => entry.id === sample.compassEntryId)?.sampleState
      : undefined;
    updateStatus(sample.id, newStatus);
    if (sample.compassEntryId) {
      const sampleState = compassLifecycleForSample({ ...sample, status: newStatus });
      if (sampleState) updateCompassEntry(sample.compassEntryId, { isSample: true, sampleState, sampleSetId: sample.setId });
    }
    setSample((prev) => prev ? { ...prev, status: newStatus } : prev);
    api.samples.update(sample.id, { status: newStatus }).catch(() => {
      updateStatus(sample.id, prevStatus);
      if (sample.compassEntryId) updateCompassEntry(sample.compassEntryId, { sampleState: previousCompassState ?? null });
      setSample((prev) => prev ? { ...prev, status: prevStatus } : prev);
      showError('Status update failed — please try again');
    });
  }, [sample, updateStatus, showError, updateCompassEntry]);

  const handleSaveEdit = useCallback(() => {
    if (!sample) return;
    const prevName = sample.name;
    const prevNotes = sample.notes;
    updateSample(sample.id, { name: editName, notes: editNotes });
    setSample((prev) => prev ? { ...prev, name: editName, notes: editNotes } : prev);
    setEditing(false);
    api.samples.update(sample.id, { name: editName, notes: editNotes }).catch(() => {
      updateSample(sample.id, { name: prevName, notes: prevNotes });
      setSample((prev) => prev ? { ...prev, name: prevName, notes: prevNotes } : prev);
      showError('Edit failed to save — please try again');
    });
  }, [sample, editName, editNotes, updateSample, showError]);

  const handleWhatsAppAsk = useCallback(() => {
    if (!sample?.sourceContact?.whatsapp) return;
    const phone = sample.sourceContact.whatsapp.replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(
      `Hi, I'm interested in the ${sample.name}${sample.year ? ` (${sample.year})` : ''}. Can you share details and pricing?`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  }, [sample]);

  const handleOrderInquiry = useCallback(() => {
    setShowOrderModal(true);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-tea-bg">
        <div className="w-8 h-8 border-2 border-tea-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !sample) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-6 pt-12 pb-nav-gap">
        <div className="flex flex-col items-center text-center py-20 px-6">
          <Leaf size={28} strokeWidth={1.25} className="text-tea-text-dim" />
          <h1 className="font-display text-ui-17 text-tea-text mt-4">Sample not found</h1>
          <p className="text-ui-12 text-tea-text-sec leading-relaxed mt-1">
            This QR code may have expired or the sample was removed.
          </p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors mt-6"
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  const statusCfg = SAMPLE_STATUS_CONFIG[sample.status];
  const hasTastings = sample.tastings && sample.tastings.length > 0;
  const latestTasting = hasTastings ? sample.tastings[sample.tastings.length - 1] : null;
  const heroPhoto = sample.photos && sample.photos.length > 0 ? sample.photos[0] : null;
  const extraPhotos = sample.photos && sample.photos.length > 1 ? sample.photos.slice(1) : [];

  return (
    <div className="min-h-screen bg-tea-bg text-tea-text">
      <div className="max-w-2xl mx-auto px-4 md:px-6 pt-6 pb-nav-gap">
        {/* Back + admin edit toggle */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={14} />
            <span className="text-ui-12">Back</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => editing ? handleSaveEdit() : setEditing(true)}
              className="tap-target inline-flex items-center gap-1.5 px-2 py-1 text-tea-text-sec hover:text-tea-text transition-colors"
              aria-label={editing ? 'Save changes' : 'Edit sample'}
            >
              {editing ? <Check size={14} /> : <Edit3 size={14} />}
              <span className="text-ui-12">{editing ? 'Save' : 'Edit'}</span>
            </button>
          )}
        </div>

        {/* Hero image */}
        {heroPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="aspect-square w-full rounded-xl overflow-hidden bg-tea-elevated border border-tea-border mb-8"
          >
            <img
              src={heroPhoto}
              alt={sample.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </motion.div>
        )}

        {/* Identity */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="label-caps text-tea-text-dim">Tea sample</p>
          {editing ? (
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h2 bg-transparent border-b border-tea-border w-full outline-none text-tea-text pb-1 mt-2"
              autoFocus
            />
          ) : (
            <h1 className="h2 mt-2">{sample.name || 'Unnamed sample'}</h1>
          )}
          {sample.chineseName && (
            <p className="subtitle mt-1">{sample.chineseName}</p>
          )}

          <p className="label-caps text-tea-text-dim mt-3">
            {[sample.originRegion, sample.type, sample.year].filter(Boolean).join(' · ') || '—'}
            {sample.form ? ` · ${sample.form}` : ''}
          </p>

          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-ui-10 uppercase tracking-[0.15em] ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
            {sample.grams > 0 && (
              <span className="inline-flex px-2 py-0.5 rounded-full text-ui-10 uppercase tracking-[0.15em] bg-tea-elevated text-tea-text-sec">
                {sample.grams}g
              </span>
            )}
          </div>
        </motion.div>

        {/* Body / description */}
        {!isAdmin && sample.notes && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="body-prose mt-6"
          >
            {sample.notes}
          </motion.p>
        )}

        {/* Extra photos */}
        {extraPhotos.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex gap-2 overflow-x-auto scrollbar-hide mt-6"
          >
            {extraPhotos.map((url, i) => (
              <img key={i} src={url} alt="" className="h-24 w-24 rounded-md object-cover flex-shrink-0 border border-tea-border" loading="lazy" />
            ))}
          </motion.div>
        )}

        {/* Flavor Profile (if tasted) */}
        {latestTasting && latestTasting.tasting && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8"
          >
            <TastingProfileStrip tasting={latestTasting.tasting} variant="full" />
          </motion.div>
        )}

        {/* Customer CTAs */}
        {!isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="flex flex-wrap gap-2 mt-8"
          >
            <button
              onClick={handleOrderInquiry}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors"
            >
              <ShoppingCart size={14} />
              Add to cart
            </button>
            <button
              onClick={() => setShowTasting(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-tea-border text-tea-text-sec text-xs font-semibold hover:text-tea-text hover:bg-tea-accent-sub transition-colors"
            >
              <Leaf size={14} />
              Taste and add to Journal
            </button>
          </motion.div>
        )}

        {/* Admin: Source & Contact */}
        {isAdmin && sample.sourceName && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-tea-surface border border-tea-border rounded-xl p-5 mt-8 space-y-3"
          >
            <div>
              <p className="label-caps text-tea-text-dim mb-1">Source</p>
              <h3 className="h3">{sample.sourceName}</h3>
            </div>

            <div className="flex flex-wrap gap-2">
              {sample.sourceContact?.whatsapp && (
                <button
                  onClick={handleWhatsAppAsk}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-green/10 text-tea-green text-xs font-semibold hover:bg-tea-green/20 transition-colors"
                >
                  <MessageCircle size={14} /> WhatsApp
                </button>
              )}
              {sample.sourceContact?.phone && (
                <a
                  href={`tel:${sample.sourceContact.phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-tea-border text-tea-text-sec text-xs font-semibold hover:text-tea-text hover:bg-tea-accent-sub transition-colors"
                >
                  <Phone size={14} /> Call
                </a>
              )}
              {sample.sourceContact?.wechat && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-elevated text-tea-text-sec text-ui-12">
                  WeChat: {sample.sourceContact.wechat}
                </span>
              )}
              {sample.sourceContact?.line && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-elevated text-tea-text-sec text-ui-12">
                  LINE: {sample.sourceContact.line}
                </span>
              )}
            </div>
          </motion.div>
        )}

        {/* Admin: Status Selector */}
        {isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8"
          >
            <p className="label-caps text-tea-text-dim mb-2">Status</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status selector">
              {STATUS_FLOW.map((s) => {
                const cfg = SAMPLE_STATUS_CONFIG[s];
                const active = sample.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`inline-flex px-2 py-0.5 rounded-full text-ui-10 uppercase tracking-[0.15em] transition-colors ${
                      active
                        ? `${cfg.color} ring-1 ring-inset ring-tea-gold/40`
                        : 'bg-tea-elevated text-tea-text-dim hover:bg-tea-accent-sub'
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Admin: Notes */}
        {isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mt-8"
          >
            <p className="label-caps text-tea-text-dim mb-2">Notes</p>
            {editing ? (
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="w-full bg-tea-surface rounded-md p-3 text-ui-14 text-tea-text outline-none resize-none border border-tea-border focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 transition-colors"
                placeholder="Private notes about this sample..."
              />
            ) : (
              <p className="body-light">
                {sample.notes || <span className="italic text-tea-text-dim">No notes yet. Your first session starts here.</span>}
              </p>
            )}
          </motion.div>
        )}

        {/* Previous Tastings */}
        {hasTastings && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8"
          >
            <p className="label-caps text-tea-text-dim mb-3">
              Tastings ({sample.tastings.length})
            </p>
            <ul className="divide-y divide-tea-border bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
              {sample.tastings.map((t) => {
                const vCfg = VERDICT_CONFIG[t.verdict];
                const VIcon = VERDICT_ICONS[t.verdict];
                return (
                  <li key={t.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {t.tasterName && (
                          <span className="text-ui-12 font-semibold text-tea-text">{t.tasterName}</span>
                        )}
                        <span className={`flex items-center gap-1 text-ui-12 font-semibold ${vCfg.color}`}>
                          <VIcon size={12} /> {vCfg.label}
                        </span>
                      </div>
                      {t.rating && (
                        <div className="flex items-center gap-1 text-ui-12 text-tea-readgold">
                          <Star size={12} fill="currentColor" /> {t.rating}/10
                        </div>
                      )}
                    </div>
                    {t.personalNote && (
                      <p className="text-ui-12 text-tea-text-sec mt-1">{t.personalNote}</p>
                    )}
                    <p className="text-ui-10 text-tea-text-dim mt-1">
                      {new Date(t.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}

        {/* Tasting Capture */}
        {isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="mt-8"
          >
            <button
              onClick={() => setShowTasting(true)}
              className="w-full inline-flex items-center justify-between px-4 py-3 bg-tea-surface border border-tea-border rounded-xl text-ui-14 font-semibold text-tea-text hover:bg-tea-accent-sub transition-colors"
            >
              <span className="flex items-center gap-2">
                <Leaf size={14} className="text-tea-gold" />
                Add tasting notes
              </span>
            </button>
          </motion.div>
        )}

        <AnimatePresence>
          {showTasting && (
            <TastingSession
              item={{
                id: sample.id,
                name: sample.name,
                type: sample.type,
                sourceType: 'sample',
                teaKey: (sample as any).tea_key || (sample as any).teaKey,
                sourceSampleId: sample.id,
              }}
              onClose={() => setShowTasting(false)}
              onAfterSave={handleTastingSave}
              showVerdict
              writeDraftReview={isAdmin && !!((sample as any).tea_key || (sample as any).teaKey)}
              onCreatePO={isAdmin ? () => setShowPOModal(true) : undefined}
            />
          )}
        </AnimatePresence>

        {/* Cross-account tasting panel */}
        {(sample as any).teaKey || (sample as any).tea_key ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8"
          >
            <TeaReviewsComparison
              teaKey={(sample as any).teaKey || (sample as any).tea_key}
            />
          </motion.div>
        ) : null}

        {/* Admin: Promote to Inventory */}
        {isAdmin && sample.status === 'favorite' && !sample.productId && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8"
          >
            <button
              onClick={() => navigate(`/admin/compass?tab=sourcing&fromSample=${sample.id}`)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-3 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors"
            >
              <ExternalLink size={14} />
              Promote to Curate
            </button>
          </motion.div>
        )}
      </div>

      {/* Customer: order modal */}
      <SampleOrderModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        sampleName={sample.name}
        sampleId={sample.id}
        teaType={sample.type}
      />

      {/* Admin: purchase order modal — prefilled with sample vendor + item */}
      {isAdmin && (
        <QuickInvoiceModal
          isOpen={showPOModal}
          onClose={() => setShowPOModal(false)}
          onSuccess={() => setShowPOModal(false)}
          products={[]}
          showToast={() => {}}
          prefill={{
            vendorName: (sample as any).sourceName || (sample.sourceContact ? 'Supplier' : undefined),
            items: [{ name: sample.name, quantity: 50, unit: 'g' }],
          }}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
};

export default SamplePage;
