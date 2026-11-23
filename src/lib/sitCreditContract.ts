export const SIT_CREDIT_ROLES = ['lead_host', 'co_host', 'guest_host', 'photographer', 'author'] as const;
export type SitCreditRole = typeof SIT_CREDIT_ROLES[number];

const labels: Record<SitCreditRole, readonly [string, string]> = {
  lead_host: ['Host', 'Hosted'],
  co_host: ['Co-host', 'Co-hosted'],
  guest_host: ['Guest pour', 'Poured at'],
  photographer: ['Photographer', 'Photographed'],
  author: ['Writer', 'Wrote about'],
};

function credit(role: string) {
  return SIT_CREDIT_ROLES.includes(role as SitCreditRole) ? labels[role as SitCreditRole] : null;
}

export const sitCreditLabel = (role: string) => credit(role)?.[0] ?? null;
export const sitProfileCreditVerb = (role: string) => credit(role)?.[1] ?? null;
