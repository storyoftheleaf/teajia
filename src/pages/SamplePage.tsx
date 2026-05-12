import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Leaf, MessageCircle, Phone, Star,
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
  const { isAdmin } = useAuth();

  const storeSample = useSampleStore((s) => s.getSample(sampleId || ''));
  const addTastingToStore = useSampleStore((s) => s.addTasting);
  const updateStatus = useSampleStore((s) => s.updateSampleStatus);
  const updateSample = useSampleStore((s) => s.updateSample);

  const { toasts, dismiss, showError } = useToast();

  const [sample, setSample] = useState<TeaSample | null>(storeSample || null);
  const [loading, setLoading] = useState(!storeSample);
  const [error, setError] = useState<string | null>(null);

  // Tasting session state
  const [showTasting, setShowTasting] = useState(false);

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
      status: prev.status === 'untasted' ? 'tasted' : prev.status,
    } : prev);
  }, [sample, isAdmin, addTastingToStore]);

  const handleStatusChange = useCallback((newStatus: SampleStatus) => {
    if (!sample) return;
    const prevStatus = sample.status;
    updateStatus(sample.id, newStatus);
    setSample((prev) => prev ? { ...prev, status: newStatus } : prev);
    api.samples.update(sample.id, { status: newStatus }).catch(() => {
      updateStatus(sample.id, prevStatus);
      setSample((prev) => prev ? { ...prev, status: prevStatus } : prev);
      showError('Status update failed — please try again');
    });
  }, [sample, updateStatus, showError]);

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
      <div className="flex flex-col items-center justify-center min-h-screen bg-tea-bg text-tea-text px-6">
        <Leaf size={28} strokeWidth={1.25} className="text-tea-text-dim mb-3" />
        <h1 className="h3 mb-2">Sample not found</h1>
        <p className="text-ui-12 text-tea-text-dim leading-relaxed mb-6">This QR code may have expired or the sample was removed.</p>
        <button onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors">
          Go home
        </button>
      </div>
    );
  }

  const statusCfg = SAMPLE_STATUS_CONFIG[sample.status];
  const hasTastings = sample.tastings && sample.tastings.length > 0;
  const latestTasting = hasTastings ? sample.tastings[sample.tastings.length - 1] : null;

  return (
    <div className="min-h-screen bg-tea-bg text-tea-text pb-nav-gap">
      {/* Header */}
      <div className="sticky top-0 z-sticky bg-tea-bg/90 backdrop-blur-md border-b border-tea-border">
        <div className="flex items-center px-4 py-3 max-w-3xl mx-auto">
          <button onClick={() => navigate(-1)} className="tap-target p-1.5 -ml-1.5 rounded-md text-tea-text-sec hover:text-tea-text transition-colors" aria-label="Go back">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0 ml-2">
            <p className="label-caps text-tea-text-dim">Tea Sample</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => editing ? handleSaveEdit() : setEditing(true)}
              className="tap-target p-1.5 rounded-md text-tea-text-sec hover:text-tea-text transition-colors"
              aria-label={editing ? 'Save changes' : 'Edit sample'}
            >
              {editing ? <Check size={18} /> : <Edit3 size={18} />}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Identity */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {editing ? (
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h2 bg-transparent border-b border-tea-border w-full outline-none text-tea-text pb-1"
              autoFocus
            />
          ) : (
            <h1 className="h2">{sample.name || 'Unnamed Sample'}</h1>
          )}
          {sample.chineseName && (
            <p className="subtitle mt-1" style={{ fontSize: '1.2rem' /* Noto Serif SC optical correction */ }}>{sample.chineseName}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {sample.type && (
              <span className="inline-flex px-2 py-0.5 rounded-full text-ui-10 uppercase tracking-[1.2px] bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40">
                {sample.type}
              </span>
            )}
            {sample.year && (
              <span className="inline-flex px-2 py-0.5 rounded-full text-ui-10 uppercase tracking-[1.2px] bg-tea-elevated text-tea-text-sec">
                {sample.year}
              </span>
            )}
            {sample.originRegion && (
              <span className="inline-flex px-2 py-0.5 rounded-full text-ui-10 uppercase tracking-[1.2px] bg-tea-elevated text-tea-text-sec">
                {sample.originRegion}
              </span>
            )}
            {sample.form && (
              <span className="inline-flex px-2 py-0.5 rounded-full text-ui-10 uppercase tracking-[1.2px] bg-tea-elevated text-tea-text-sec">
                {sample.form}
              </span>
            )}
            <span className={`inline-flex px-2 py-0.5 rounded-full text-ui-10 uppercase tracking-[1.2px] ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>

          {sample.grams > 0 && (
            <p className="text-ui-11 text-tea-text-dim mt-2">{sample.grams}g sample</p>
          )}
        </motion.div>

        {/* Photos */}
        {sample.photos && sample.photos.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex gap-2 overflow-x-auto scrollbar-hide"
          >
            {sample.photos.map((url, i) => (
              <img key={i} src={url} alt="" className="h-32 w-32 rounded-xl object-cover flex-shrink-0" loading="lazy" />
            ))}
          </motion.div>
        )}

        {/* Flavor Profile (if tasted) */}
        {latestTasting && latestTasting.tasting && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <TastingProfileStrip tasting={latestTasting.tasting} variant="full" />
          </motion.div>
        )}

        {/* Admin: Source & Contact */}
        {isAdmin && sample.sourceName && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-tea-surface border border-tea-border rounded-xl p-4 space-y-3"
          >
            <div>
              <p className="label-caps text-tea-text-dim mb-1">Source</p>
              <p className="h3">{sample.sourceName}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {sample.sourceContact?.whatsapp && (
                <button
                  onClick={handleWhatsAppAsk}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-tea-green/10 text-tea-green text-xs font-semibold hover:bg-tea-green/20 transition-colors"
                >
                  <MessageCircle size={14} /> WhatsApp
                </button>
              )}
              {sample.sourceContact?.phone && (
                <a
                  href={`tel:${sample.sourceContact.phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-tea-border text-tea-text-sec text-xs font-semibold hover:text-tea-text hover:bg-tea-accent-sub transition-colors"
                >
                  <Phone size={14} /> Call
                </a>
              )}
              {sample.sourceContact?.wechat && (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-tea-elevated text-tea-text-sec text-ui-12">
                  WeChat: {sample.sourceContact.wechat}
                </span>
              )}
              {sample.sourceContact?.line && (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-tea-elevated text-tea-text-sec text-ui-12">
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
            transition={{ delay: 0.25 }}
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
                    className={`inline-flex px-2 py-0.5 rounded-full text-ui-10 uppercase tracking-[1.2px] transition-colors ${
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
            transition={{ delay: 0.3 }}
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
            transition={{ delay: 0.35 }}
          >
            <p className="label-caps text-tea-text-dim mb-3">
              Tastings ({sample.tastings.length})
            </p>
            <div className="space-y-2">
              {sample.tastings.map((t) => {
                const vCfg = VERDICT_CONFIG[t.verdict];
                const VIcon = VERDICT_ICONS[t.verdict];
                return (
                  <div key={t.id} className="bg-tea-surface border border-tea-border rounded-xl p-3">
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
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Tasting Capture */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <button
            onClick={() => setShowTasting(true)}
            className="w-full inline-flex items-center justify-between px-4 py-3 bg-tea-surface border border-tea-border rounded-xl text-ui-14 font-semibold text-tea-text hover:bg-tea-accent-sub transition-colors"
          >
            <span className="flex items-center gap-2">
              <Leaf size={16} className="text-tea-gold" />
              Add tasting notes
            </span>
          </button>
        </motion.div>

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

        {/* Order CTA */}
        {!isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <button
              onClick={handleOrderInquiry}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-3 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors"
            >
              <ShoppingCart size={14} />
              I'd like to order this
            </button>
          </motion.div>
        )}

        {/* Cross-account tasting panel */}
        {(sample as any).teaKey || (sample as any).tea_key ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
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
            transition={{ delay: 0.45 }}
          >
            <button
              onClick={() => navigate(`/admin/compass?tab=sourcing&fromSample=${sample.id}`)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-3 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors"
            >
              <ExternalLink size={14} />
              Promote to Tea Compass
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
