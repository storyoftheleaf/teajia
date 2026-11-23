import { MemberSitPublication } from '../components/account/MemberSitPublication';
import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { hasToken } from '../lib/api';
import { authPagePath } from '../lib/authNavigation';
import {
  isMemberSitScopeCurrent, memberSitInvitePath, memberSitPath, memberSitRequest, memberSitsKey, memberSitTitle,
  useMemberSitScope, type MemberSit, type MemberSitScope,
} from '../lib/memberPrivateSits';
import { Button } from '../components/shared/Button';
import { Modal } from '../components/shared/Modal';
import { MemberSitTasting } from '../components/account/MemberSitTasting';

const journey = '/account/journey';
const pendingInviteStorageKey = 'teajia_pending_private_sit_invite';

function SitFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-tea-bg">
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-nav-gap">
        <Link to={journey} className="btn-quiet btn-sm">Back to Journey</Link>
        {children}
      </div>
    </div>
  );
}

type SitExtras = {
  renderPhotos?: (sit: MemberSit) => ReactNode;
};

export function MemberSitPage(extras: SitExtras) {
  const { id } = useParams();
  const scope = useMemberSitScope();
  const token = hasToken();
  return (
    <SitFrame>
      {!token ? (
        <div className="mt-4"><Link to={authPagePath('signin', id ? memberSitPath(id) : journey)} className="btn-primary">Sign in to open this sit</Link></div>
      ) : scope && id ? (
        <SitDetail key={JSON.stringify([scope.userId, scope.accountId, id])} id={id} scope={scope} {...extras} />
      ) : (
        <p className="mt-4 text-tea-text-sec" role="status">Opening your account…</p>
      )}
    </SitFrame>
  );
}

function SitDetail({ id, scope, renderPhotos }: SitExtras & { id: string; scope: MemberSitScope }) {
  const queryClient = useQueryClient();
  const path = '/' + encodeURIComponent(id);
  const queryKey = [...memberSitsKey(scope), id];
  const query = useQuery({
    queryKey, queryFn: () => memberSitRequest<MemberSit>(scope, path), retry: false, gcTime: 0,
  });
  const [editing, setEditing] = useState(false);
  const sit = query.data;
  if (!sit) {
    return query.isError ? (
      <p className="mt-4 text-tea-text-sec" role="alert">Couldn’t open this private sit.</p>
    ) : (
      <p className="mt-4 text-tea-text-sec" role="status">Opening private sit…</p>
    );
  }
  function patch(patch: Partial<MemberSit>) {
    if (!isMemberSitScopeCurrent(scope)) return;
    queryClient.setQueryData<MemberSit>(queryKey, previous => previous ? { ...previous, ...patch } : previous);
    void queryClient.invalidateQueries({ queryKey: memberSitsKey(scope), exact: true });
  }
  return (
    <div className="mt-4 max-w-xl">
      <h1 className="h1 break-words">{memberSitTitle(sit)}</h1>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <time className="text-ui-13 text-tea-text-sec" dateTime={sit.date}>{sit.date}</time>
        {sit.role === 'host' && (
          <Button type="button" variant="quiet" size="sm" onClick={() => setEditing(true)}>Edit sit details</Button>
        )}
      </div>
      {sit.description && <p className="body-prose mt-2 break-words whitespace-pre-wrap">{sit.description}</p>}
      {sit.tea && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-ui-16 break-words min-w-0">{sit.tea.name}</p>
          <MemberSitTasting sitId={id} tea={sit.tea} photographs={renderPhotos?.(sit)} />
        </div>
      )}
      <p className="mt-3 text-ui-14 text-tea-text-sec">
        {sit.role === 'host' ? 'Only you and people who join can see this sit.' : 'Only the host and people who joined can see this sit.'}
      </p>
      {sit.role === 'host' && <SitInvitation path={path} scope={scope} pending={sit.invitePending} onChange={invitePending => patch({ invitePending })} />}
      {sit.role === 'host' && <MemberSitPublication sit={sit} scope={scope} />}
      <PrivateMemory key={sit.id} path={path} scope={scope} initialNote={sit.note} onSave={note => patch({ note })} />
      {renderPhotos?.(sit)}
      {editing && (
        <EditSitDetails path={path} scope={scope} sit={sit} onClose={() => setEditing(false)}
          onSave={details => { patch(details); setEditing(false); }} />
      )}
    </div>
  );
}

