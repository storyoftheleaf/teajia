/** Fail closed during an account-wide quota outage. State is per isolate/binding,
 * not a global quota reservation; the independent usage monitor supplies warning. */
const cooldowns = new WeakMap<object, number>();
const originals = new WeakMap<object, object>();
const COOLDOWN_MS = 60_000;

export function isDatabaseQuotaError(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
    const item = current as { message?: unknown; cause?: unknown };
    if (typeof item.message === 'string' && /(?:exceeded.*(?:D1|daily row|daily.*limit)|D1.*(?:free tier|quota|daily.*limit))/i.test(item.message)) return true;
    current = item.cause;
  }
  return false;
}

export function databaseUnavailableResponse(): Response {
  return Response.json({
    error: 'This service is temporarily unavailable. Please try again shortly.',
    code: 'database_quota_exceeded',
  }, { status: 503, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } });
}

export function guardDatabase<T extends object>(db: T, now = Date.now) {
  let quotaHit = false;
  let rowsRead = 0;
  let queries = 0;
  const blocked = () => (cooldowns.get(db) ?? 0) > now();
  const record = (result: any) => {
    for (const entry of Array.isArray(result) ? result : [result]) {
      if (typeof entry?.meta?.rows_read === 'number') rowsRead += entry.meta.rows_read;
    }
  };
  const run = async (call: () => any) => {
    if (blocked()) { quotaHit = true; throw new Error('D1 daily row read limit exceeded'); }
    try {
      queries++;
      const result = await call();
      record(result);
      return result;
    } catch (error) {
      if (isDatabaseQuotaError(error)) {
        quotaHit = true;
        cooldowns.set(db, now() + COOLDOWN_MS);
      }
      throw error;
    }
  };
  const statement = (value: any): any => {
    const wrapped = new Proxy(value, {
      get(target, key) {
        const member = Reflect.get(target, key, target);
        if (typeof member !== 'function') return member;
        if (key === 'bind') return (...args: unknown[]) => statement(member.apply(target, args));
        if (['all', 'first', 'run', 'raw'].includes(String(key))) return (...args: unknown[]) => run(() => member.apply(target, args));
        return member.bind(target);
      },
    });
    originals.set(wrapped, value);
    return wrapped;
  };
  const database = new Proxy(db, {
    get(target, key) {
      const member = Reflect.get(target, key, target);
      if (typeof member !== 'function') return member;
      if (key === 'prepare') return (...args: unknown[]) => statement(member.apply(target, args));
      if (key === 'batch') return (items: object[]) => run(() => member.call(target, items.map(item => originals.get(item) ?? item)));
      if (key === 'exec') return (...args: unknown[]) => run(() => member.apply(target, args));
      return member.bind(target);
    },
  });
  return { database, blocked, quotaHit: () => quotaHit, metrics: () => ({ rowsRead, queries }) };
}
