import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, hasToken } from '../../lib/api';
import { selectIsOwnerTier, useAppStore } from '../../lib/store';

const KEY = ['curate', 'drive'] as const;

const RETURN_WORDS: Record<string, string> = {
  connected: 'Drive connected. Earlier photos are being copied now.',
  not_allowed: 'Only the shop’s owner can connect its Drive.',
  drive_not_granted: 'Google did not give access to Drive. Try again and leave the Drive box ticked.',
  no_refresh_token: 'Google did not give a lasting link. Try connecting again.',
  token_exchange_failed: 'Google did not finish the link. Try again.',
};

/**
 * One line on Today: where Curate photos go. Every photo on a tea is copied to
 * the shop's Google Drive, one folder per vendor and per tea, so it can be
 * opened and edited on a computer and found by an agent without the app.
 */
export const DriveLine: React.FC = () => {
  const queryClient = useQueryClient();
  const isOwner = useAppStore(selectIsOwnerTier);
  const status = useQuery({ queryKey: KEY, queryFn: () => api.compass.driveStatus(), enabled: hasToken(), staleTime: 60_000 });
  const [note, setNote] = useState<string | null>(null);
  const backfilled = useRef(false);

  const connect = useMutation({
    mutationFn: () => api.compass.driveConnect(window.location.pathname),
    onSuccess: ({ url }) => { window.location.href = url; },
  });
  const saveNow = useMutation({
    mutationFn: () => api.compass.driveSaveNow(),
    onSuccess: (r) => {
      setNote(r.copied ? `${r.copied} photo${r.copied === 1 ? '' : 's'} copied to Drive.` : 'No photos waiting to copy. New ones go to Drive as they are taken.');
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });

  // Back from Google: say what happened, copy the earlier photos once, and tidy the address.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('drive');
    if (!result) return;
    setNote(RETURN_WORDS[result] ?? 'Drive was not connected. Try again.');
    params.delete('drive');
    const rest = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
    if (result === 'connected' && !backfilled.current) {
      backfilled.current = true;
      queryClient.invalidateQueries({ queryKey: KEY });
      saveNow.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = status.data;
  if (!s || (!s.connected && !isOwner)) return null;

  return (
    <div className="border-b border-tea-border px-4 py-3" data-testid="curate-drive-line">
      <div className="flex min-h-11 items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block text-ui-14 text-tea-text">
            {!s.connected ? 'Save photos to Google Drive' : s.needs_reconnect ? 'Google Drive needs connecting again' : 'Photos are saved to Google Drive'}
          </span>
          <span className="block truncate text-ui-12 text-tea-text-dim">
            {!s.connected ? 'A folder for each vendor and tea' : s.email ?? 'Teajia Curate folder'}
          </span>
        </span>
        {(!s.connected || s.needs_reconnect) && isOwner && (
          <button type="button" onClick={() => connect.mutate()} disabled={connect.isPending} className="min-h-11 rounded-md border border-tea-border px-3 text-ui-13 font-medium text-tea-text hover:border-tea-gold">
            {s.needs_reconnect ? 'Reconnect' : 'Connect'}
          </button>
        )}
        {s.connected && !s.needs_reconnect && s.folder_url && (
          <a href={s.folder_url} target="_blank" rel="noreferrer" className="min-h-11 content-center text-ui-13 font-medium text-tea-gold">
            Open folder
          </a>
        )}
        {s.connected && !s.needs_reconnect && !s.folder_url && (
          <button type="button" onClick={() => saveNow.mutate()} disabled={saveNow.isPending} className="min-h-11 text-ui-13 font-medium text-tea-gold">
            {saveNow.isPending ? 'Copying…' : 'Copy photos now'}
          </button>
        )}
      </div>
      {(note || connect.isError || saveNow.isError) && (
        <p className={`text-ui-12 ${connect.isError || saveNow.isError ? 'text-tea-error' : 'text-tea-text-sec'}`}>
          {connect.isError ? (connect.error as Error).message : saveNow.isError ? (saveNow.error as Error).message : note}
        </p>
      )}
    </div>
  );
};
