import React from 'react';

interface AlcoveGalleryProps {
  allImages: string[];
  onExpandImage: (url: string) => void;
}

export const AlcoveGallery: React.FC<AlcoveGalleryProps> = ({
  allImages,
  onExpandImage,
}) => {
  if (allImages.length === 0) return null;

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
