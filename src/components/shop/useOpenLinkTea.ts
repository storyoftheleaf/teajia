import { useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * The tea open on a private link (a /c/ collection, an invoice's pay page)
 * lives in the address as ?tea=, so the open tea is a link of its own that can
 * be sent, and Back closes it (Adrian, 2026-11-27: "Send me a link for both of
 * them").
 */
export function useOpenLinkTea() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const openedHere = useRef(false);
  const openId = params.get('tea');
  const open = (teaId: string, also?: Record<string, string>) => {
    const next = new URLSearchParams(params);
    next.set('tea', teaId);
    for (const [key, value] of Object.entries(also ?? {})) next.set(key, value);
    openedHere.current = true;
    setParams(next);
  };
  const close = () => {
    if (openedHere.current) {
      openedHere.current = false;
      navigate(-1);
      return;
    }
    const next = new URLSearchParams(params);
    next.delete('tea');
    setParams(next, { replace: true });
  };
  return { openId, open, close };
}
