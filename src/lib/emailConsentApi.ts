// Email about tea: the caller's own answers, and the sign-up box carried
// across Google. Words and rules are in ./emailConsent.
import { useEffect, useRef, useState } from 'react';
import { API_URL, authedFetch } from './api';

export type EmailConsentHost = { host_user_id: string; name: string; allowed: boolean; decided_at: string | null };
export type MyEmailConsent = {
  teajia: { consent: boolean; decided_at: string | null };
  hosts: EmailConsentHost[];
};

const mine = () => `${API_URL}/api/me/email-consent`;

export const emailConsentApi = {
  /** Whether the sign-up box opens ticked for this visitor; empty when the answer does not come. */
  signupDefault: async (): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/api/public/email-consent/default`);
      if (!res.ok) return false;
      const body = await res.json() as { ticked?: unknown };
      return body.ticked === true;
    } catch {
      return false;
    }
  },
  get: (): Promise<MyEmailConsent> => authedFetch(mine()),
  setTeajia: (consent: boolean): Promise<MyEmailConsent> => authedFetch(mine(), { method: 'PUT', body: JSON.stringify({ consent }) }),
  finishSignup: (consent: boolean, by: 'google' | 'code' = 'google'): Promise<MyEmailConsent> =>
    authedFetch(`${mine()}/signup`, { method: 'POST', body: JSON.stringify({ consent, by }) }),
  setHost: (hostUserId: string, allowed: boolean): Promise<MyEmailConsent> =>
    authedFetch(`${mine()}/hosts/${encodeURIComponent(hostUserId)}`, { method: 'PUT', body: JSON.stringify({ allowed }) }),
};

// ── Carried across Google ───────────────────────────────────────────────────
// "Continue with Google" leaves the page, so the box's state waits in this tab
// until Google sends the person back signed in.

const PENDING_KEY = 'teajia_signup_email_consent';
const PENDING_FOR_MS = 30 * 60 * 1000;

export function holdSignupEmailConsent(consent: boolean) {
  try { window.sessionStorage.setItem(PENDING_KEY, JSON.stringify({ consent, at: Date.now() })); } catch { /* the choice is asked again in the account */ }
}

/** The held choice, taken once. Null when none is held or it is too old. */
export function takeSignupEmailConsent(now = Date.now()): boolean | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    window.sessionStorage.removeItem(PENDING_KEY);
    if (!raw) return null;
    const held = JSON.parse(raw) as { consent?: unknown; at?: unknown };
    if (typeof held.consent !== 'boolean' || typeof held.at !== 'number' || now - held.at > PENDING_FOR_MS) return null;
    return held.consent;
  } catch {
    return null;
  }
}

/** After Google brings a person back signed in: keep the box they left on the sign-up page. */
export function finishHeldSignupEmailConsent() {
  const held = takeSignupEmailConsent();
  if (held !== null) void emailConsentApi.finishSignup(held).catch(() => undefined);
}

/**
 * The sign-up box's state: ticked when the page opens, except where a ticked
 * box is not consent. A box the person has touched keeps their answer.
 */
export function useSignupEmailConsent() {
  const [checked, setChecked] = useState(false);
  const touched = useRef(false);
  useEffect(() => {
    let live = true;
    void emailConsentApi.signupDefault().then(ticked => { if (live && !touched.current) setChecked(ticked); });
    return () => { live = false; };
  }, []);
  const choose = (value: boolean) => { touched.current = true; setChecked(value); };
  return { checked, choose };
}
