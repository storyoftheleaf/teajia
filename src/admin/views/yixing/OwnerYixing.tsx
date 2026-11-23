import { Button } from '../../../components/shared/Button';
import { useEffect, useRef, useState } from 'react';
import { Link, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePrivateQueryScope } from '../../hooks/usePrivateQueryScope';
import { QUIET_LINK } from '../../../pages/wisdom/frame';
import { BASE, EMPTY, loadBoard, potPath, saveReview, type ChangeClay, type Auth, type Board, type Decision } from './data';
import { PotIndex } from './PotIndex';
import { Guide } from './Guide';
import { Listing } from './Listing';
import { Review } from './Review';
import { ShapeLibrary } from './ShapeLibrary';
import { SHAPE_LIBRARY_PATH } from './shapeData';

const column = 'mx-auto w-full max-w-[calc(var(--tasting-journal-column)+var(--tasting-journal-rail))] p-4 text-tea-text';
type BoardProps = { board: Board; auth: Auth };

function PotRoute({ board, auth, preview, onSave, onReload, onClay, draft, onDraft }: BoardProps & {
  preview?: boolean; onClay: ChangeClay; draft?: Decision; onDraft: (decision: Decision) => void; onSave: (id: string, d: Decision) => void; onReload: () => Promise<void>;
}) {
  const { id } = useParams();
  const pot = board.pots.find(p => p.id === id);
  if (!pot) return <div className={column}><p>Pot unavailable.</p><Link className={QUIET_LINK} to={BASE}>All pots</Link></div>;
  return preview ? <Listing key={pot.id} board={board} pot={pot} auth={auth} /> : <div className={column}>
    <Review key={pot.id} board={board} pot={pot} auth={auth} draft={draft} onClay={onClay} onDraft={onDraft} onSave={d => onSave(pot.id, d)} onReload={onReload} />
  </div>;
}

export default function OwnerYixing() {
  const scope = usePrivateQueryScope();
  const [accountId, userId] = scope.key;
  const auth = { accountId, userId };
  // A renewed token for the same owner must preserve in-progress edits.
  const { pathname, search } = useLocation();
  const inShapeLibrary = pathname === SHAPE_LIBRARY_PATH || pathname.startsWith(SHAPE_LIBRARY_PATH + '/');
  const hasPotContext = pathname === BASE + '/wisdom' || inShapeLibrary;
  const contextPot = hasPotContext ? new URLSearchParams(search).get('pot') : null;
  const draftScope = JSON.stringify([accountId, userId, contextPot ? potPath(contextPot) : pathname]);
  const pending = useRef<{ scope: string; draft: Decision } | null>(null);
  useEffect(() => {
    if (pending.current?.scope !== draftScope || !scope.ready) pending.current = null;
  }, [draftScope, scope.ready]);
  const queryKey = ['yixing-review', accountId, userId];
  const client = useQueryClient();
  const [reloadRevision, setReloadRevision] = useState(0);
  const result = useQuery({ queryKey, queryFn: ({ signal }) => loadBoard(auth, signal), enabled: scope.ready, retry: false, gcTime: 0 });
  const revision = scope.key[2];
  const previousRevision = useRef(revision);
  const { refetch } = result;
  useEffect(() => {
    if (scope.ready && revision !== previousRevision.current) void refetch();
    previousRevision.current = revision;
  }, [scope.ready, revision, refetch]);
  if (!scope.ready || result.isPending) return <p className={column} role="status">Opening private review…</p>;
  if (result.isError || !result.data) return <div className={column} role="alert">
    <p>{result.error?.message || 'Unable to open the private review.'}</p>
    <Button variant="secondary" className="mt-2" type="button" onClick={() => void result.refetch()}>Try again</Button>
  </div>;
  const props = { board: result.data, auth };
  const edit = {
    draft: pending.current?.scope === draftScope ? pending.current.draft : undefined,
    onDraft: (draft: Decision) => { pending.current = { scope: draftScope, draft }; },
  };
  const onSave = (id: string, decision: Decision) => {
    pending.current = null;
    client.setQueryData<Board>(queryKey, old => old && ({ ...old, decisions: { ...old.decisions, [id]: decision } }));
  };
  const onClay: ChangeClay = async (id, clayId, action, revision) => {
    const current = result.data.decisions[id] ?? EMPTY;
    const potScope = JSON.stringify([accountId, userId, potPath(id)]);
    const buffered = pending.current;
    if (revision !== current.revision || (buffered?.scope === potScope && buffered.draft.revision !== revision)) {
      throw Object.assign(new Error('This review changed. Reload the saved choices.'), { status: 409 });
    }
    const rejected = new Set(current.rejectedClays);
    if (action === 'deny') rejected.add(clayId);
    else rejected.delete(clayId);
    const clay = action === 'approve' ? clayId : current.clay;
    // Save just the clay decision. Other form edits remain in the owner's draft.
    const saved = await saveReview(id, { ...current, clay, rejectedClays: [...rejected] }, auth);
    client.setQueryData<Board>(queryKey, old => old && ({ ...old, decisions: { ...old.decisions, [id]: saved } }));
    const buffer = pending.current;
    if (buffer?.scope !== potScope) return saved;
    buffer.draft = { ...buffer.draft, clay: saved.clay, rejectedClays: saved.rejectedClays, revision: saved.revision };
    return buffer.draft;
  };
  const onReload = async () => { await result.refetch({ throwOnError: true }); pending.current = null; setReloadRevision(r => r + 1); };
  return <Routes key={JSON.stringify([accountId, userId, reloadRevision])}>
    <Route index element={<div className={column}><PotIndex {...props} onClay={onClay} onRefresh={() => refetch({ throwOnError: true })} /></div>} />
    <Route path="wisdom" element={<div className={column}><Guide board={result.data} onClay={onClay} onReload={onReload} /></div>} />
    <Route path="wisdom/shapes/*" element={<div className={column}><ShapeLibrary {...props} revision={revision} /></div>} />
    <Route path=":id" element={<PotRoute {...props} {...edit} onClay={onClay} onSave={onSave} onReload={onReload} />} />
    <Route path=":id/listing" element={<PotRoute {...props} {...edit} onClay={onClay} preview onSave={onSave} onReload={onReload} />} />
  </Routes>;
}
