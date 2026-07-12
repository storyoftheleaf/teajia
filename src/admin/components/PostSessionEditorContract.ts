export interface PostSessionEditorState {
  teaLedger: string;
  playlistUrl: string;
  gallery: string[];
  sessionNotes: string;
  energy: string;
  sharedTastingNotes: string;
  hostNotes: string;
  hostChanges: string;
}

const value = (source: Record<string, any>, snake: string, camel: string) =>
  source[snake] ?? source[camel];

function editorText(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input == null) return '';
  return JSON.stringify(input);
}

function galleryValue(input: unknown): string[] {
  if (Array.isArray(input)) return input.filter((item): item is string => typeof item === 'string');
  if (typeof input !== 'string') return [];
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch { return []; }
}

function sharedNotesValue(input: unknown): string {
  if (Array.isArray(input)) return input.filter((item): item is string => typeof item === 'string').join('\n');
  if (typeof input !== 'string') return '';
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').join('\n') : input;
  } catch { return input; }
}

export function postSessionEditorState(source: Record<string, any> = {}): PostSessionEditorState {
  return {
    teaLedger: editorText(value(source, 'tea_ledger', 'teaLedger')),
    playlistUrl: editorText(value(source, 'playlist_url', 'playlistUrl')),
    gallery: galleryValue(source.gallery_images ?? source.galleryImages ?? source.gallery),
    sessionNotes: editorText(value(source, 'session_notes', 'sessionNotes')),
    energy: editorText(source.energy),
    sharedTastingNotes: sharedNotesValue(value(source, 'shared_tasting_notes', 'sharedTastingNotes')),
    hostNotes: editorText(value(source, 'host_notes', 'hostNotes')),
    hostChanges: editorText(value(source, 'host_changes', 'hostChanges')),
  };
}

export function postSessionSavePayload(state: PostSessionEditorState) {
  return {
    tea_ledger: state.teaLedger,
    playlist_url: state.playlistUrl,
    gallery_images: state.gallery,
    session_notes: state.sessionNotes,
    energy: state.energy,
    shared_tasting_notes: state.sharedTastingNotes.split('\n').map(note => note.trim()).filter(Boolean),
    host_notes: state.hostNotes,
    host_changes: state.hostChanges,
  };
}

export async function savePostSession(
  submit: (eventId: string, body: Record<string, unknown>) => Promise<unknown>,
  eventId: string,
  state: PostSessionEditorState,
) {
  return submit(eventId, postSessionSavePayload(state));
}
