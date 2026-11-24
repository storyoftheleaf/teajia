// Who hears about a new order request.
//
// A shop's notice goes to the shop's contact address, else Teajia's own inbox.
// A personal seller's notice goes to the seller: the account's contact
// address, else the sign-in email of the person who owns it. It never falls
// back to Teajia's inbox, because that would hand a buyer's name, contact and
// notes to someone who is not their seller. With no address at all the caller
// records a problem instead of sending.
import { recordHealthProblem } from './incidents';

export type OrderNoticeAccount = {
  contact_email?: string | null;
  personal_inventory_user_id?: string | null;
  owner_email?: string | null;
};

export function orderNoticeRecipient(account: OrderNoticeAccount | null, senderEmail: string | null | undefined): string | null {
  const contact = (account?.contact_email ?? '').trim();
  if (account?.personal_inventory_user_id) return contact || (account.owner_email ?? '').trim() || null;
  return contact || (senderEmail ?? '').trim() || null;
}

/** Account columns the rule reads, joined with the personal seller's sign-in email. */
export const ORDER_NOTICE_ACCOUNT_SQL = `SELECT a.name, a.contact_email, a.personal_inventory_user_id, u.email AS owner_email
  FROM accounts a LEFT JOIN users u ON u.id = a.personal_inventory_user_id WHERE a.id = ?`;

export function recordMissingSellerAddress(db: D1Database, accountId: string) {
  return recordHealthProblem(db, {
    signature: `personal-seller-no-order-address:${accountId}`,
    category: 'server',
    severity: 'high',
    errorCode: 'personal_seller_no_order_address',
    message: `A personal seller received an order request, but their account has no email address to send it to. The request is saved; reply from the order list.`,
  });
}
