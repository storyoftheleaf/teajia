import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { keepAfterSitTea } from '../../lib/afterSitAccess';
import { currentSignInToken } from '../../lib/api';
import { authPagePath } from '../../lib/authNavigation';
import { firstTableOpen } from '../../lib/firstTable';
import { Button } from '../shared/Button';

type Props = { credential: string; teaId: string; kept: boolean };

export function KeepTeaButton({ credential, teaId, kept }: Props) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [isKept, setIsKept] = useState(kept);
  const [saving, setSaving] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  if (!firstTableOpen()) return null;
  if (isKept) return <Link to="/account/cellar" className="text-tea-gold">In your Tea Chest</Link>;

  async function keep() {
    if (!isAuthenticated) {
      navigate(authPagePath('signin', '/after-sit'));
      return;
    }
    const token = currentSignInToken();
    if (!token) {
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
