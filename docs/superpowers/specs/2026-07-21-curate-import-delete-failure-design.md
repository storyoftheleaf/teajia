# Curate Import Failure Deletion Design

## Problem

A saved import that fails during upload or AI analysis is left in the Import panel's error phase. That phase only offers **Retry import**. The existing whole-import escape action is rendered only in the Review phase, so the user must close, reopen, and rediscover the failed import before it can be removed.

## Approved behavior

- Show **Delete import** on the error screen whenever the failed attempt has a persisted batch.
- Keep **Retry import** as the recovery action.
- Require an inline confirmation before deletion.
- Use the existing server-side abandon operation: the import disappears from the incomplete-import list while its source record remains retained for audit/recovery.
- Use the same **Delete import** language and confirmation in Review so the action is consistent.
- Do not add per-source deletion or permanent R2/database deletion in this fix.

## Interaction

The destructive action sits on the left and Retry remains the action on the right. Activating **Delete import** reveals an inline confirmation with **Cancel** on the left and **Delete import** on the right. Cancel receives focus and returns focus to the initiating control. On success, the panel closes and the abandoned batch disappears from incomplete imports. API failure leaves the panel open and shows the existing retryable operation error.

## Verification

Playwright must prove that a newly persisted import which immediately enters the error phase can be deleted without closing or reopening the panel, and that the existing Review-phase behavior uses the same labels and still removes the recovery entry.
