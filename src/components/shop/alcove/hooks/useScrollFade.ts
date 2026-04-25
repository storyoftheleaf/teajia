import React, { useState, useEffect } from 'react';

export function useScrollFade(ref: React.RefObject<HTMLElement>): boolean {
  const [showFade, setShowFade] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const canScroll = el.scrollHeight > el.clientHeight;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
      setShowFade(canScroll && !atBottom);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [ref]);

  return showFade;
}
