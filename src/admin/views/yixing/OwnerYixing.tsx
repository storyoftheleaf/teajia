import { useEffect, useRef, useState } from 'react';
import { Link, Route, Routes, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePrivateQueryScope } from '../../hooks/usePrivateQueryScope';
import { QUIET_LINK } from '../../../pages/wisdom/frame';
import { BASE, EMPTY, guidePath, KINDS, loadBoard, potPath, type Auth, type Board, type Decision } from './data';
import { Thumbnail } from './Photos';
import { Guide } from './Guide';
import { Listing } from './Listing';
import { Review } from './Review';

const column = 'mx-auto w-full max-w-[calc(var(--tasting-journal-column)+var(--tasting-journal-rail))] p-4 text-tea-text';
type BoardProps = { board: Board; auth: Auth };

function Index({ board, auth }: BoardProps) {
  const { pots, decisions, reference } = board;
  const count = pots.filter(pot => KINDS.some(kind => decisions[pot.id]?.[kind])).length;
  return <div className={column}>
    <h1 className="type-page-title font-display">Teapot confirmations</h1>
    <Link className={QUIET_LINK} to={guidePath()}>Yixing Wisdom</Link>
    <p className="my-2">{pots.length} pots · {count} with confirmed attributes</p>
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {pots.map(pot => {
        const choice = decisions[pot.id] ?? EMPTY;
        const summary = KINDS.flatMap(kind => reference.entries.filter(e => e.id === choice[kind] && e.kind === kind).map(e => e.name));
        return <li key={pot.id}><Link to={potPath(pot.id)} className="flex items-center gap-2">
          <Thumbnail hash={pot.photos[0]?.sha256} auth={auth} />
          <span>{pot.name}<small className="block text-tea-text-dim">{summary.join(' · ') || 'No confirmed attributes'}</small></span>
        </Link></li>;
      })}
    </ul>
  </div>;
}

function PotRoute({ board, auth, preview, onSave, onReload }: BoardProps & {
  preview?: boolean; onSave: (id: string, d: Decision) => void; onReload: () => Promise<void>;
}) {
  const { id } = useParams();
  const pot = board.pots.find(p => p.id === id);
  if (!pot) return <div className={column}><p>Pot unavailable.</p><Link className={QUIET_LINK} to={BASE}>All pots</Link></div>;
  return preview ? <Listing key={pot.id} board={board} pot={pot} auth={auth} /> : <div className={column}>
    <Review key={pot.id} board={board} pot={pot} auth={auth} onSave={d => onSave(pot.id, d)} onReload={onReload} />
  </div>;
}

export default function OwnerYixing() {
  const scope = usePrivateQueryScope();
  const [accountId, userId] = scope.key;
  const auth = { accountId, userId };
  // A renewed token for the same owner must preserve in-progress edits.
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
    <button className="btn-secondary mt-2" type="button" onClick={() => void result.refetch()}>Try again</button>
  </div>;
  const props = { board: result.data, auth };
  const onSave = (id: string, decision: Decision) => {
    client.setQueryData<Board>(queryKey, old => old && ({ ...old, decisions: { ...old.decisions, [id]: decision } }));
  };
  const onReload = async () => { await result.refetch({ throwOnError: true }); setReloadRevision(r => r + 1); };
  return <Routes key={JSON.stringify([accountId, userId, reloadRevision])}>
    <Route index element={<Index {...props} />} />
    <Route path="wisdom" element={<div className={column}><Guide board={result.data} /></div>} />
    <Route path=":id" element={<PotRoute {...props} onSave={onSave} onReload={onReload} />} />
    <Route path=":id/listing" element={<PotRoute {...props} preview onSave={onSave} onReload={onReload} />} />
  </Routes>;
}
