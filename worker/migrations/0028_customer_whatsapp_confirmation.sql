-- Existing rows keep their original owner-alert meaning and are never retargeted.
ALTER TABLE order_whatsapp_outbox ADD COLUMN message_purpose TEXT NOT NULL DEFAULT 'owner_notification';
ALTER TABLE order_whatsapp_outbox ADD COLUMN recipient_number TEXT;
ALTER TABLE order_whatsapp_outbox ADD COLUMN consent_at TEXT;
