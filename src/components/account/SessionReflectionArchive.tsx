import { Button } from '../shared/Button';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type PrivateSessionReflection } from '../../lib/api';
import { useAppStore } from '../../lib/store';

export function SessionReflectionArchive() {
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  return <Archive key={[accountId, userId].join(':')} accountId={accountId} userId={userId} />;
}

function Archive({ accountId, userId }: { accountId: string | null; userId: string | null }) {
  const [editing, setEditing] = useState<PrivateSessionReflection | null>(null);
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const query = useQuery({
    queryKey: ['private-session-reflections', accountId, userId],
    queryFn: () => api.sessionReflections.list(),
    enabled: Boolean(accountId && userId),
  });
  if (!accountId || !userId || (!query.isError && !query.data?.reflections.length)) return null;

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setFeedback('');
    try {
      await api.sessionReflections.update(editing.attendee_id, text);
      await query.refetch();
      setEditing(null);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Could not save reflection');
    } finally { setSaving(false); }
  };
  return (
    <section aria-label="Private session archive" className="my-6 border-t border-tea-border pt-4">
      <h2 className="h2 mb-3 text-tea-text">Private session archive</h2>
      {query.isError ? <Button variant="plain" type="button" onClick={() => void query.refetch()} className="tap-target text-ui-13 text-tea-text-sec">Retry private reflections</Button>
        : editing ? (
          <div>
            <h3 className="h3 text-tea-text">{editing.title}</h3>
            <label className="block mt-3 text-ui-13 text-tea-text-sec">
              Only you can read this
              <textarea value={text} onChange={event => setText(event.target.value)} rows={5} maxLength={12000}
                className="mt-2 w-full block rounded-md border border-tea-border bg-tea-surface p-3 text-ui-14 text-tea-text" />
            </label>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <Button variant="plain" type="button" disabled={saving} onClick={() => setEditing(null)} className="tap-target text-ui-13 text-tea-text-sec">Cancel</Button>
              <Button variant="plain" type="button" disabled={saving} onClick={save} className="tap-target btn-primary">{saving ? 'Saving…' : 'Save reflection'}</Button>
            </div>
            {feedback && <p role="status" className="mt-2 text-ui-13 text-tea-text-sec">{feedback}</p>}
          </div>
        ) : (
          <ul className="divide-y divide-tea-border">
            {query.data?.reflections.map(row => (
              <li key={row.attendee_id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="h3 text-tea-text">{row.title}</h3>
                  <Button variant="plain" type="button" onClick={() => { setEditing(row); setText(row.reflection); }}
                    className="tap-target text-ui-13 text-tea-text-sec">Edit reflection</Button>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-ui-14 text-tea-text">{row.reflection}</p>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}
