import React from 'react';
import type { Story } from '../../../types';
import { useNavigate } from 'react-router-dom';
import type { InventoryItem } from '../../../types';

interface AlcoveJournalSectionProps {
  relatedArticles: Story[];
  item: InventoryItem;
}

/**
 * Editorial links related to the product. A single section avoids competing
 * "From the journal" affordances with different click behavior.
 */
export const AlcoveJournalSection: React.FC<AlcoveJournalSectionProps> = ({
  relatedArticles,
  item,
}) => {
  const navigate = useNavigate();

  return (
    <>
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
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('openArticle', { detail: { story: article } }));
                    }}
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
                onClick={() => navigate('/craft')}
                className="alcove-learn-link"
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
