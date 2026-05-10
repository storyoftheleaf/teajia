# Australia Launch Playbook

Use this when bringing Teajia Australia live for the first time. The in-app Launch Center at `/admin/account-settings` is the source of truth during launch. This document explains what each step means and what "ready" looks like.

## Goal

Australia is ready when a first-time customer can open `/store/teajia-australia`, understand the store, see at least one available tea or ware, and start a WhatsApp or email order with the Australia operator.

## Before the owner logs in

1. Confirm `acc_teajia_australia` exists.
2. Confirm the slug is `teajia-australia`.
3. Confirm currency is `AUD`.
4. Invite the owner from Platform Admin or `/admin/access`.
5. Send the invite link if email delivery is not configured.

## Owner first session

1. Open the invite link.
2. Set password.
3. Sign in.
4. Confirm the active account badge says Teajia Australia.
5. Open `/admin/account-settings`.
6. Work through Launch Center from top to bottom.

## Launch Center steps

### 1. Account

Required:
- Store name
- Tagline
- Short description
- Country
- Timezone
- Default currency
- WhatsApp number or contact email
- Public shop enabled

Quality bar:
- Tagline should explain the table in one sentence.
- Description should say what the store carries, where it is based, and how visitors should make contact.
- WhatsApp should include the country code.

### 2. Team

Required:
- At least one owner.
- Staff members should not sit with no bundles unless they are intentionally observing.
- Pending invites should be visible until accepted.

Recommended presets:
- Sales: customer/order work.
- Inventory: products and stock.
- Events: gatherings and guests.
- Manager: daily operations without access management.
- Access manager: full operations, including inviting others.

### 3. Inventory

Required:
- At least one active product.
- At least one public, priced, stocked product.
- Product name, type, and public/private state checked.

Recommended before launch:
- Every public product has an image.
- Every public product has a usable description.
- Every tea has type, origin, year when known, stock, and price.

### 4. Storefront

Required:
- `/store/teajia-australia` opens.
- No horizontal overflow on mobile.
- Public products show.
- Contact path exists.

Check this on a phone before sharing the link.

### 5. First sale rehearsal

Run one test order before the first real customer:
1. Open storefront.
2. Add a product to cart.
3. Generate the WhatsApp message.
4. Confirm it routes to Australia.
5. Record or simulate the order.
6. Confirm stock behavior is understood.

### 6. First event

Optional for store launch, but useful before the first gathering:
1. Create a simple event.
2. Add date, location, capacity, and tea menu.
3. Open the RSVP page.
4. Test attendee approval and check-in.

## Go-live check

Before sharing the link externally:
- Launch Center has no blocking account, inventory, or storefront gaps.
- Owner understands WhatsApp checkout.
- Staff access is deliberately granted.
- Opening stock is backed up as CSV.
- Storefront has been opened on desktop and mobile.

