import { useEffect, useState, type AudioHTMLAttributes } from 'react';
import { api } from '../../lib/api';
import { mediaUrl } from '../../lib/mediaUrl';
import { useAppStore } from '../../lib/store';

export function recordingAudioId(src: string): string | undefined {
  return src.match(/^\/api\/transcriptions\/([a-f0-9-]{36})\/audio$/)?.[1];
}

export function RecordingAudio({ src = '', ...props }: AudioHTMLAttributes<HTMLAudioElement>) {
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  const recordingId = recordingAudioId(src);
  const key = JSON.stringify([src, accountId, userId]);
  const [loaded, setLoaded] = useState<{ key: string; url: string }>();
  const [failedKey, setFailedKey] = useState<string>();
  useEffect(() => {
    if (!recordingId || !accountId || !userId) return;
    let stopped = false;
    let url: string | undefined;
    void api.transcriptionAudio(recordingId, { accountId, userId }).then(blob => {
      if (stopped) return;
      url = URL.createObjectURL(blob);
      setLoaded({ key, url });
    }).catch(() => { if (!stopped) setFailedKey(key); });
    return () => {
      stopped = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [recordingId, accountId, userId, key]);
  const url = recordingId ? loaded?.key === key ? loaded.url : undefined : mediaUrl(src);
  return <>
    <audio {...props} src={url} />
    {recordingId && failedKey === key && <p role="status" className="text-ui-12 text-tea-text-sec">Recording unavailable. Reopen this tea to try again.</p>}
  </>;
}
