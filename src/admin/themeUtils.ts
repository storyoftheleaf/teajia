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
    case 'Matcha': return '#6F8C60';
    case 'Flower': return '#B596A6';
    default: return '#737373';
  }
};
