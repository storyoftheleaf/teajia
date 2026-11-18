interface Recording {
  id: string;
  account_id: string;
  user_id: string;
  object_key: string;
  mime_type: string;
  status: string;
  transcript: string | null;
  created_at: string;
}

export function recordingAudioUrl(id: string): string {
  return `/api/transcriptions/${encodeURIComponent(id)}/audio`;
}

export function linkedRecordingSql(recordingAlias = 'private_recordings'): string {
  return `EXISTS (
    SELECT 1 FROM tea_compass_entries e,
      json_each(CASE WHEN json_valid(e.audio_clips) THEN e.audio_clips ELSE '[]' END) clip
    WHERE e.account_id = ${recordingAlias}.account_id
      AND json_extract(clip.value, '$.url') = '/api/transcriptions/' || ${recordingAlias}.id || '/audio'
  )`;
}

export async function readOwnedRecording(db: D1Database, id: string, accountId: string, userId: string) {
  return db.prepare('SELECT * FROM private_recordings WHERE id=? AND account_id=? AND user_id=?')
    .bind(id, accountId, userId).first<Recording>();
}

/** Private recording URLs can only be attached by the dedicated ownership-checked command.
 * A stale ordinary sync keeps the links already attached to its own encounter. */
export function preservePrivateRecordingClips(incoming: unknown, stored: unknown): string {
  const clips = (value: unknown): Array<Record<string, unknown>> => {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  };
  const privateClip = (clip: Record<string, unknown>) =>
    typeof clip?.url === 'string' && clip.url.startsWith('/api/transcriptions/');
  return JSON.stringify([
    ...clips(incoming).filter(clip => !privateClip(clip)),
    ...clips(stored).filter(privateClip),
  ]);
}

export function mergeRecordingClipsSql(incoming: string, stored: string): string {
  return `(SELECT COALESCE(json_group_array(json(value)), '[]') FROM (
    SELECT value FROM json_each(${incoming})
      WHERE COALESCE(json_extract(value,'$.url'),'') NOT LIKE '/api/transcriptions/%'
    UNION ALL
    SELECT value FROM json_each(CASE WHEN json_valid(${stored}) THEN ${stored} ELSE '[]' END)
      WHERE json_extract(value,'$.url') LIKE '/api/transcriptions/%'
  ))`;
}
