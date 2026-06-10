# Store Operator Daily Workflows

This is the short operating guide for a non-Adrian store owner or staff member.

## Daily opening

1. Sign in to admin.
2. Confirm the active account badge is the correct store.
3. Check pending orders in Activity.
4. Check low or questionable stock in Inventory.
5. Check event RSVPs if an event is upcoming.

## Add a new tea

1. Go to Inventory.
2. Add product or import CSV.
3. Fill name, type, year, origin, stock, price, and image.
4. Decide public or private.
5. Save.
6. Open the storefront and confirm the item reads correctly.

## Update stock

1. Go to Inventory.
2. Find the product.
3. Adjust stock with a clear reason.
4. Check that public products still have enough sellable stock.

## Handle a customer order

1. Customer messages through WhatsApp or email.
2. Confirm product, quantity, price, and delivery/pickup details.
3. Create or update the order in Activity.
4. Fulfill when stock leaves the shelf.
5. Confirm stock changed as expected.

## Add a customer

1. Go to People.
2. Create or open the customer profile.
3. Add contact details, tags, and relevant notes.
4. Keep private sourcing or sensitive notes out of customer-facing copy.

## Run an event

1. Go to Events.
2. Create event with title, date, capacity, venue, and tea menu.
3. Open the public page.
4. Test RSVP.
5. Review attendees before the event.
6. Use check-in during the event only when needed.
7. Add post-session notes after the gathering.

## Invite staff

1. Go to Members & Access.
2. Add email.
3. Choose a preset.
4. Send or copy the invite link.
5. Confirm the member accepted.
6. Adjust bundles only if their work changes.

## Weekly review

1. Export or back up stock if needed.
2. Review stale public products with no stock.
3. Check pending orders.
4. Check pending invites.
5. Review whether staff still need their current access.

## Voice and AI assistant

You can connect an AI assistant (such as Claude) to the store and talk to it in plain language. It can now both look things up and make changes.

### What the assistant can look up

Before, the assistant could only change things. Now it can also report:

- Invoices: list them or open one to read the details.
- A customer's history: who they are and what they have bought.
- Sales summaries: totals over a period.
- Account context: the store's currency and the next invoice number.

Use this to ask questions like "what did this customer order last," "show me the open invoices," or "how did sales go this week," without opening the admin yourself.

### Changes are now reliable

When you ask the assistant to change something (record a sale, adjust stock), it first shows you a preview and waits for you to confirm. That confirmation no longer expires mid-conversation. You can read the preview, take your time, and confirm when ready without getting an "expired" error.

### Letting customers' own AI browse the catalogue

There is a separate public assistant that needs no login. A customer can point their own AI at the store to:

- Browse and search the catalogue.
- Build a ready-to-send WhatsApp order link.

The AI only preps the basket. It never places the order. The order still closes the same way it always has: a personal WhatsApp conversation with you. The public assistant only sees public information. It never sees cost, margin, vendor, or exact stock.

### The store is now AI-discoverable

The site tells AI tools what it offers (through an `llms.txt` index and structured data on the site and articles). This means a customer's AI can find the shop, the journal, and the public assistant on its own. Nothing for you to do here. It works in the background.

### Connecting an app, and what it can do

When you connect an AI app to the store, you choose what it is allowed to do (scoped permissions). Grant only what that app needs. Read-only for looking things up, more for recording sales or adjusting stock.

Connecting through Claude on mobile now works. If a previous mobile connection failed, try again.

