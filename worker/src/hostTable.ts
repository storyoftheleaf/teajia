// 'open' (Launch 3, J10) is offered only by hostDoorsFor; a seat there still needs the host's yes.
export type HostedTableDoor = 'request' | 'link' | 'open';

export type HostedTableInput = {
  accountId: string;
  hostUserId: string;
  hostName: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24 hour */
  time: string;
  /** An IANA time zone name. */
  timezone: string;
  seats?: number;
  door?: HostedTableDoor;
  name?: string | null;
  appOrigin: string;
};

export type HostedTable = { id: string; slug: string; link: string };
export type HostedTableRefusal = { refused: { code: string; error: string } };

const refuse = (code: string, error: string): HostedTableRefusal => ({ refused: { code, error } });
const dayMs = 86_400_000;

function localTimestamp(format: Intl.DateTimeFormat, instant: number): string {
  const parts = Object.fromEntries(format.formatToParts(instant).map(({ type, value }) => [type, value]));
  return `${parts.year.padStart(4, '0')}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

function tableInstant(date: string, time: string, timezone: string): Date | HostedTableRefusal {
  const wallTime = `${date}T${time}:00`;
  const wallMs = Date.parse(`${wallTime}Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(wallMs)
    || new Date(wallMs).toISOString().slice(0, 10) !== date) {
    return refuse('hosted_table_date', 'Give the day as a date.');
  }

  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
  } catch {
    return refuse('hosted_table_timezone', 'Give the time zone the table is in.');
  }
  if (date < localTimestamp(format, Date.now()).slice(0, 10)) {
    return refuse('hosted_table_past_day', 'Choose today or a later day for the table.');
  }

  // Try the offsets on both sides of a clock change. A repeated time uses
  // the earlier instant, and a time skipped by the clock has no match.
  const matches = [wallMs - dayMs, wallMs, wallMs + dayMs]
    .map(sample => wallMs + sample - Date.parse(`${localTimestamp(format, sample)}Z`))
    .filter(instant => localTimestamp(format, instant) === wallTime);
  return matches.length
    ? new Date(Math.min(...matches))
    : refuse('hosted_table_time', 'Choose a time that exists on that day in your time zone.');
}

function tableSlug(title: string): string {
  const stem = title.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-/, '').slice(0, 32).replace(/-$/, '');
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => byte.toString(16).padStart(2, '0')).join('');
  return `${stem || 'table'}-${suffix}`;
}

/** The route passes the approved host and their personal account. */
export async function createHostedTable(db: D1Database, input: HostedTableInput): Promise<HostedTable | HostedTableRefusal> {
  const { accountId, hostUserId, date, time, timezone, appOrigin, seats = 6, door = 'request' } = input;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return refuse('hosted_table_time', 'Give the time as hours and minutes.');
  }
  if (!Number.isInteger(seats) || seats < 1 || seats > 40) {
    return refuse('hosted_table_seats', 'Seats are a whole number from 1 to 40.');
  }
  const instant = tableInstant(date, time, timezone);
  if ('refused' in instant) return instant;

  let title = input.name?.trim();
  if (!title) {
    const person = await db.prepare('SELECT name FROM users WHERE id = ?').bind(hostUserId).first<{ name: string | null }>();
    const firstName = person?.name?.trim().split(/\s+/)[0];
    const weekday = new Intl.DateTimeFormat('en', { timeZone: timezone, weekday: 'long' }).format(instant);
    title = firstName ? `${weekday} at ${firstName}'s table` : 'a table';
  }

  const id = crypto.randomUUID();
  const slug = tableSlug(title);
  await db.prepare(`
    INSERT INTO events (
      id, account_id, host_user_id, title, slug, event_date, timezone, total_capacity, door,
      requires_approval, public_visibility, network_discovery, status, lifecycle_status,
      claim_window_minutes, event_format, gathering_type, recap_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unlisted', 0, 'active', 'published',
      60, 'private_tasting', 'private', 'draft', datetime('now'), datetime('now'))
  `).bind(id, accountId, hostUserId, title, slug, instant.toISOString(), timezone, seats, door, door === 'link' ? 0 : 1).run();
  return { id, slug, link: `${appOrigin}/event/${slug}` };
}