function SitInvitation({ path, scope, pending, onChange }: {
  path: string; scope: MemberSitScope; pending: boolean; onChange: (pending: boolean) => void;
}) {
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const change = useMutation({
    mutationFn: (method: 'PUT' | 'DELETE') => memberSitRequest<{ token?: string }>(scope, path + '/invite', method),
    onSuccess: ({ token }) => {
      setLink(token ? new URL(`${memberSitInvitePath}#${token}`, window.location.origin).href : '');
      setCopied(false);
      onChange(Boolean(token));
    },
  });
  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={change.isPending} onClick={() => change.mutate('PUT')}>
          {pending ? 'Replace invitation' : 'Invite someone'}
        </Button>
        {pending && (
          <Button type="button" variant="quiet" size="sm" disabled={change.isPending} onClick={() => change.mutate('DELETE')}>
            Revoke invitation
          </Button>
        )}
      </div>
      {link && (
        <>
          <p className="text-ui-13 text-tea-text-sec">The first signed-in person to use this link can join within seven days.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input type="text" readOnly aria-label="Invitation link" value={link} className="btn-field min-w-0 flex-1"
              onFocus={event => event.target.select()} />
            <Button type="button" variant="quiet" size="sm"
              onClick={() => void navigator.clipboard?.writeText(link).then(() => setCopied(true), () => setCopied(false))}>
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        </>
      )}
      {change.isError && <p className="text-ui-13 text-tea-text-sec" role="alert">Couldn’t update the invitation. Try again.</p>}
    </div>
  );
}

function PrivateMemory({ path, scope, initialNote, onSave }: {
  path: string; scope: MemberSitScope; initialNote: string | null; onSave: (note: string | null) => void;
}) {
  const [note, setNote] = useState(initialNote ?? '');
  const save = useMutation({
    mutationFn: (value: string) => memberSitRequest<{ note: string | null }>(scope, path + '/note', 'PUT', { note: value }),
    onSuccess: ({ note }) => {
      setNote(note ?? '');
      onSave(note);
    },
  });
  return (
    <form className="mt-4 border-t border-tea-border pt-3" onSubmit={event => { event.preventDefault(); save.mutate(note); }}>
      <label className="block text-ui-14 text-tea-text" htmlFor="member-sit-note">Your private note</label>
      <p className="text-ui-13 text-tea-text-sec mt-1">Only you can see this note.</p>
      <textarea id="member-sit-note" className="input-field mt-2 px-3 py-2 text-ui-14 leading-relaxed resize-y" rows={2} maxLength={2000} value={note}
        onChange={event => { setNote(event.target.value); save.reset(); }} disabled={save.isPending} />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          {save.isSuccess && <p className="text-ui-13 text-tea-text-sec" role="status">Note saved</p>}
          {save.isError && <p className="text-ui-13 text-tea-text-sec" role="alert">Couldn’t save the note. Try again.</p>}
        </div>
        <Button type="submit" variant="secondary" size="sm" disabled={save.isPending || note === (initialNote ?? '')}>
          {save.isPending ? 'Saving…' : 'Save private note'}
        </Button>
      </div>
    </form>
  );
}

type SavedDetails = Pick<MemberSit, 'title' | 'description' | 'tea'>;

