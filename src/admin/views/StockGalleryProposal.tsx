import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL, authedBlobFetch, authedFetch } from '../../lib/api';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { usePrivateQueryScope } from '../hooks/usePrivateQueryScope';

type Proposal = { name: string; productName: string; photos: { sha256: string }[] };
type Preview = { key: string; name: string; urls: string[] };

function UploadPhotos({ stockId, accountId, userId }: { stockId: string; accountId: string; userId: string }) {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    if (busy || !files.length) return;
    setBusy(true);
    setError('');
    const form = new FormData();
    files.forEach(file => form.append('photo', file));
    try {
      const result = await authedFetch(API_URL + '/api/admin/stock-gallery/' + encodeURIComponent(stockId), {
        method: 'POST', body: form, expectedAuth: { accountId, userId }, reportIncident: false,
      });
      navigate('/admin/stock/gallery-proposals/' + encodeURIComponent(stockId) + '/' + encodeURIComponent(result.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not stage these photos. Try again.');
      setBusy(false);
    }
  }
  return <div className="mt-4 space-y-3">
    <label className="block">Choose one to four JPEGs, up to 6 MiB each.
      <input type="file" accept="image/jpeg" multiple disabled={busy} className="mt-2 block w-full" onChange={event => {
        const selected = Array.from(event.target.files || []);
        setError('');
        if (selected.length > 4 || selected.some(file => file.size > 6 * 1024 * 1024)) {
          setFiles([]); setError('Choose up to four JPEGs under 6 MiB each.'); event.target.value = ''; return;
        }
        setFiles(selected);
      }} />
    </label>
    {files.length > 0 && <ol className="space-y-2">{files.map((file, index) => <li key={index} className="flex flex-wrap items-center gap-2">
      <span className="min-w-0 break-all">{index === 0 ? 'Main' : 'Photo ' + (index + 1)} · {file.name}</span>
      {index > 0 && <button type="button" className="btn-quiet btn-sm" disabled={busy} aria-label={'Move ' + file.name + ' earlier'} onClick={() => {
        const next = files.slice();
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        setFiles(next);
      }}>Move up</button>}
    </li>)}</ol>}
    {error && <p role="alert">{error}</p>}
    <button type="button" className="btn-primary" disabled={busy || !files.length} onClick={save}>
      {busy ? 'Staging…' : 'Stage private gallery'}
    </button>
  </div>;
}

export default function StockGalleryProposal() {
  const { stockId, proposalId } = useParams();
  const scope = usePrivateQueryScope();
  const [accountId, userId] = scope.key;
  const key = JSON.stringify([stockId, proposalId, accountId, userId, scope.ready]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [failed, setFailed] = useState('');
  useEffect(() => {
    if (!scope.ready) return;
    const controller = new AbortController();
    const urls: string[] = [];
    const path = API_URL + '/api/admin/stock-gallery/' + encodeURIComponent(stockId || '') + (proposalId ? '/' + encodeURIComponent(proposalId) : '');
    const options = { expectedAuth: { accountId, userId }, signal: controller.signal, cache: 'no-store' as const, reportIncident: false };
    async function open() {
      const entry: Proposal = await authedFetch(path, options);
      const photos = await Promise.all(entry.photos.map((_, i) => authedBlobFetch(path + '/' + (i + 1), options)));
      if (controller.signal.aborted) return;
      photos.forEach(photo => urls.push(URL.createObjectURL(photo)));
      const name = entry.name === entry.productName ? entry.name : entry.name + ' (' + entry.productName + ')';
      setPreview({ key, name, urls });
    }
    open().catch(() => { if (!controller.signal.aborted) setFailed(key); });
    return () => { controller.abort(); urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [stockId, proposalId, accountId, userId, scope.ready, key]);

  if (preview?.key !== key) return <p className="p-4" role="status">{failed === key ? 'Gallery proposal unavailable.' : 'Loading gallery…'}</p>;
  return <section className="mx-auto w-full max-w-3xl p-4 text-tea-text">
    <p className={TYPOGRAPHY_CLASSES.label}>Private gallery proposal</p>
    <h1 className={TYPOGRAPHY_CLASSES.h1}>{preview.name}</h1>
    {!proposalId && stockId ? <UploadPhotos key={key} stockId={stockId} accountId={accountId} userId={userId} /> : <div className="mt-4 grid grid-cols-2 gap-3">
      {preview.urls.map((url, index) => <figure key={url} className="min-w-0">
        <img className="aspect-square w-full object-contain" src={url} alt={preview.name + ', photo ' + (index + 1)} />
        <figcaption className="text-tea-text-sec">{index === 0 ? 'Main photo' : 'Gallery photo ' + (index + 1)}</figcaption>
      </figure>)}
    </div>}
  </section>;
}
