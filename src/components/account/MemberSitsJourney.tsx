import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  isMemberSitScopeCurrent, memberSitPath, memberSitRequest, memberSitsKey, memberSitTitle, useMemberSitScope,
  type MemberSit, type MemberSitScope, type SitTea,
} from '../../lib/memberPrivateSits';
import { Button } from '../shared/Button';

function localDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function StartMemberSitButton({ tea }: { tea?: SitTea }) {
  const scope = useMemberSitScope();
  if (!scope) return null;
  return <StartSit key={JSON.stringify([scope.userId, scope.accountId, tea?.id, tea?.name])} scope={scope} tea={tea} />;
}

function StartSit({ scope, tea }: { scope: MemberSitScope; tea?: SitTea }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const draft = useRef<{ requestId: string; date: string } | null>(null);
  const create = useMutation({
    mutationFn: () => memberSitRequest<{ id: string }>(scope, '', 'POST', {
      ...(draft.current ??= { requestId: crypto.randomUUID(), date: localDate() }), tea,
    }),
    onSuccess: ({ id }) => {
      draft.current = null;
      if (!isMemberSitScopeCurrent(scope)) return;
      void queryClient.invalidateQueries({ queryKey: memberSitsKey(scope) });
      navigate(memberSitPath(id));
    },
  });
  return (
    <div>
      <Button type="button" size="sm" variant="primary" disabled={create.isPending} onClick={() => create.mutate()}>
        {create.isPending ? 'Starting…' : 'Start a sit'}
      </Button>
      {create.isError && <p className="text-ui-13 text-tea-text-sec mt-2" role="alert">Couldn’t start the sit. Try again.</p>}
    </div>
  );
}

export function MemberSitsJourney() {
  const scope = useMemberSitScope();
  if (!scope) return null;
  return <SitsArchive key={JSON.stringify([scope.userId, scope.accountId])} scope={scope} />;
}

function SitsArchive({ scope }: { scope: MemberSitScope }) {
  const archive = useQuery({
    queryKey: memberSitsKey(scope),
    queryFn: () => memberSitRequest<{ sits: MemberSit[] }>(scope),
    retry: false,
    gcTime: 0,
  });
  return (
    <section className="my-6 border-y border-tea-border py-4" aria-labelledby="member-sits-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="member-sits-title" className="h2">Private sits</h2>
        <StartSit scope={scope} />
      </div>
      {archive.isError && (
        <Button type="button" variant="quiet" size="sm" disabled={archive.isFetching} onClick={() => void archive.refetch()}>
          Retry loading private sits
        </Button>
      )}
      {!!archive.data?.sits.length && (
        <ul className="divide-y divide-tea-border mt-2">
          {archive.data.sits.map(sit => (
            <li key={sit.id} className="py-2">
              <Link to={memberSitPath(sit.id)} className="flex min-h-tap flex-wrap items-center justify-between gap-x-3 gap-y-1 hover:text-tea-gold">
                <span className="break-words min-w-0">
                  <span className="text-ui-16">{memberSitTitle(sit)}</span>
                  {sit.tea && <span className="block text-ui-13 text-tea-text-sec">{sit.tea.name}</span>}
                </span>
                <time className="text-ui-13 text-tea-text-sec" dateTime={sit.date}>{sit.date}</time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
