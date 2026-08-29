-- 079_invoice_source_collection.sql
-- Back-reference from a draft invoice to the collection share that triggered it.
--
-- When a collection-link recipient confirms their picks, handleConfirmCollectionPicks
-- creates a Draft invoice. These two columns record which collection and which
-- publication (share link) originated it, so the operator can see the provenance in
-- the Orders view without reading the free-text notes field.
--
-- Both columns are nullable: all existing invoices stay valid and simply read as
-- "not from a collection share".

ALTER TABLE invoices ADD COLUMN source_collection_id TEXT;
ALTER TABLE invoices ADD COLUMN source_publication_id TEXT;
