# Your Table Account Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the global owner “Operating as” banner and show the active account beneath the Your Table title.

**Architecture:** `AdminApp` will stop rendering global account context. `AccountPanel` will derive the active account name from direct membership or hydrated account state and use the existing account endpoint only when a platform-operated account has no local name. The existing switcher remains unchanged.

**Tech Stack:** React 19, TypeScript, React Query, Zustand, Playwright, Tailwind CSS-variable tokens

---

## File Structure

- Modify `tests/admin-header-switcher.spec.ts`: cover a platform owner operating a non-member account, assert the global banner is absent, and assert Your Table contains the account context.
- Modify `src/admin/AdminApp.tsx`: remove `OperatingAsBanner` and its now-unused state, handlers, and icon imports.
- Modify `src/components/AccountPanel/index.tsx`: resolve the active account name and render it under the main Your Table heading.

### Task 1: Add the account-context regression

**Files:**
- Modify: `tests/admin-header-switcher.spec.ts`

- [ ] **Step 1: Extend the API mock for account detail**

Add this branch before the catch-all response:

```ts
if (url.endsWith(`/api/accounts/${AUS_ID}`) && method === 'GET') {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      id: AUS_ID,
      name: 'Teajia Australia',
      slug: 'teajia-australia',
      location_city: '',
      currency_default: 'AUD',
    }),
  });
}
```

- [ ] **Step 2: Write the failing behavior test**

```ts
test('keeps operated-account context inside Your Table', async ({ page, context }) => {
  test.skip(!process.env.ADMIN_TEST_URL, 'needs an API-configured admin server (set ADMIN_TEST_URL)');

  await mockApi(context);
  await injectAuth(page, AUS_ID);

  const base = process.env.ADMIN_TEST_URL || '';
  await page.goto(`${base}/admin`, { waitUntil: 'domcontentloaded' });

  await expect(page.getByText(/every action is logged and visible to the account owner/i)).toHaveCount(0);

  await page.locator('button[aria-label="Your Table"]').first().click();
  await expect(page.getByText('Logged in to Teajia Australia')).toBeVisible();
});
```

- [ ] **Step 3: Run the test and verify red**

Run an API-configured Vite server on port 7788, then:

```bash
ADMIN_TEST_URL=http://localhost:7788 npx playwright test tests/admin-header-switcher.spec.ts --project='Desktop Chrome' --grep='keeps operated-account context' --reporter=list
```

Expected: FAIL because the global banner is visible and the Your Table account line does not exist.

### Task 2: Move account context into Your Table

**Files:**
- Modify: `src/admin/AdminApp.tsx`
- Modify: `src/components/AccountPanel/index.tsx`

- [ ] **Step 1: Remove the global banner**

Delete the `OperatingAsBanner` component, the `ShieldCheck` and `ArrowLeft` imports used only by it, `isOperatingAs`, `operatingAsName`, `handleReturnHome`, and the conditional `<OperatingAsBanner />` render. Keep account switching and audit behavior intact.

- [ ] **Step 2: Resolve the active account name in AccountPanel**

After the existing `activeMembership` derivation, use local state first and query only when needed:

```ts
const localAccountContextName =
  activeMembership?.account_name ||
  (activeAccount?.id === activeAccountId ? activeAccount.name : null);

const { data: accountContext } = useQuery({
  queryKey: ['panel-account-context', activeAccountId],
  queryFn: () => api.accounts.get(activeAccountId!),
  enabled: auth.isAuthenticated && !!activeAccountId && !localAccountContextName,
  staleTime: 1000 * 60 * 5,
  retry: false,
});

const accountContextName = localAccountContextName || accountContext?.name || null;
```

- [ ] **Step 3: Render the context beneath Your Table**

Replace the single centered heading with a centered wrapper. Only the main view receives the second line:

```tsx
<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[60%] text-center">
  <h2 className="h3 truncate">{headerTitle}</h2>
  {!isSubView && (
    <p className="text-ui-10 text-tea-text-sec truncate mt-0.5">
      {accountContextName ? `Logged in to ${accountContextName}` : 'Logged in to your account'}
    </p>
  )}
</div>
```

- [ ] **Step 4: Run the focused test and verify green**

```bash
ADMIN_TEST_URL=http://localhost:7788 npx playwright test tests/admin-header-switcher.spec.ts --project='Desktop Chrome' --grep='keeps operated-account context' --reporter=list
```

Expected: PASS.

### Task 3: Verify the integrated change

**Files:**
- Verify: `src/admin/AdminApp.tsx`
- Verify: `src/components/AccountPanel/index.tsx`
- Verify: `tests/admin-header-switcher.spec.ts`

- [ ] **Step 1: Run static checks**

```bash
npm run lint
npm run lint:colors
```

Expected: both commands exit 0.

- [ ] **Step 2: Run the required account-panel mobile suite**

```bash
npm run test:mobile
```

Expected: all account-panel mobile tests pass without horizontal overflow or console errors.

- [ ] **Step 3: Confirm the removed copy is absent from production code**

```bash
rg -n "OperatingAsBanner|every action is logged and visible to the account owner" src
```

Expected: no matches.

- [ ] **Step 4: Commit the implementation**

```bash
git add src/admin/AdminApp.tsx src/components/AccountPanel/index.tsx tests/admin-header-switcher.spec.ts
git commit -m "fix: keep account context inside Your Table"
```
