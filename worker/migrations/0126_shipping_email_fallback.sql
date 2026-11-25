-- A customer who chose WhatsApp but also gave an email is told by email when
-- WhatsApp cannot carry the message (not approved, not set up, unavailable).
-- The notice records which way it actually went. Empty by default.
ALTER TABLE order_shipping_notification_targets ADD COLUMN fallback_email TEXT;
ALTER TABLE shipping_payment_notifications ADD COLUMN sent_channel TEXT;
