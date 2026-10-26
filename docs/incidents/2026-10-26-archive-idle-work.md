# Archive connector idle database work

The connector keeps its existing three-second idle job check and 250 ms busy cadence. Each poll still authenticates the current device, erases expired temporary originals, and atomically claims a scoped job. Revocation and lease recovery remain unchanged.

Polls no longer delete old tombstones and abandoned pairing rows; other bridge requests and the existing hourly cron still collect those rows. Heartbeats persist at most once per 30 seconds, using the freshly authenticated database row and a conditional write for concurrent polls. There is no isolate cache. The displayed last-seen timestamp now has 30-second precision; the existing two-minute connected threshold remains.

The real SQLite route test runs twenty polls at three-second intervals: 62 database operations instead of 120 (48.3% fewer), and two heartbeat writes instead of twenty (90% fewer). It then creates a job inside the heartbeat interval and proves next-poll pickup, disconnects and proves immediate rejection. A second test proves next-poll original erasure and eventual garbage collection. These are controlled test savings, not production billing.

Validation: 2,618 worker tests, 19 connector script tests, worker bundle dry run, color checks and worker typecheck ratchet pass. The latter needed existing main-branch diagnostic line references refreshed; no diagnostic was added or removed.

Production baseline: 2026-10-26 06:20:57–06:40:57 UTC, 1,746 read queries, 310 write queries, 2,628 rows read, 310 rows written. A non-LLM observer under outputs/archive-polling waits for the exact candidate and captures an equal 20-minute after window with five minutes for analytics lag. Its recorded output, not the fixture percentage above, is the production savings evidence.
