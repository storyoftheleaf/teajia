import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { sendsApi } from '../../lib/sendsApi';

/**
 * Which sent link this page is, for the record of what happened to it
 * (worker/src/sendRecords.ts): a /c/ collection, or an invoice's pay page with
 * its ?t= token. Any other page that opens teas this way records nothing.
 */
export function sentLinkOf(pathname: string, params: URLSearchParams): { kind: 'collection'; slug: string } | { kind: 'invoice'; t: string } | null {
  const collection = /^\/c\/([^/]+)\/?$/.exec(pathname);
  if (collection) return { kind: 'collection', slug: decodeURIComponent(collection[1]) };
  const token = params.get('t');
  if (/^\/people\/[^/]+\/pay\/?$/.test(pathname) && token) return { kind: 'invoice', t: token };
  return null;
}

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
  const { pathname } = useLocation();
  // Each tea opened on a sent link is recorded once per visit to it; the worker counts a repeat within half an hour once.
  useEffect(() => {
    if (!openId) return;
    const link = sentLinkOf(pathname, params);
    if (link) sendsApi.teaOpened(link, openId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, pathname]);
  const open = (teaId: string) => {
    const next = new URLSearchParams(params);
    next.set('tea', teaId);
    openedHere.current = true;
    setParams(next);
  };
  // Arrow to a neighbouring tea: the same step, so Back still closes to the list.
  const move = (teaId: string) => {
    const next = new URLSearchParams(params);
    next.set('tea', teaId);
    setParams(next, { replace: true }); // history: refine
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
  return { openId, open, move, close };
}
