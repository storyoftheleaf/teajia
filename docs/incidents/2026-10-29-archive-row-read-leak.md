# Archive idle polls scanned retained jobs

The D1 daily row-read warning was traced to the archive connector's expiry and claim statements. Cloudflare query statistics showed about 5.31 million rows read by expiry and 4.72 million by claim over the preceding 24 hours. The 26 October reduction in database operation and heartbeat-write counts did not cover scan cost as queue history accumulated.

Migration 0051 adds two partial indexes. Expiry visits only jobs not already expired, preserving next-request removal of temporary originals. The claim index contains only pending or claimed jobs, in account/person/creation order. The claim query explicitly states the same status predicate so SQLite can select that index. Completed results retained until expiry and expired tombstones retained until garbage collection no longer enlarge idle claim work. The temporary incident index over all recent jobs is removed because it still visits completed unexpired results.

The connector's existing three-second pickup, authentication on every request, lease recovery, immediate revocation, one-hour original expiry and tombstone retention remain unchanged. No data is deleted by the migration.

Verification: `curate-ar-read-budget.test.ts` captures the actual two job UPDATE statements from `handleArBridge`, executes them in real SQLite against 1,000 expired plus 1,000 completed-unexpired jobs, and repeats with ten times that history. It asserts both selected indexes, tenant/person isolation and bounded VM work. The indexed fixture executes 63 SQLite VM instructions at both sizes, compared with 5,079 without the new indexes at the smaller size (using the final explicit-status query). These are controlled fixture instruction counts, not Cloudflare billed-row measurements. The bridge behavioral suite runs with migration 0051 and verifies job pickup, cross-account isolation, lease/replay handling, revocation and exact temporary-result expiry. The two focused files pass 20 tests.

Live application and live billed-row proof are recorded separately by the incident operator; source preparation alone does not establish production deployment.
