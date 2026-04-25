import React from 'react';
import type { InventoryItem } from '../../../types';
import { X, Loader2 } from 'lucide-react';
import { fmtShopPrice } from '../../../utils/formatNumber';

// ─── Sample Request Modal ─────────────────────────────────────────────────────

interface SampleModalProps {
  item: InventoryItem;
  open: boolean;
  onClose: () => void;
  sampleGrams: 5 | 10 | 15;
  setSampleGrams: (g: 5 | 10 | 15) => void;
  sampleNote: string;
  setSampleNote: (v: string) => void;
  sampleSubmitting: boolean;
  sampleDone: boolean;
  sampleError: string | null;
  onSubmit: () => void;
  isLoggedIn: boolean;
  pricePerGram: number;
  formatPrice?: (pricePerGram: number, grams: number) => string;
}

export const SampleModal: React.FC<SampleModalProps> = ({
  item,
  open,
  onClose,
  sampleGrams,
  setSampleGrams,
  sampleNote,
  setSampleNote,
  sampleSubmitting,
  sampleDone,
  sampleError,
  onSubmit,
  isLoggedIn,
  pricePerGram,
  formatPrice,
}) => {
  if (!open) return null;

  return (
    <div
      onClick={() => { if (!sampleSubmitting) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--tea-surface)",
          border: "1px solid var(--tea-border)",
          borderRadius: "8px",
          width: "100%", maxWidth: "360px",
          padding: "24px",
          position: "relative",
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: "12px", right: "12px",
            background: "none", border: "none", cursor: "pointer",
            color: "var(--tea-text-dim)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <X size={16} />
        </button>

        {sampleDone ? (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "18px", color: "var(--tea-text)", marginBottom: "8px" }}>
              Sample requested.
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "var(--tea-text-sec)", lineHeight: 1.6 }}>
              We'll be in touch to arrange delivery.
            </p>
            <button
              onClick={onClose}
              style={{
                marginTop: "16px",
                background: "var(--tea-gold)", color: "var(--tea-bg)",
                border: "none", borderRadius: "4px",
                padding: "8px 20px", cursor: "pointer",
                fontFamily: "var(--font-sans)", fontSize: "12px",
                fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
              }}
            >
              Done
            </button>
          </div>
        ) : !isLoggedIn ? (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "16px", color: "var(--tea-text)", marginBottom: "8px" }}>
              Create an account to request samples
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--tea-text-sec)", lineHeight: 1.6, marginBottom: "16px" }}>
              Sign in or create a free account to request a sample of {item.name}.
            </p>
            <button
              onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('openAccountPanel', { detail: { view: 'signup' } })); }}
              style={{
                background: "var(--tea-gold)", color: "var(--tea-bg)",
                border: "none", borderRadius: "4px",
                padding: "10px 20px", cursor: "pointer",
                fontFamily: "var(--font-sans)", fontSize: "12px",
                fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                width: "100%",
              }}
            >
              Sign In / Create Account
            </button>
          </div>
        ) : (
          <div>
            {/* Product info */}
            <div style={{ display: "flex", gap: "12px", marginBottom: "20px", alignItems: "center" }}>
              {item.image && (
                <img
                  src={item.image}
                  alt=""
                  style={{ width: "48px", height: "48px", borderRadius: "4px", objectFit: "cover", flexShrink: 0 }}
                />
              )}
              <div style={{ minWidth: 0 }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "15px", color: "var(--tea-text)", margin: 0 }}>
                  {item.name}
                </p>
                {item.origin && (
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--tea-text-sec)", margin: "2px 0 0" }}>
                    {item.origin}
                  </p>
                )}
              </div>
            </div>

            {/* Size selector */}
            <div style={{ marginBottom: "16px" }}>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--tea-text-sec)", marginBottom: "8px" }}>
                Sample size
              </p>
              <div style={{ display: "flex", gap: "6px" }}>
                {([5, 10, 15] as const).map(g => {
                  const cost = pricePerGram * g;
                  const costDisplay = formatPrice ? formatPrice(pricePerGram, g) : fmtShopPrice(cost);
                  return (
                    <button
                      key={g}
                      onClick={() => setSampleGrams(g)}
                      style={{
                        flex: 1, padding: "8px 4px",
                        borderRadius: "4px",
                        border: sampleGrams === g ? "1px solid var(--tea-gold)" : "1px solid var(--tea-border)",
                        background: sampleGrams === g ? "var(--tea-gold)/10" : "var(--tea-bg)",
                        cursor: "pointer", textAlign: "center",
                      }}
                    >
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 600, color: sampleGrams === g ? "var(--tea-gold)" : "var(--tea-text)" }}>
                        {g}g
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--tea-text-sec)", marginTop: "2px" }}>
                        {costDisplay}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Note */}
            <div style={{ marginBottom: "16px" }}>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--tea-text-sec)", marginBottom: "6px" }}>
                Note (optional)
              </p>
              <textarea
                value={sampleNote}
                onChange={e => setSampleNote(e.target.value)}
                placeholder="Anything you'd like us to know?"
                rows={2}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "var(--tea-bg)", border: "1px solid var(--tea-border)",
                  borderRadius: "4px", padding: "8px 10px",
                  fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--tea-text)",
                  outline: "none", resize: "none",
                }}
              />
            </div>

            {sampleError && (
              <p style={{ fontSize: "12px", color: "var(--tea-text-sec)", marginBottom: "12px" }}>{sampleError}</p>
            )}

            <button
              onClick={onSubmit}
              disabled={sampleSubmitting}
              style={{
                width: "100%", padding: "10px",
                background: "var(--tea-gold)", color: "var(--tea-bg)",
                border: "none", borderRadius: "4px", cursor: sampleSubmitting ? "not-allowed" : "pointer",
                fontFamily: "var(--font-sans)", fontSize: "12px",
                fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                opacity: sampleSubmitting ? 0.7 : 1,
              }}
            >
              {sampleSubmitting && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
              Request sample
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Custom Amount Modal ──────────────────────────────────────────────────────

interface CustomAmountModalProps {
  open: boolean;
  onClose: () => void;
  sliderMax: number;
  customInput: string;
  setCustomInput: (v: string) => void;
  setGrams: (g: number) => void;
}

export const CustomAmountModal: React.FC<CustomAmountModalProps> = ({
  open,
  onClose,
  sliderMax,
  customInput,
  setCustomInput,
  setGrams,
}) => {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--tea-surface)",
          border: "1px solid var(--tea-border)",
          borderRadius: "6px",
          width: "100%", maxWidth: "320px",
          padding: "24px",
        }}
      >
        <p style={{
          fontFamily: "var(--font-display)",
          fontSize: "15px", fontWeight: 400,
          color: "var(--tea-text)",
          margin: "0 0 16px 0",
        }}>
          Custom amount
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
          <input
            type="number"
            min={5}
            max={sliderMax}
            step={5}
            value={customInput}
            onChange={e => {
              setCustomInput(e.target.value);
              const v = parseInt(e.target.value);
              if (!isNaN(v) && v >= 5) setGrams(Math.min(v, sliderMax));
            }}
            placeholder="e.g. 200"
            autoFocus
            style={{
              flex: 1, height: "36px",
              background: 'var(--tea-bg)',
              border: '1px solid var(--tea-gold)',
              borderRadius: '4px', padding: '0 10px',
              fontFamily: 'var(--font-mono)', fontSize: '14px',
              color: 'var(--tea-text)', outline: 'none',
            }}
          />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '13px',
            color: 'var(--tea-text-sec)',
          }}>g</span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "9px",
              background: "none",
              border: "1px solid var(--tea-border)",
              borderRadius: "4px", cursor: "pointer",
              fontFamily: "var(--font-sans)", fontSize: "12px",
              color: "var(--tea-text-sec)",
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const v = parseInt(customInput);
              if (!isNaN(v) && v >= 5) {
                setGrams(Math.min(v, sliderMax));
                onClose();
              }
            }}
            style={{
              flex: 1, padding: "9px",
              background: "var(--tea-gold)", color: "var(--tea-bg)",
              border: "none", borderRadius: "4px", cursor: "pointer",
              fontFamily: "var(--font-sans)", fontSize: "12px",
              fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Image Overlay Modal ──────────────────────────────────────────────────────

interface ImageOverlayModalProps {
  open: boolean;
  expandedImageUrl: string | null;
  itemName: string;
  onClose: () => void;
}

export const ImageOverlayModal: React.FC<ImageOverlayModalProps> = ({
  open,
  expandedImageUrl,
  itemName,
  onClose,
}) => {
  if (!open || !expandedImageUrl) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "var(--tea-bg)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
        animation: "panelReveal 0.3s ease-out",
      }}
    >
      <img
        src={expandedImageUrl}
        alt={itemName}
        style={{
          maxWidth: "90vw", maxHeight: "90vh",
          objectFit: "contain",
          borderRadius: "4px",
        }}
      />
      <button
        style={{
          position: "absolute", top: "14px", right: "14px",
          width: "32px", height: "32px",
          background: "rgba(0,0,0,0.25)", backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: "1px solid var(--tea-border)", borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
          transition: "background 0.2s ease",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.4)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.25)"; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--tea-text-sec)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
};
