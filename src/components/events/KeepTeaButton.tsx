import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { keepAfterSitTea } from '../../lib/afterSitAccess';
import { currentSignInToken } from '../../lib/api';
import { authPagePath } from '../../lib/authNavigation';
import { firstTableOpen } from '../../lib/firstTable';
import { Button } from '../shared/Button';

type Props = { credential: string; teaId: string; kept: boolean };

// A tap made while signed out is carried through sign-in, once, on this tab only.
const PENDING_KEEP = 'teajia-pending-keep';
const PENDING_LIFE_MS = 30 * 60 * 1000;

function rememberPendingKeep(teaId: string) {
  try { sessionStorage.setItem(PENDING_KEEP, JSON.stringify({ teaId, at: Date.now() })); } catch { /* private mode */ }
}

function takePendingKeep(teaId: string): boolean {
  try {
    const raw = sessionStorage.getItem(PENDING_KEEP);
    if (!raw) return false;
    const pending = JSON.parse(raw) as { teaId?: string; at?: number };
    if (pending.teaId !== teaId) return false;
    sessionStorage.removeItem(PENDING_KEEP);
    return typeof pending.at === 'number' && Date.now() - pending.at < PENDING_LIFE_MS;
  } catch {
    return false;
  }
}

export function KeepTeaButton({ credential, teaId, kept }: Props) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [isKept, setIsKept] = useState(kept);
  const [saving, setSaving] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const carried = useRef(false);
  useEffect(() => {
    if (carried.current || isKept || !isAuthenticated || !firstTableOpen()) return;
    if (!takePendingKeep(teaId)) return;
    carried.current = true;
    void keep();
    // keep() reads only props and state captured on this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isKept, teaId]);

  if (!firstTableOpen()) return null;
  if (isKept) return <Link to="/account/cellar" className="text-tea-gold">In your Tea Chest</Link>;

  async function keep() {
    if (!isAuthenticated) {
      rememberPendingKeep(teaId);
      navigate(authPagePath('signin', '/after-sit'));
      return;
    }
    const token = currentSignInToken();
    if (!token) {
      rememberPendingKeep(teaId);
      navigate(authPagePath('signin', '/after-sit'));
      return;
    }
    setSaving(true);
    setUnavailable(false);
    try {
      const item = await keepAfterSitTea(credential, teaId, token);
      if (item) setIsKept(true);
      else setUnavailable(true);
    } catch {
      setUnavailable(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Button variant="quiet" type="button" className="tap-target" loading={saving} onClick={keep}>
        Keep this tea
      </Button>
      {unavailable && <span role="status" className="text-tea-text-dim">This tea could not be kept.</span>}
    </span>
  );
}
