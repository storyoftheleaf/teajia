# Deploy — Multi-Store Phase 1A

Run these commands **from your local machine** (requires Cloudflare auth).

---

## Step 1 — Apply the migration

```bash
cd worker
npx wrangler d1 execute teajia-db --remote \
  --file=migrations/017_multi_account.sql
```

This creates the `accounts`, `account_members`, `tea_reviews` tables, adds `account_id` to every entity table, seeds the two accounts (`acc_teajia_bali` and `acc_teajia_australia`), backfills all existing rows to Bali, and seeds account memberships for every existing user.

**Order matters: run this before deploying the worker.**

---

## Step 2 — Deploy the worker

```bash
cd worker
npx wrangler deploy
```

---

## Step 3 — Deploy the frontend

```bash
# Root of the repo
npm run build
npx wrangler pages deploy dist --project-name teajia
```

---

## Step 4 — Provision the Australia store owner

Once the worker is live, run these from any terminal (or use curl / a REST client):

### 4a. Create the owner user (if they don't have an account yet)

```bash
curl -X POST https://<your-worker-url>/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@example.com","password":"<temp-password>","name":"Owner Name"}'
```

### 4b. Log in as Adrian to get your admin token

```bash
TOKEN=$(curl -s -X POST https://<your-worker-url>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<your-email>","password":"<your-password>"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
```

### 4c. Add the new owner as account owner

```bash
curl -X POST https://<your-worker-url>/api/accounts/acc_teajia_australia/members \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Teajia-Account: acc_teajia_bali" \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@example.com","role":"owner"}'
```

The response includes a `claim_link`. Share it with the new owner. They click it, set their password, and land in their empty Australia account.

---

## Step 5 — Spot-check after deploy

```bash
# Should return the public Bali catalog
curl https://<worker-url>/api/s/teajia-bali/products

# Should return the Australia account profile
curl https://<worker-url>/api/s/teajia-australia

# Should return both stores in the directory
curl https://<worker-url>/api/network/stores
```

---

## After deploy — note for existing users

Users who are currently logged in will get a silent 401 on their next API call (their old JWT has no `memberships` field). The app will bounce them to re-login automatically. This is expected and resolves itself in under a minute.
