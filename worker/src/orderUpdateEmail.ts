// The email a customer leaves for order updates after unticking WhatsApp
// updates at checkout. Shipping payment messages go there instead.

export function readOrderUpdateEmail(value: unknown): { email: string | null; error: string | null } {
  if (value === undefined || value === null || value === '') return { email: null, error: null };
  if (typeof value !== 'string') return { email: null, error: 'The update email must be text.' };
  const email = value.trim();
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return { email: null, error: 'Enter a valid email for order updates, or leave it empty.' };
  return { email, error: null };
}
