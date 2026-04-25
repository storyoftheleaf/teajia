import React from 'react';
import type { Story } from '../../../types';
import { useNavigate } from 'react-router-dom';
import type { InventoryItem } from '../../../types';

interface AlcoveJournalSectionProps {
  relatedArticles: Story[];
  item: InventoryItem;
}

/**
 * TWO journal section instances — kept verbatim from the original.
 * Instance 1 (cards): article thumbnail cards with open-article dispatch.
 * Instance 2 (editorial links): inline text links + "Learn about X tea →" footer.
 * Both are rendered here exactly as they appeared in AlcoveCard.tsx.
 */
export const AlcoveJournalSection: React.FC<AlcoveJournalSectionProps> = ({
  relatedArticles,
  item,
}) => {
  const navigate = useNavigate();

  return (
    <>
      {/* === FROM THE JOURNAL (instance 1 — card style) === */}
      {relatedArticles.length > 0 && (
        <div style={{
          marginTop: "28px",
          padding: "0 20px 8px",
        }}>
          <h3 style={{
            fontFamily: "var(--font-display)",
            fontSize: "10px", fontWeight: 400,
            textTransform: "uppercase", letterSpacing: "0.12em",
            color: "var(--tea-gold)",
            margin: "0 0 10px 0",
          }}>
            From the journal
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {relatedArticles.map(article => (
              <button
                key={article.id}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('openArticle', { detail: { story: article } }));
                }}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  background: "var(--tea-accent-sub)",
                  border: "1px solid var(--tea-border)",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.2s ease, border-color 0.2s ease",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "var(--tea-surface)";
                  e.currentTarget.style.borderColor = "var(--tea-gold, #a8874d)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "var(--tea-accent-sub)";
                  e.currentTarget.style.borderColor = "var(--tea-border)";
                }}
              >
                {article.thumbnailUrl ? (
                  <img
                    src={article.thumbnailUrl}
                    alt=""
                    style={{
                      width: "36px", height: "36px",
                      borderRadius: "4px", objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div style={{
                    width: "36px", height: "36px",
                    borderRadius: "4px",
                    background: "var(--tea-surface)",
                    border: "1px solid var(--tea-border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="var(--tea-text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "13px", fontWeight: 400,
                    color: "var(--tea-text)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {article.title}
                  </div>
                  {article.subtitle && (
                    <div style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "11px", fontWeight: 300,
                      color: "var(--tea-text-dim)",
                      marginTop: "2px",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {article.subtitle}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* === EDITORIAL LINKS — Journal articles + Learn section (instance 2) === */}
      {(relatedArticles.length > 0 || item.category === 'tea') && (
        <div style={{
          marginTop: "28px",
          padding: "0 20px 20px",
        }}>
          <div className="border-t border-tea-border pt-3">
            {relatedArticles.length > 0 && (
              <>
                <p style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "10px", fontWeight: 400,
                  textTransform: "uppercase", letterSpacing: "0.12em",
                  color: "var(--tea-text-dim)",
                  margin: "0 0 6px 0",
                }}>
                  From the journal
                </p>
                {relatedArticles.map(article => (
                  <button
                    key={article.id}
                    onClick={() => navigate('/magazine')}
                    style={{
                      display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                      gap: "8px",
                      background: "none", border: "none",
                      padding: "5px 0", cursor: "pointer",
                      width: "100%", textAlign: "left",
                    }}
                    onMouseEnter={e => {
                      const span = e.currentTarget.querySelector('.article-title') as HTMLElement;
                      if (span) span.style.color = "var(--tea-gold)";
                    }}
                    onMouseLeave={e => {
                      const span = e.currentTarget.querySelector('.article-title') as HTMLElement;
                      if (span) span.style.color = "var(--tea-text)";
                    }}
                  >
                    <span className="article-title" style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "14px", fontWeight: 300, lineHeight: 1.45,
                      color: "var(--tea-text)",
                      transition: "color 0.2s",
                    }}>
                      {article.title}
                    </span>
                    <span style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "12px",
                      color: "var(--tea-text-dim)",
                      flexShrink: 0,
                      paddingTop: "2px",
                    }}>
                      →
                    </span>
                  </button>
                ))}
              </>
            )}

            {item.category === 'tea' && (
              <button
                onClick={() => navigate('/learn')}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  background: "none", border: "none",
                  padding: relatedArticles.length > 0 ? "7px 0 0" : "3px 0 0",
                  cursor: "pointer",
                  width: "100%", textAlign: "left",
                }}
                onMouseEnter={e => {
                  const span = e.currentTarget.querySelector('.learn-label') as HTMLElement;
                  if (span) span.style.color = "var(--tea-gold)";
                }}
                onMouseLeave={e => {
                  const span = e.currentTarget.querySelector('.learn-label') as HTMLElement;
                  if (span) span.style.color = "var(--tea-text-sec)";
                }}
              >
                <span className="learn-label" style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px", fontWeight: 400,
                  letterSpacing: "0.02em",
                  color: "var(--tea-text-sec)",
                  transition: "color 0.2s",
                }}>
                  Learn about {item.type ? item.type.toLowerCase() : ''} tea →
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
