import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { buildWhatsAppUrl } from '../../lib/whatsapp';

export interface BrewingQRCardProps {
  teaName: string;
  teaType: string; // slug used in URL, e.g. 'gongfu-oolong'
  brewParams?: {
    tempC?: number;
    steepSeconds?: number;
    leafGrams?: number;
    waterMl?: number;
    vessel?: string;
    infusions?: number;
  };
  compact?: boolean; // true = label-printer size, false = full display card
}

/** Maps product type strings to brew guide URL slugs */
export const TEA_TYPE_TO_SLUG: Record<string, string> = {
  'Green': 'green-tea',
  'White': 'white-tea',
  'Oolong': 'oolong',
  'Black': 'black-tea',
  'Puerh': 'puerh',
  'Yellow': 'yellow-tea',
};

/** Returns the brew guide slug for a product type, or null if no guide exists */
export function getBrewSlug(productType: string): string | null {
  return TEA_TYPE_TO_SLUG[productType] ?? null;
}

function formatSteepTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export const BrewingQRCard: React.FC<BrewingQRCardProps> = ({
  teaName,
  teaType,
  brewParams = {},
  compact = false,
}) => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://teajia.com';
  const guideUrl = `${baseUrl}/learn/brew/${teaType}`;

  const { tempC, steepSeconds, leafGrams, waterMl, vessel, infusions } = brewParams;

  // Build WhatsApp share message
  const paramParts: string[] = [];
  if (tempC) paramParts.push(`${tempC}°C`);
  if (steepSeconds) paramParts.push(formatSteepTime(steepSeconds));
  if (leafGrams && waterMl) paramParts.push(`${leafGrams}g per ${waterMl}ml`);
  else if (leafGrams) paramParts.push(`${leafGrams}g`);
  if (vessel) paramParts.push(vessel);
  if (infusions) paramParts.push(`${infusions} infusions`);

  const waMessage = paramParts.length > 0
    ? `Brewing guide for ${teaName}: ${paramParts.join(', ')}. Full guide: ${guideUrl}`
    : `Brewing guide for ${teaName}: ${guideUrl}`;

  const waUrl = buildWhatsAppUrl('', waMessage);

  if (compact) {
    // === LABEL / STICKER LAYOUT (200×96px) ===
    return (
      <div>
        {/* Print-safe label card */}
        <div
          className="brewing-qr-label"
          style={{
            width: '200px',
            height: '96px',
            display: 'flex',
            alignItems: 'stretch',
            background: '#ffffff',
            border: '1px solid #cccccc',
            borderRadius: '3px',
            overflow: 'hidden',
            boxSizing: 'border-box',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Left: QR code */}
          <div style={{
            width: '72px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRight: '1px solid #e0e0e0',
            padding: '6px',
          }}>
            <QRCodeSVG
              value={guideUrl}
              size={58}
              bgColor="#ffffff"
              fgColor="#000000"
              level="M"
            />
          </div>

          {/* Right: Tea info */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '6px 8px',
            overflow: 'hidden',
          }}>
            {/* Tea name */}
            <div style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#111111',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {teaName}
            </div>

            {/* Brew params */}
            <div style={{
              fontSize: '9px',
              color: '#444444',
              lineHeight: 1.4,
              display: 'flex',
              flexDirection: 'column',
              gap: '1px',
            }}>
              {tempC && (
                <span>{tempC}°C</span>
              )}
              {steepSeconds && (
                <span>{formatSteepTime(steepSeconds)}</span>
              )}
              {leafGrams && waterMl && (
                <span>{leafGrams}g / {waterMl}ml</span>
              )}
              {infusions && (
                <span>{infusions} infusions</span>
              )}
              {vessel && (
                <span>{vessel}</span>
              )}
            </div>

            {/* Teajia wordmark */}
            <div style={{
              fontSize: '8px',
              fontWeight: 600,
              color: '#888888',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              textAlign: 'right',
            }}>
              Teajia
            </div>
          </div>
        </div>

        {/* WhatsApp share button */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '8px',
            padding: '5px 10px',
            background: 'none',
            border: '1px solid var(--tea-border)',
            borderRadius: '4px',
            cursor: 'pointer',
            textDecoration: 'none',
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            color: 'var(--tea-text-sec)',
            transition: 'color 0.2s ease, border-color 0.2s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--tea-text)';
            e.currentTarget.style.borderColor = 'var(--tea-gold)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--tea-text-sec)';
            e.currentTarget.style.borderColor = 'var(--tea-border)';
          }}
        >
          <WhatsAppIcon />
          Share via WhatsApp
        </a>

        {/* Print styles — injected once per render via <style> */}
        <style>{`
          @media print {
            .brewing-qr-label {
              box-shadow: none !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        `}</style>
      </div>
    );
  }

  // === FULL DISPLAY CARD ===
  return (
    <div className="bg-tea-surface border border-tea-border rounded-md overflow-hidden">
      <div style={{ padding: '16px' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '14px',
        }}>
          <div>
            <h4 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '13px',
              fontWeight: 400,
              color: 'var(--tea-gold)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              margin: '0 0 4px',
            }}>
              Brew Guide
            </h4>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              fontWeight: 300,
              color: 'var(--tea-text)',
              margin: 0,
              lineHeight: 1.3,
            }}>
              {teaName}
            </p>
          </div>

          {/* QR code */}
          <div style={{
            background: '#ffffff',
            padding: '6px',
            borderRadius: '4px',
            flexShrink: 0,
            border: '1px solid var(--tea-border)',
          }}>
            <QRCodeSVG
              value={guideUrl}
              size={72}
              bgColor="#ffffff"
              fgColor="#000000"
              level="M"
            />
          </div>
        </div>

        {/* Brew params grid */}
        {(tempC || steepSeconds || leafGrams || waterMl || vessel || infusions) && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1px',
            background: 'var(--tea-border)',
            border: '1px solid var(--tea-border)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '14px',
          }}>
            {tempC && (
              <ParamCell label="Temperature" value={`${tempC}°C`} />
            )}
            {steepSeconds && (
              <ParamCell label="Steep time" value={formatSteepTime(steepSeconds)} />
            )}
            {leafGrams && (
              <ParamCell label="Leaf" value={`${leafGrams}g`} />
            )}
            {waterMl && (
              <ParamCell label="Water" value={`${waterMl}ml`} />
            )}
            {infusions && (
              <ParamCell label="Infusions" value={`${infusions}×`} />
            )}
            {vessel && (
              <ParamCell label="Vessel" value={vessel} />
            )}
          </div>
        )}

        {/* URL hint */}
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: 'var(--tea-text-dim)',
          margin: '0 0 12px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {guideUrl}
        </p>

        {/* WhatsApp share button */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: 'var(--tea-accent-sub)',
            border: '1px solid var(--tea-border)',
            borderRadius: '4px',
            cursor: 'pointer',
            textDecoration: 'none',
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--tea-text-sec)',
            letterSpacing: '0.04em',
            transition: 'color 0.2s ease, background 0.2s ease, border-color 0.2s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--tea-text)';
            e.currentTarget.style.background = 'var(--tea-surface)';
            e.currentTarget.style.borderColor = 'var(--tea-gold)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--tea-text-sec)';
            e.currentTarget.style.background = 'var(--tea-accent-sub)';
            e.currentTarget.style.borderColor = 'var(--tea-border)';
          }}
        >
          <WhatsAppIcon />
          Share brewing guide via WhatsApp
        </a>
      </div>
    </div>
  );
};

// ── Sub-components ──────────────────────────────────────────────────────────

function ParamCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: 'var(--tea-surface)',
      padding: '8px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
    }}>
      <span style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '9px',
        fontWeight: 400,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--tea-text-dim)',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--tea-text)',
        fontVariantNumeric: 'tabular-nums lining-nums',
      }}>
        {value}
      </span>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
