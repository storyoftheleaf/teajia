import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CellarView } from '../components/AccountPanel/CellarView';
import { PersonalTeaLinks } from '../components/account/PersonalTeaLinks';
import { Icons } from '../components/Icons';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
import { hasToken } from '../lib/api';

export default function CellarPage() {
  const navigate = useNavigate();
  const authed = hasToken();

  useEffect(() => {
    if (!authed) {
      navigate(`/signin?returnTo=${encodeURIComponent('/account/cellar')}`, { replace: true });
    }
  }, [authed, navigate]);

  if (!authed) return null;

  return (
    <main className="min-h-screen bg-tea-bg pb-nav-gap-lg">
      <div className="mx-auto max-w-3xl px-4 pt-6 md:px-6">
        <button
          onClick={() => navigate(-1)}
          className="tap-target inline-flex items-center gap-1.5 text-ui-13 text-tea-text-sec transition-colors hover:text-tea-text"
        >
          <Icons.Back className="h-4 w-4" />
          <span>Back</span>
        </button>
        <h1 className={`${TYPOGRAPHY_CLASSES.h1} mt-6 text-tea-text`}>My Cellar</h1>
        <CellarView onBack={() => navigate(-1)} embedded />
        <PersonalTeaLinks current="cellar" />
      </div>
    </main>
  );
}
