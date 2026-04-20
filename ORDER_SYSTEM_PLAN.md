# Order System Plan — Model B Checkout

## Core concept
An order is a customer-initiated invoice. The admin invoice system already exists. What's missing is the customer-facing request layer and payment flexibility.

## Pricing
Price per gram is already set in the system — no re-quoting needed. The only two variables the admin adjusts at confirmation:
1. **Actual quantity** — if only 40g available and 50g was requested, admin adjusts to 40g, customer sees updated total and confirms
2. **Shipping cost** — added manually per order based on location and delivery method chosen

## Full flow

### Customer side
1. On product page (must be logged in): "Request to order" button
2. They specify: quantity in grams, delivery preference (pickup / local delivery / international shipping), optional note
3. Confirmation screen: shows product, quantity, price total at system price, delivery method selected
4. Submit → "Your request has been received. We'll confirm availability shortly."
5. In their account → "My Orders" tab with live status

### Admin side
1. Incoming request in admin panel — customer name, product, quantity requested, delivery preference, note
2. Admin checks physical stock
3. Two scenarios:
   - **Stock OK**: confirm quantity as-is, add shipping cost if applicable, mark as confirmed
   - **Partial stock**: adjust quantity down, customer notified of change, customer re-confirms
4. Customer confirms → order becomes active
5. Admin records payment:
   - Cash (in person) → tap "Mark paid", done
   - Bank transfer → customer sees bank details in their account, admin taps "Mark received" when transfer arrives
   - Payment link → admin pastes any external URL (Stripe, PayPal, GoPay, GrabPay, PayNow, anything) — customer sees clickable link in their account
   - Pay later / tab → mark pending with note, settle when ready
6. Admin marks dispatched (with optional tracking note)
7. Stock deducts at fulfillment
8. Customer sees "Dispatched" status

## Order statuses
Requested → Confirmed → Awaiting Payment → Paid → Dispatched → Complete
Side exits: Cancelled (any point), Adjusted (quantity changed, awaiting re-confirmation)

## Payment methods — per account configuration
Each store configures their accepted payment methods in account settings. Examples:
- Teajia Bali: Cash, BCA Bank Transfer, GoPay
- Teajia Singapore: Cash, PayNow, PayPal
- Teajia London: Cash, UK Bank Transfer, Stripe link

Customer sees only the ordering store's payment options. Admin workflow is identical across all stores.

No mandatory payment gateway. Admin flexibility is the core design principle.

## In-person orders
Admin can create an order on behalf of a customer directly from the admin panel (same as current invoice creation). Works identically when standing with a customer in person.

## Multi-store compatibility
Each account has its own payment method configuration. The order system is account-scoped. Works for any store using the Teajia platform regardless of country or local payment infrastructure.

## What to build (new pieces)
| Piece | Notes |
|---|---|
| Customer order request UI | On product page/modal, requires login |
| Customer "My Orders" account tab | Live status, order history, payment instructions |
| Quantity adjustment + re-confirm flow | Admin adjusts → customer confirms new total |
| Shipping cost field on order confirmation | Admin-entered per order |
| Payment method config in account settings | Per-store list of accepted methods |
| Payment recording on invoices | Method + notes field + mark paid action |
| Order status visibility for customer | Maps to existing invoice statuses |

## What already exists
- Invoice system (orders become invoices)
- Stock ledger (deducts at fulfillment)
- Customer records
- Fulfillment / void / split invoice RPCs
- WhatsApp number per account (still usable for side communication if wanted)

## WhatsApp
Becomes optional. Admin can still message a customer via WhatsApp for personal conversation, but the order record exists in the system from the start. WhatsApp is no longer the intake mechanism.

## Customer discounts

Certain customers receive a silent discount percentage stored on their customer record (`discount_percentage?: number`). Completely invisible to the customer — they see only the final price with no indication a discount exists. No codes, no "you saved X", no promo fields.

Admin side only:
- Customer record has a `discount_percentage` field (e.g. 15)
- When confirming an order for that customer, line item prices calculate at the discounted rate automatically
- Admin sees: original price, discount %, discounted price, and margin
- Customer sees: only the final price they pay

Wholesale buyers, VIPs, friends — all handled via this field, complementing the existing customer tags. No customer-facing UI changes required.
