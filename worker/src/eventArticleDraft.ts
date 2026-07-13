type SourceRow = Record<string, unknown>;

export type EventArticleDraft = {
  title: string;
  subtitle: string | null;
  status: 'draft';
  category: 'Field Notes';
  layout_template: 'immersive_scroll';
  cover_image_url: string | null;
  blocks: Array<Record<string, unknown>>;
};

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sharedNotes(value: unknown): string[] {
  const direct = nonEmpty(value);
  if (direct) {
    try {
      const parsed = JSON.parse(direct);
      return Array.isArray(parsed) ? parsed.map(nonEmpty).filter((note): note is string => !!note) : [];
    } catch {
      return [direct];
    }
  }
  return parseArray(value).map(nonEmpty).filter((note): note is string => !!note);
}

function teaLedgerRows(value: unknown): SourceRow[] {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { return []; }
  }
  const rows = Array.isArray(parsed)
    ? parsed
    : (parsed && typeof parsed === 'object' && Array.isArray((parsed as SourceRow).teas) ? (parsed as SourceRow).teas : []);
  return rows.filter((tea): tea is SourceRow => !!tea && typeof tea === 'object' && !Array.isArray(tea));
}

export function buildEventArticleDraft(event: SourceRow, postSession: SourceRow | null): EventArticleDraft {
  const title = nonEmpty(event.title) || '';
  const subtitle = nonEmpty(event.subtitle);
  const source = postSession || {};
  const gallery = parseArray(source.gallery_images).map(nonEmpty).filter((url): url is string => !!url);
  const sessionNotes = nonEmpty(source.session_notes);
  const hostNotes = nonEmpty(source.host_notes);
  const hostChanges = nonEmpty(source.host_changes);
  const energy = nonEmpty(source.energy);
  const teas = teaLedgerRows(source.tea_ledger);
  const notes = sharedNotes(source.shared_tasting_notes);
  const cover = gallery[0] || null;
  const blocks: Array<Record<string, unknown>> = [{
    type: 'cover',
    title,
    ...(subtitle ? { subtitle } : {}),
    ...(cover ? { image: cover } : {}),
    ...(energy ? { kicker: energy } : {}),
  }];

  if (sessionNotes) blocks.push({ type: 'intro', text: sessionNotes });
  if (hostNotes) blocks.push({ type: 'paragraph', text: hostNotes });
  if (hostChanges) blocks.push({ type: 'paragraph', text: hostChanges });
  for (const tea of teas) {
    const name = nonEmpty(tea.name) || nonEmpty(tea.product_name) || nonEmpty(tea.custom_name);
    const detail = nonEmpty(tea.notes) || nonEmpty(tea.description) || nonEmpty(tea.tasting_notes);
    if (name && detail) {
      blocks.push({ type: 'section_heading', text: name });
      blocks.push({ type: 'paragraph', text: detail });
    }
  }
  for (const url of gallery) blocks.push({ type: 'image', url, description: '' });
  for (const note of notes) blocks.push({ type: 'quote', text: note });

  return {
    title,
    subtitle,
    status: 'draft',
    category: 'Field Notes',
    layout_template: 'immersive_scroll',
    cover_image_url: cover,
    blocks,
  };
}