function EditSitDetails({ path, scope, sit, onClose, onSave }: {
  path: string; scope: MemberSitScope; sit: MemberSit; onClose: () => void; onSave: (details: SavedDetails) => void;
}) {
  const [title, setTitle] = useState(sit.title ?? '');
  const [description, setDescription] = useState(sit.description ?? '');
  const [teaName, setTeaName] = useState('');
  const save = useMutation({
    mutationFn: () => memberSitRequest<SavedDetails>(scope, path, 'PUT', { title, description, teaName }),
    onSuccess: onSave,
  });
  return (
    <Modal isOpen title="Edit sit details" onClose={onClose}>
      <form className="p-4 space-y-3" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
        <p className="text-ui-13 text-tea-text-sec">Everyone who joined can see these details.</p>
        <label className="block text-ui-14 text-tea-text">
          Name
          <input type="text" className="btn-field mt-1 w-full" maxLength={120} value={title} onChange={event => setTitle(event.target.value)} />
        </label>
        {!sit.tea && (
          <label className="block text-ui-14 text-tea-text">
            Tea
            <input type="text" className="btn-field mt-1 w-full" maxLength={200} value={teaName} onChange={event => setTeaName(event.target.value)} />
          </label>
        )}
        <label className="block text-ui-14 text-tea-text">
          Description
          <textarea className="input-field mt-1 px-3 py-2 text-ui-14 leading-relaxed resize-y" rows={3} maxLength={700} value={description} onChange={event => setDescription(event.target.value)} />
        </label>
        {save.isError && <p className="text-ui-13 text-tea-text-sec" role="alert">Couldn’t save sit details. Try again.</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="quiet" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save details'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function inviteToken(hash: string): string | null {
  const fragment = hash.slice(1);
  if (/^[a-f0-9]{64}$/.test(fragment)) return fragment;
  if (fragment) return null;
  try {
    return sessionStorage.getItem(pendingInviteStorageKey);
  } catch {
    return null;
  }
}

export function MemberSitInvitePage() {
  const { hash } = useLocation();
  const token = inviteToken(hash);
  const scope = useMemberSitScope();
  const signedIn = hasToken();
  return (
    <SitFrame>
      <h1 className="h1 mt-4">You’re invited to a tea sit</h1>
      {!token ? (
        <p className="text-ui-14 text-tea-text-sec mt-2">Open the invitation link you received.</p>
      ) : !signedIn ? (
        <>
          <p className="text-ui-14 text-tea-text-sec my-2">Sign in to accept and keep this private sit in Journey.</p>
          <Link to={authPagePath('signin', memberSitInvitePath)} className="btn-primary" onClick={() => {
            try { sessionStorage.setItem(pendingInviteStorageKey, token); } catch { /* The original link can be opened again. */ }
          }}>Sign in to join</Link>
        </>
      ) : scope ? (
        <AcceptSitInvite key={JSON.stringify([scope.userId, scope.accountId, token])} token={token} scope={scope} />
      ) : (
        <p className="text-ui-14 text-tea-text-sec mt-2" role="status">Opening your account…</p>
      )}
    </SitFrame>
  );
}

function AcceptSitInvite({ token, scope }: { token: string; scope: MemberSitScope }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accept = useMutation({
    mutationFn: () => memberSitRequest<{ id: string }>(scope, '/accept', 'POST', { token }),
    onSuccess: ({ id }) => {
      if (!isMemberSitScopeCurrent(scope)) return;
      try { sessionStorage.removeItem(pendingInviteStorageKey); } catch { /* The active link is replaced below. */ }
      void queryClient.invalidateQueries({ queryKey: memberSitsKey(scope), exact: true });
      navigate(memberSitPath(id), { replace: true });
    },
  });
  return (
    <>
      <p className="text-ui-14 text-tea-text-sec my-2">Join to see this sit and save it to your Journey.</p>
      <Button type="button" variant="primary" disabled={accept.isPending} onClick={() => accept.mutate()}>
        {accept.isPending ? 'Joining…' : 'Join this sit'}
      </Button>
      {accept.isError && <p className="text-ui-13 text-tea-text-sec mt-2" role="alert">Couldn’t join. This invitation may have expired or already been used.</p>}
    </>
  );
}
