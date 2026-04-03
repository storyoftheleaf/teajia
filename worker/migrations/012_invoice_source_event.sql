-- Add source_event_id to invoices for sales attribution
ALTER TABLE invoices ADD COLUMN source_event_id TEXT;
