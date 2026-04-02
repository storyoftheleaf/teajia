import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Leaf, MessageCircle, Phone, Star,
  ShoppingCart, Edit3, Check, Heart,
  ThumbsUp, Minus, ThumbsDown, ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { useSampleStore } from '../samples/sampleStore';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import type { TeaSample, SampleTasting, TastingVerdict, SampleStatus } from '../samples/types';
import { VERDICT_CONFIG, SAMPLE_STATUS_CONFIG } from '../samples/types';
import type { TastingData } from '../types';
import { TastingFlow } from '../components/tasting/TastingFlow';
import { TastingProfileStrip } from '../components/tasting/TastingProfileStrip';

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

  const [sample, setSample] = useState<TeaSample | null>(storeSample || null);
  const [loading, setLoading] = useState(!storeSample);
  const [error, setError] = useState<string | null>(null);

  // Tasting capture state
  const [showTasting, setShowTasting] = useState(false);
  const [tastingData, setTastingData] = useState<TastingData>({});
  const [rating, setRating] = useState<number>(0);
  const [verdict, setVerdict] = useState<TastingVerdict>('neutral');
  const [wouldBuy, setWouldBuy] = useState(false);
  const [personalNote, setPersonalNote] = useState('');
  const [tasterName, setTasterName] = useState('');
  const [saving, setSaving] = useState(false);

  // Admin edit mode
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');

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

  const handleSaveTasting = useCallback(async () => {
    if (!sample) return;
    setSaving(true);

    const tasting: SampleTasting = {
      id: crypto.randomUUID(),
      tasterId: isAdmin ? 'admin' : tasterName || 'guest',
      tasterName: isAdmin ? 'Adrian' : tasterName || undefined,
      tasting: tastingData,
      rating: rating || undefined,
      verdict,
      wouldBuy,
      personalNote: personalNote || undefined,
      createdAt: new Date().toISOString(),
    };

    addTastingToStore(sample.id, tasting);

    try {
      await api.samples.addTasting(sample.id, {
        tasting: tastingData,
        rating: rating || undefined,
        verdict,
        wouldBuy,
        personalNote: personalNote || undefined,
        tasterName: isAdmin ? 'Adrian' : tasterName || undefined,
      });
    } catch {
      // Offline — local save is sufficient
    }

    setTastingData({});
    setRating(0);
    setVerdict('neutral');
    setWouldBuy(false);
    setPersonalNote('');
    setShowTasting(false);
    setSaving(false);

    setSample((prev) => prev ? {
      ...prev,
      tastings: [...(prev.tastings || []), tasting],
      status: prev.status === 'untasted' ? 'tasted' : prev.status,
    } : prev);
  }, [sample, tastingData, rating, verdict, wouldBuy, personalNote, tasterName, isAdmin, addTastingToStore]);

  const handleStatusChange = useCallback((newStatus: SampleStatus) => {
    if (!sample) return;
    updateStatus(sample.id, newStatus);
    setSample((prev) => prev ? { ...prev, status: newStatus } : prev);
    api.samples.update(sample.id, { status: newStatus }).catch(() => {});
  }, [sample, updateStatus]);

  const handleSaveEdit = useCallback(() => {
    if (!sample) return;
    updateSample(sample.id, { name: editName, notes: editNotes });
    setSample((prev) => prev ? { ...prev, name: editName, notes: editNotes } : prev);
    api.samples.update(sample.id, { name: editName, notes: editNotes }).catch(() => {});
    setEditing(false);
  }, [sample, editName, editNotes, updateSample]);

  const handleWhatsAppAsk = useCallback(() => {
    if (!sample?.sourceContact?.whatsapp) return;
    const phone = sample.sourceContact.whatsapp.replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(
      `Hi, I'm interested in the ${sample.name}${sample.year ? ` (${sample.year})` : ''}. Can you share details and pricing?`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  }, [sample]);

  const handleOrderInquiry = useCallback(() => {
    if (!sample) return;
    navigate(`/shop?inquiry=${encodeURIComponent(sample.name)}`);
  }, [sample, navigate]);

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
        <Leaf className="w-12 h-12 text-tea-text-dim mb-4" />
        <h1 className="text-xl font-serif mb-2">Sample not found</h1>
        <p className="text-tea-text-sec text-sm mb-6">This QR code may have expired or the sample was removed.</p>
        <button onClick={() => navigate('/')} className="px-6 py-2 bg-tea-gold text-white text-xs uppercase tracking-[0.2em]">
          Go Home
        </button>
      </div>
    );
  }

  const statusCfg = SAMPLE_STATUS_CONFIG[sample.status];
  const hasTastings = sample.tastings && sample.tastings.length > 0;
  const latestTasting = hasTastings ? sample.tastings[sample.tastings.length - 1] : null;

  return (
    <div className="min-h-screen bg-tea-bg text-tea-text pb-[60px]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-tea-bg/95 backdrop-blur-sm border-b border-tea-border/30">
        <div className="flex items-center px-4 py-3 max-w-2xl mx-auto">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-tea-text-sec hover:text-tea-text transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1 min-w-0 ml-2">
            <p className="text-xs uppercase tracking-[0.15em] text-tea-text-dim">Tea Sample</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => editing ? handleSaveEdit() : setEditing(true)}
              className="p-2 text-tea-text-sec hover:text-tea-gold transition-colors"
            >
              {editing ? <Check size={18} /> : <Edit3 size={18} />}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
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
              className="text-2xl font-serif font-bold bg-transparent border-b border-tea-gold/50 w-full outline-none text-tea-text pb-1"
              autoFocus
            />
          ) : (
            <h1 className="text-2xl font-serif font-bold text-tea-text">{sample.name || 'Unnamed Sample'}</h1>
          )}
          {sample.chineseName && (
            <p className="text-lg font-serif italic text-tea-text-sec mt-1">{sample.chineseName}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            {sample.type && (
              <span className="px-3 py-1 text-xs uppercase tracking-[0.1em] rounded-full bg-tea-gold/10 text-tea-gold font-medium">
                {sample.type}
              </span>
            )}
            {sample.year && (
              <span className="px-3 py-1 text-xs rounded-full bg-tea-surface text-tea-text-sec">
                {sample.year}
              </span>
            )}
            {sample.originRegion && (
              <span className="px-3 py-1 text-xs rounded-full bg-tea-surface text-tea-text-sec">
                {sample.originRegion}
              </span>
            )}
            {sample.form && (
              <span className="px-3 py-1 text-xs rounded-full bg-tea-surface text-tea-text-sec">
                {sample.form}
              </span>
            )}
            <span className={`px-3 py-1 text-xs rounded-full font-medium ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>

          {sample.grams > 0 && (
            <p className="text-xs text-tea-text-dim mt-2">{sample.grams}g sample</p>
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
              <img key={i} src={url} alt="" className="h-32 w-32 rounded-lg object-cover flex-shrink-0" />
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
            className="bg-tea-surface rounded-lg p-4 space-y-3"
          >
            <div>
              <p className="text-xs uppercase tracking-[0.1em] text-tea-text-dim mb-1">Source</p>
              <p className="font-serif text-tea-text">{sample.sourceName}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {sample.sourceContact?.whatsapp && (
                <button
                  onClick={handleWhatsAppAsk}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                >
                  <MessageCircle size={14} /> WhatsApp
                </button>
              )}
              {sample.sourceContact?.phone && (
                <a
                  href={`tel:${sample.sourceContact.phone}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-tea-surface text-tea-text-sec text-xs font-medium hover:bg-tea-elevated transition-colors"
                >
                  <Phone size={14} /> Call
                </a>
              )}
              {sample.sourceContact?.wechat && (
                <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-tea-surface text-tea-text-sec text-xs">
                  WeChat: {sample.sourceContact.wechat}
                </span>
              )}
              {sample.sourceContact?.line && (
                <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-tea-surface text-tea-text-sec text-xs">
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
            <p className="text-xs uppercase tracking-[0.1em] text-tea-text-dim mb-2">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FLOW.map((s) => {
                const cfg = SAMPLE_STATUS_CONFIG[s];
                const active = sample.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`px-3 py-1.5 text-xs rounded-full font-medium transition-all ${
                      active
                        ? `${cfg.color} ring-1 ring-tea-gold/30`
                        : 'bg-tea-surface/50 text-tea-text-dim hover:bg-tea-surface'
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
            <p className="text-xs uppercase tracking-[0.1em] text-tea-text-dim mb-2">Notes</p>
            {editing ? (
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="w-full bg-tea-surface rounded-lg p-3 text-sm text-tea-text outline-none resize-none border border-tea-border/30 focus:border-tea-gold/50 transition-colors"
                placeholder="Private notes about this sample..."
              />
            ) : (
              <p className="text-sm text-tea-text-sec">
                {sample.notes || <span className="italic text-tea-text-dim">No notes yet</span>}
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
            <p className="text-xs uppercase tracking-[0.1em] text-tea-text-dim mb-3">
              Tastings ({sample.tastings.length})
            </p>
            <div className="space-y-2">
              {sample.tastings.map((t) => {
                const vCfg = VERDICT_CONFIG[t.verdict];
                const VIcon = VERDICT_ICONS[t.verdict];
                return (
                  <div key={t.id} className="bg-tea-surface rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {t.tasterName && (
                          <span className="text-xs font-medium text-tea-text">{t.tasterName}</span>
                        )}
                        <span className={`flex items-center gap-1 text-xs font-medium ${vCfg.color}`}>
                          <VIcon size={12} /> {vCfg.label}
                        </span>
                      </div>
                      {t.rating && (
                        <div className="flex items-center gap-1 text-xs text-tea-gold">
                          <Star size={12} fill="currentColor" /> {t.rating}/10
                        </div>
                      )}
                    </div>
                    {t.personalNote && (
                      <p className="text-xs text-tea-text-sec mt-1">{t.personalNote}</p>
                    )}
                    <p className="text-[10px] text-tea-text-dim mt-1">
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
            onClick={() => setShowTasting(!showTasting)}
            className="w-full flex items-center justify-between px-4 py-3 bg-tea-surface rounded-lg text-sm font-medium text-tea-text hover:bg-tea-elevated transition-colors"
          >
            <span className="flex items-center gap-2">
              <Leaf size={16} className="text-tea-gold" />
              {showTasting ? 'Hide tasting notes' : 'Add your tasting notes'}
            </span>
            <ChevronDown size={16} className={`text-tea-text-sec transition-transform ${showTasting ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showTasting && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="pt-4 space-y-4">
                  {/* Guest name (customer mode only) */}
                  {!isAdmin && (
                    <div>
                      <label className="text-xs uppercase tracking-[0.1em] text-tea-text-dim mb-1 block">Your name</label>
                      <input
                        value={tasterName}
                        onChange={(e) => setTasterName(e.target.value)}
                        className="w-full bg-tea-surface rounded-lg px-3 py-2 text-sm text-tea-text outline-none border border-tea-border/30 focus:border-tea-gold/50 transition-colors"
                        placeholder="Optional"
                      />
                    </div>
                  )}

                  {/* Tasting Flow */}
                  <TastingFlow
                    mode={isAdmin ? 'admin' : 'customer'}
                    value={tastingData}
                    onChange={setTastingData}
                    teaType={sample.type}
                  />

                  {/* Rating */}
                  <div>
                    <label className="text-xs uppercase tracking-[0.1em] text-tea-text-dim mb-2 block">Rating</label>
                    <div className="flex gap-1">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          onClick={() => setRating(n)}
                          className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${
                            n <= rating
                              ? 'bg-tea-gold text-white'
                              : 'bg-tea-surface text-tea-text-dim hover:bg-tea-elevated'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Verdict */}
                  <div>
                    <label className="text-xs uppercase tracking-[0.1em] text-tea-text-dim mb-2 block">Verdict</label>
                    <div className="flex gap-2">
                      {(['love', 'like', 'neutral', 'pass'] as TastingVerdict[]).map((v) => {
                        const cfg = VERDICT_CONFIG[v];
                        const VIcon = VERDICT_ICONS[v];
                        const active = verdict === v;
                        return (
                          <button
                            key={v}
                            onClick={() => setVerdict(v)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all ${
                              active
                                ? `${cfg.color} bg-tea-surface ring-1 ring-tea-gold/20`
                                : 'bg-tea-surface/50 text-tea-text-dim hover:bg-tea-surface'
                            }`}
                          >
                            <VIcon size={14} /> {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Would buy */}
                  <button
                    onClick={() => setWouldBuy(!wouldBuy)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${
                      wouldBuy
                        ? 'bg-tea-gold/10 text-tea-gold'
                        : 'bg-tea-surface text-tea-text-dim hover:bg-tea-elevated'
                    }`}
                  >
                    <ShoppingCart size={14} />
                    {wouldBuy ? 'Would buy this!' : 'Would you buy this?'}
                  </button>

                  {/* Personal Note */}
                  <textarea
                    value={personalNote}
                    onChange={(e) => setPersonalNote(e.target.value)}
                    rows={2}
                    className="w-full bg-tea-surface rounded-lg p-3 text-sm text-tea-text outline-none resize-none border border-tea-border/30 focus:border-tea-gold/50 transition-colors"
                    placeholder="Any personal notes..."
                  />

                  {/* Save */}
                  <button
                    onClick={handleSaveTasting}
                    disabled={saving}
                    className="w-full py-3 bg-tea-gold text-white text-xs uppercase tracking-[0.2em] font-bold rounded-lg hover:bg-tea-gold/90 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Tasting'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Order CTA */}
        {!isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <button
              onClick={handleOrderInquiry}
              className="w-full flex items-center justify-center gap-2 py-3 bg-tea-gold text-white text-xs uppercase tracking-[0.2em] font-bold rounded-lg hover:bg-tea-gold/90 transition-colors"
            >
              <ShoppingCart size={16} />
              I'd like to order this
            </button>
          </motion.div>
        )}

        {/* Admin: Promote to Inventory */}
        {isAdmin && sample.status === 'favorite' && !sample.productId && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <button
              onClick={() => navigate(`/admin/compass?tab=capture&fromSample=${sample.id}`)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-tea-gold text-white text-xs uppercase tracking-[0.2em] font-bold rounded-lg hover:bg-tea-gold/90 transition-colors"
            >
              <ExternalLink size={16} />
              Promote to Tea Compass
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default SamplePage;
