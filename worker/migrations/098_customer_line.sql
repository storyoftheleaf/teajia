-- LINE contact handle for customers/vendors. The Compass vendor strip has
-- collected `line` alongside phone/whatsapp/wechat since 097, but the column
-- never existed and the PUT allow-list dropped it silently — every LINE handle
-- typed at a tea fair was lost.
ALTER TABLE customers ADD COLUMN line TEXT;
