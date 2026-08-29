-- Add ref_number column to inquiries so PublicCart can store the customer-facing
-- order reference and OrderStatusPage can look it up via GET /api/inquiries/:ref.
ALTER TABLE inquiries ADD COLUMN ref_number TEXT;
CREATE INDEX IF NOT EXISTS idx_inquiries_ref_number ON inquiries(ref_number);
