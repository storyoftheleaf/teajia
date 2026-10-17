-- An arrival that is ordered and an arrival that is on the way are not the
-- same fact, and the table had nowhere to say which.
--
-- `curate_receipt_proposals` is the shop's incoming shelf: a row waits there
-- until somebody approves it into stock. Until now every row was written by
-- `curate_order`, where the answer was always "ordered", so nothing needed the
-- column. Entering a tea directly (curate_add_tea with a bought quantity) can
-- say either, and a tea Adrian has already paid for but not yet shipped reads
-- differently to one in a courier's van. Adrian's rule: if a fact has no
-- field, add the field, never a note.
--
-- NULL means nobody said, which is what every existing row honestly is: the
-- order rows predate the question. Readers fall back to their own wording
-- rather than inventing a state.
--
-- Schema only: no row is written, and there is no default.

ALTER TABLE curate_receipt_proposals ADD COLUMN acquisition_state TEXT
  CHECK (acquisition_state IS NULL OR acquisition_state IN ('ordered', 'in_transit', 'received'));
