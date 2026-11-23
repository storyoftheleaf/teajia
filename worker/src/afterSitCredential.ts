export const afterSitCredentialFormat = /^[a-f0-9]{64}$/;

const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

export function createAfterSitCredential() {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashAfterSitCredential(credential: string) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(credential))));
}

// Recheck this in each durable operation. Possession of this credential alone
// authorizes the narrow recap projection, independent of any ownership proof.
export const currentAfterSitLink = `
  EXISTS (
    SELECT 1 FROM after_sit_access l
    JOIN accounts shop ON shop.id = l.account_id AND shop.status = 'active'
    WHERE l.credential_hash = ? AND l.expires_at > unixepoch()
      AND l.attendee_id = a.id AND l.event_id = a.event_id AND l.account_id = a.account_id
  )`;
