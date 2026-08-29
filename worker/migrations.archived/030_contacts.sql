-- Add structured contacts column to customers table
ALTER TABLE customers ADD COLUMN contacts TEXT NOT NULL DEFAULT '[]';

-- Migrate existing phone, whatsapp, email into the new contacts array
UPDATE customers SET contacts = COALESCE((
  SELECT json_group_array(v)
  FROM (
    SELECT json_object('channel', 'phone', 'handle', phone) AS v
    WHERE phone IS NOT NULL
    UNION ALL
    SELECT json_object('channel', 'whatsapp', 'handle', whatsapp)
    WHERE whatsapp IS NOT NULL
    UNION ALL
    SELECT json_object('channel', 'email', 'handle', email)
    WHERE email IS NOT NULL
  )
), '[]');
