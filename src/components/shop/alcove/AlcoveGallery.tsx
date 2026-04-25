import React from 'react';

interface AlcoveGalleryProps {
  allImages: string[];
  chineseCharacters: string;
  origin: string;
  typeColor: string;
  onExpandImage: (url: string) => void;
}

export const AlcoveGallery: React.FC<AlcoveGalleryProps> = ({
  allImages,
  chineseCharacters,
  origin,
  typeColor,
  onExpandImage,
}) => {
  if (allImages.length === 0) {
    return (
      <div style={{
        margin: "12px 12px 0",
        borderRadius: "4px",
        overflow: "hidden",
        height: "140px",
        position: "relative",
        background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${typeColor}22 0%, transparent 70%), var(--tea-elevated)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
      }}>
        {chineseCharacters && (
          <div style={{
            fontFamily: "'Ma Shan Zheng', cursive",
            fontSize: "52px", fontWeight: 400,
            color: typeColor,
            opacity: 0.25,
            lineHeight: 1,
            letterSpacing: "0.1em",
            userSelect: "none",
          }}>
            {chineseCharacters}
          </div>
        )}
        {origin && !chineseCharacters && (
          <span style={{
            fontFamily: "var(--font-display)",
            fontSize: "11px", fontWeight: 300,
            color: "var(--tea-text-dim)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            userSelect: "none",
          }}>
            {origin}
          </span>
        )}
      </div>
    );
  }

  return (
    <div style={{
      animation: "panelReveal 0.5s ease-out",
      padding: "12px 12px 0",
      flexShrink: 0,
    }}>
      {allImages.length === 1 ? (
        <div
          onClick={() => onExpandImage(allImages[0])}
          style={{
            width: "100%", height: "180px",
            borderRadius: "4px", overflow: "hidden",
            cursor: "pointer",
            willChange: 'transform',
          }}
        >
          <img src={allImages[0]} alt="" loading="lazy" style={{
            width: "100%", height: "100%", objectFit: "cover",
            opacity: 0.9, transition: "opacity 0.3s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.9"; }}
          />
        </div>
      ) : (
        <div style={{
          display: "flex", gap: "4px",
          justifyContent: "center",
        }}>
          {allImages.map((img, i) => (
            <div
              key={i}
              onClick={() => onExpandImage(img)}
              style={{
                width: "100px", height: "100px",
                borderRadius: "4px", overflow: "hidden",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <img src={img} alt="" loading="lazy" style={{
                width: "100%", height: "100%", objectFit: "cover",
                opacity: 0.9, transition: "opacity 0.3s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.9"; }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
