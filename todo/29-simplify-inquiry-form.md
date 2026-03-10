# T2-09: Simplify Consultation Inquiry Form

**Status:** [ ] Not started
**Priority:** High
**Group:** D (Content & Navigation)
**Files:** `src/components/consult/InquiryForm.tsx`, `src/components/GuidanceInquiryModal.tsx`

## Problem
The consultation inquiry form has 7+ fields for initial contact. Mobile users abandon long forms. First contact should require minimal commitment.

## Requirements
- Reduce initial form to 3 essential fields: Name, Email, Message
- Move optional fields (WhatsApp, interests, location, referral) to a "Tell us more (optional)" expandable section
- Pre-select service type if user clicked from a specific service section
- Keep the thank-you confirmation

## Implementation Notes
- InquiryForm.tsx has floating-label inputs with validation
- GuidanceInquiryModal.tsx has service-type-specific conditional fields
- Keep the conditional fields but make them optional/deferred
- Consider a 2-step approach: Step 1 (required 3 fields) → Step 2 (optional details, skippable)

## Acceptance Criteria
- [ ] Initial form shows only Name, Email, Message
- [ ] Optional fields are expandable/collapsible
- [ ] Form submits successfully with just the 3 required fields
- [ ] Service type pre-selected when navigated from specific service
