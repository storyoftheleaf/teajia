// Where the add-to-cart fly animation starts: the most recent click or tap,
// else the focused control, else the middle of the screen.
export function flyOrigin(): { x: number; y: number } {
  // The click event target works reliably on a mobile tap.
  const lastClick = (window as any).__teajia_last_click as { x: number; y: number } | undefined;
  if (lastClick) return { x: lastClick.x, y: lastClick.y };
  const active = document.activeElement as HTMLElement;
  if (active && active !== document.body) {
    const rect = active.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  return { x: window.innerWidth / 2 - 24, y: window.innerHeight / 2 };
}
