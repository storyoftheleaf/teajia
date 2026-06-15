export const getThemeColor = (type: string) => {
  switch (type) {
    case 'Green': return '#859F85';
    case 'Yellow': return '#D4C586';
    case 'White': return '#D6D3CD';
    case 'Oolong': return '#C4A484';
    case 'Red': return '#A67B70';
    case 'Dark': return '#8B8C89';
    case 'Shou': return '#5C544E';
    case 'Sheng': return '#98A67B';
    case 'Herbal': return '#BFA09E';
    default: return '#737373';
  }
};

// Text-legible variant of the type colour. The dot palette above is tuned for a
// small filled swatch; the darkest types (Shou, Dark, default) are too dim to
// read as 13px text on the dark inventory surface, so lift those to a lighter
// tint that keeps the hue but clears the contrast floor.
export const getThemeTextColor = (type: string) => {
  switch (type) {
    case 'Shou': return '#9B8F84';
    case 'Dark': return '#A7A8A4';
    case 'Red': return '#BE9189';
    default: return getThemeColor(type);
  }
};
