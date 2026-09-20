// Small pure helpers for the creator profile and directory pages. Kept out of
// the page files so they can be unit tested and shared without importing a
// screen.

/** Stable, deterministic issue number from the contributor id. Readers see
 *  the same number every visit because the hash only depends on the slug.
 *  Two-digit zero-padded, never No.00. */
export function issueNumberFromId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  const n = Math.abs(h) % 99 + 1;
  return n.toString().padStart(2, '0');
}

/** Map an ISO date to "Season YYYY". December rolls forward into winter. */
export function formatSeason(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const m = d.getMonth();
  const y = d.getFullYear();
  if (m === 11) return `Winter ${y + 1}`;
  if (m <= 1) return `Winter ${y}`;
  if (m <= 4) return `Spring ${y}`;
  if (m <= 7) return `Summer ${y}`;
  return `Autumn ${y}`;
}

/** "Sat 10 Oct · 19:00". The time is dropped when the date carries none. */
export function formatEventMoment(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
  const hasTime = /T\d{2}:\d{2}/.test(iso) || / \d{2}:\d{2}/.test(iso);
  if (!hasTime) return day;
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

export function formatReadTime(mins: number | null | undefined): string | null {
  if (!mins || !Number.isFinite(mins) || mins <= 0) return null;
  return `${Math.round(mins)} min read`;
}

/**
 * The words the page uses for the person, from their own pronouns line.
 * "his way with tea" for he/him, "her way" for she/her, and "their way" for
 * anyone else or for a profile that never said. The design boards were drawn
 * for Kenji; the rule is what generalises them.
 */
export function personWords(pronouns: string | null | undefined): { possessive: string; Possessive: string; object: string; subject: string } {
  const p = (pronouns ?? '').toLowerCase();
  if (/\bhe\b|\bhim\b|\bhis\b/.test(p)) return { possessive: 'his', Possessive: 'His', object: 'him', subject: 'he' };
  if (/\bshe\b|\bher\b|\bhers\b/.test(p)) return { possessive: 'her', Possessive: 'Her', object: 'her', subject: 'she' };
  return { possessive: 'their', Possessive: 'Their', object: 'them', subject: 'they' };
}

/** "Kenji" from "Kenji Tanaka". */
export function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || displayName;
}

/** Split prose on blank lines into paragraphs. */
export function paragraphsOf(text: string | null | undefined): string[] {
  if (!text) return [];
  return text.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
}

/** The Instagram handle as a link target: "@tanakateahouse" opens the profile. */
export function instagramHref(value: string): string {
  const handle = value.trim().replace(/^@/, '');
  if (/^https?:\/\//i.test(handle)) return handle;
  return `https://www.instagram.com/${encodeURIComponent(handle)}/`;
}

/** A website's value as the words shown for it: the host, without the scheme. */
export function websiteLabel(value: string): string {
  try {
    const url = new URL(value);
    return `${url.host}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return value;
  }
}

/** The gallery's two-column stagger. Every fifth photo takes the full width;
 *  the first and third of each five stand tall. Cycles for any count. */
export function galleryPlacement(index: number): { columnSpan: 1 | 2; rowSpan: 1 | 2 } {
  const slot = index % 5;
  if (slot === 4) return { columnSpan: 2, rowSpan: 2 };
  if (slot === 0 || slot === 2) return { columnSpan: 1, rowSpan: 2 };
  return { columnSpan: 1, rowSpan: 1 };
}
