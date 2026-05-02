-- 059: Link tasting_session_teas to the products catalog.
--
-- Existing tasting_session_teas rows reference compass entries (compass_entry_id)
-- with a JSON metadata snapshot. The new in-person tasting flow ("Tasting Event")
-- needs each session tea to point at a real products.id row so verdict saves can
-- bridge into customer_tasting_journal, which is keyed on (user_id, product_id).
--
-- product_id is nullable: legacy compass-only sessions keep working. The new
-- host create flow always populates it.

ALTER TABLE tasting_session_teas ADD COLUMN product_id TEXT REFERENCES products(id);
CREATE INDEX IF NOT EXISTS idx_session_teas_product ON tasting_session_teas(product_id);
