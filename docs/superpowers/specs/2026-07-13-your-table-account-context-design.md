# Your Table Account Context

## Goal

Remove the global “Operating as” notice from admin pages. Keep the current account visible only inside Your Table, directly beneath its title.

## Interface

- The admin shell no longer renders `OperatingAsBanner`, including when a platform owner operates an account they do not directly belong to.
- The Your Table header shows a quiet line reading `Logged in to <account name>` for every authenticated account context, including users with one account.
- The existing account switcher remains available below the header when the user can switch accounts.
- No navigation, routing, account-switching, authorization, or audit behavior changes.

## Data Flow

The Your Table panel resolves the active account name from the authenticated membership state when possible. If a platform owner is operating a non-member account, it resolves that active account through the existing account API. While that name is unavailable, the interface uses a neutral account-context fallback rather than showing an incorrect membership name.

## Verification

- A regression test asserts that the global “Operating as” notice is absent from the admin shell.
- Account-panel coverage asserts that `Logged in to <account name>` appears beneath Your Table for a single-account owner.
- Existing multi-account switching remains covered by its current tests.
- Run TypeScript lint, color-token lint, and the relevant mobile Playwright tests because this changes `src/components/AccountPanel/`.
