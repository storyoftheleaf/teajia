import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import TeaReferencePreview from './TeaReferencePreview';
import type { PublicReferencePreview } from '../../wisdom/receiving/previewImporter';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import '../../styles/tailwind.css';
import '../../styles/card-utilities.css';

const Loading: React.FC = () => (
  <main className="light min-h-[100dvh] bg-tea-bg px-4 py-12 text-tea-text sm:px-8">
    <div className="mx-auto w-full max-w-[1120px] animate-pulse">
      <div className="h-3 w-40 bg-tea-accent-sub" />
      <div className="mt-6 h-12 w-full max-w-[520px] bg-tea-surface" />
      <div className="mt-4 h-5 w-full max-w-[660px] bg-tea-surface" />
      <div className="mt-16 grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="h-40 bg-tea-surface" />
        <div className="space-y-4">
          <div className="h-7 w-48 bg-tea-surface" />
          <div className="h-36 bg-tea-surface" />
          <div className="h-36 bg-tea-surface" />
        </div>
      </div>
    </div>
  </main>
);

const Failure: React.FC<{ message: string }> = ({ message }) => (
  <main className="light flex min-h-[100dvh] items-center bg-tea-bg px-4 py-12 text-tea-text">
    <div className="mx-auto w-full max-w-[620px] border-t border-tea-border pt-6">
      <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-gold`}>Preview unavailable</p>
      <h1 className={`${TYPOGRAPHY_CLASSES.h1} mt-3`}>The local reference data could not be opened.</h1>
      <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-4 text-tea-text-sec`}>{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className={`${TYPOGRAPHY_CLASSES.link} mt-6 min-h-[44px] text-tea-gold transition-colors hover:text-tea-gold-lt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50`}
      >
        Try again
      </button>
    </div>
  </main>
);

const PreviewLoader: React.FC = () => {
  const [data, setData] = useState<PublicReferencePreview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/__tea-reference-preview.json', { signal: controller.signal, cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error(`Preview data returned HTTP ${response.status}.`);
        return response.json() as Promise<PublicReferencePreview>;
      })
      .then(setData)
      .catch(reason => {
        if (reason.name !== 'AbortError') setError(reason.message || 'Unknown preview error.');
      });
    return () => controller.abort();
  }, []);

  if (error) return <Failure message={error} />;
  if (!data) return <Loading />;
  return <TeaReferencePreview data={data} />;
};

const root = document.getElementById('tea-reference-preview-root');
if (!root) throw new Error('Tea Reference preview root is missing');
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <PreviewLoader />
  </React.StrictMode>,
);
