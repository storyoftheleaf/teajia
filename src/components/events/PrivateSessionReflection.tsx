import { Button } from '../shared/Button';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { useAppStore } from '../../lib/store';

export function PrivateSessionReflection({ token }: { token: string }) {
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  const location = useLocation();
  const queryClient = useQueryClient();
  const key = [accountId, userId, token].join(':');
  return <ReflectionEditor key={key} token={token} accountId={accountId} userId={userId}
    returnTo={location.pathname + location.search} onSaved={() => {
      queryClient.invalidateQueries({ queryKey: ['private-session-reflections', accountId, userId] });
    }} />;
}

function ReflectionEditor({ token, accountId, userId, returnTo, onSaved }: {
  token: string; accountId: string | null; userId: string | null; returnTo: string; onSaved: () => void;
}) {
  const [reflection, setReflection] = useState('');
  const restored = useRef(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const query = useQuery({
    queryKey: ['private-session-reflection', accountId, userId, token],
    queryFn: () => api.sessionReflections.get(token),
    enabled: Boolean(accountId && userId),
    retry: false,
  });
  useEffect(() => {
    if (!restored.current && query.data) {
      setReflection(query.data.reflection);
      restored.current = true;
    }
  }, [query.data]);

  const save = async () => {
    setSaving(true);
    setFeedback('');
    try {
      await api.sessionReflections.save(token, reflection);
      setFeedback('Private reflection saved');
      onSaved();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Could not save your reflection.');
    } finally { setSaving(false); }
  };
  const notCreated = query.error instanceof ApiError && query.error.status === 404;
  return (
    <section aria-label="Private reflection" className="mt-6 border-t border-tea-border pt-4">
      <h2 className="h2 text-tea-text mb-2">Private reflection</h2>
      {!userId || !accountId ? (
        <Link to={`/signin?returnTo=${encodeURIComponent(returnTo)}`} className="tap-target inline-flex text-ui-13 text-tea-text-sec">
          Sign in to keep a private reflection
        </Link>
      ) : query.isLoading ? <p className="text-ui-13 text-tea-text-sec">Loading reflection…</p> : query.isError && !notCreated ? (
        <Button variant="plain" type="button" onClick={() => void query.refetch()} className="tap-target text-ui-13 text-tea-text-sec">Retry reflection</Button>
      ) : (
        <>
          <label className="block text-ui-13 text-tea-text-sec">
            Only you can read this
            <textarea value={reflection} onChange={event => { restored.current = true; setReflection(event.target.value); setFeedback(''); }}
              maxLength={12000} rows={4} className="mt-2 block w-full rounded-md border border-tea-border bg-tea-surface p-3 text-ui-14 text-tea-text" />
          </label>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <Link to="/account/journey" className="tap-target text-ui-13 text-tea-text-sec">My session archive</Link>
            <Button variant="plain" type="button" onClick={save} disabled={saving} className="tap-target btn-primary">{saving ? 'Saving…' : 'Save reflection'}</Button>
          </div>
          {feedback && <p role="status" className="mt-2 text-ui-13 text-tea-text-sec">{feedback}</p>}
        </>
      )}
    </section>
  );
}
