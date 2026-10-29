# Logistics updates from company messages

Logistics companies do not need an API. Paste their Chinese or English message into the agent. The agent identifies the purchase or combined shipment, previews a dated update, then saves it through `record_logistics_tracking_update` after confirmation.

The compact tracking view reads the latest report's status, location and report time. History keeps the original message, the time the company reported it, when it was entered and the recording user. When the message includes a report time, record it with a timezone. Otherwise leave it unset; the screen labels the server entry time as Saved rather than inventing a company report time. An expected future arrival belongs in the delivery date, not the report timestamp. An older pasted message remains in history and does not move the current status backwards.

An update must name a particular purchase or shipment and explicitly include its currently saved tracking number (or null when none exists). A changed number or courier prevents old observations appearing against a different delivery. No company service, API token or external tracking call is used.

Retries use an account-scoped message reference (`idempotency_key`). Repeating the same message does not duplicate its event; using that reference for different content is rejected. The record is checked for account ownership and matching tracking identity again in the database write, not just before preview.

“Delivered” in a company message is only a report. Marking a parcel arrived at logistics or verifying studio receipt remains a separate explicit action; the update service never writes inventory, receipt quantities, shipment state or freight charges. This prevents a courier's delivery scan from claiming that studio stock has been checked.

Storage: migration `0054_logistics_tracking.sql`; service: `worker/src/logisticsTracking.ts`; shared shape: `src/lib/logisticsTrackingUpdate.ts`. All stored reports remain available in the history returned with the current tracking identity. Changing a number preserves previous records in storage but excludes them from the new delivery's current history.
