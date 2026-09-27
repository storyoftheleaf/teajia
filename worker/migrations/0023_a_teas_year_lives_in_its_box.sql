-- Six teas lose the year from their names.
--
-- Adrian's rule, 2026-09-24: a tea's year belongs in the year box at the head
-- of its shop row, never in its name. The public site has hidden it since
-- 4eedfb18 (splitNameYear in src/lib/teaNameYear.ts). This makes the stored
-- record say the same thing, so the admin, invoices written from now on, and
-- the agent tools stop printing "1990 Bamboo Leaf Old Tea".
--
-- What it touches, and only this:
--   * the Bali shop (acc_teajia_bali), the one the public catalogue reads;
--   * rows whose name is EXACTLY one of the names below, read off the live
--     public catalogue on 2026-09-24, in whichever of the two name columns
--     holds it (given_name is what the shop shows, product_name the record);
--   * teas only. Teaware keeps its dates: on an antique the date is the piece.
--
-- What it leaves alone:
--   * the year column. All six already carry their year, so nothing is lost.
--   * slugs, so every link already shared keeps working.
--   * names on past invoices, tasting journals and receipts. Those are what was
--     written at the time and stay that way.
--   * any rename that would give a tea the same name as ANOTHER product in the
--     shop. That row is skipped rather than made ambiguous.
--
-- Exact matches rather than a pattern on purpose: a pattern would also reach
-- teas nobody has looked at. Six names, six teas, all read before writing.

UPDATE products SET given_name = CASE given_name
    WHEN '1990 Bamboo Leaf Old Tea' THEN 'Bamboo Leaf Old Tea'
    WHEN '2004 Yiwu Raw Puerh'      THEN 'Yiwu Raw Puerh'
    WHEN '1990 Ripe Puerh Brick'    THEN 'Ripe Puerh Brick'
    WHEN '80s Ginseng Puer'         THEN 'Ginseng Puer'
    WHEN '1998 Small Tuo'           THEN 'Small Tuo'
    WHEN '1993 Y562'                THEN 'Y562'
  END,
  updated_at = datetime('now')
WHERE account_id = 'acc_teajia_bali'
  AND type <> 'Teaware'
  AND teaware_category IS NULL
  AND given_name IN ('1990 Bamboo Leaf Old Tea', '2004 Yiwu Raw Puerh', '1990 Ripe Puerh Brick',
                     '80s Ginseng Puer', '1998 Small Tuo', '1993 Y562')
  AND NOT EXISTS (
    SELECT 1 FROM products other
    WHERE other.account_id = products.account_id
      AND other.id <> products.id
      AND (other.given_name = CASE products.given_name
             WHEN '1990 Bamboo Leaf Old Tea' THEN 'Bamboo Leaf Old Tea'
             WHEN '2004 Yiwu Raw Puerh'      THEN 'Yiwu Raw Puerh'
             WHEN '1990 Ripe Puerh Brick'    THEN 'Ripe Puerh Brick'
             WHEN '80s Ginseng Puer'         THEN 'Ginseng Puer'
             WHEN '1998 Small Tuo'           THEN 'Small Tuo'
             WHEN '1993 Y562'                THEN 'Y562'
           END
        OR other.product_name = CASE products.given_name
             WHEN '1990 Bamboo Leaf Old Tea' THEN 'Bamboo Leaf Old Tea'
             WHEN '2004 Yiwu Raw Puerh'      THEN 'Yiwu Raw Puerh'
             WHEN '1990 Ripe Puerh Brick'    THEN 'Ripe Puerh Brick'
             WHEN '80s Ginseng Puer'         THEN 'Ginseng Puer'
             WHEN '1998 Small Tuo'           THEN 'Small Tuo'
             WHEN '1993 Y562'                THEN 'Y562'
           END)
  );

UPDATE products SET product_name = CASE product_name
    WHEN '1990 Bamboo Leaf Old Tea'      THEN 'Bamboo Leaf Old Tea'
    WHEN '2004 Yiwu Raw Puerh'           THEN 'Yiwu Raw Puerh'
    WHEN '1990 Ripe Puerh Brick'         THEN 'Ripe Puerh Brick'
    WHEN '1980s Ginseng Puer'            THEN 'Ginseng Puer'
    WHEN '1998 Small Tuo'                THEN 'Small Tuo'
    WHEN '1993 Y562 (Jixing) Black Box'  THEN 'Y562 (Jixing) Black Box'
  END,
  updated_at = datetime('now')
WHERE account_id = 'acc_teajia_bali'
  AND type <> 'Teaware'
  AND teaware_category IS NULL
  AND product_name IN ('1990 Bamboo Leaf Old Tea', '2004 Yiwu Raw Puerh', '1990 Ripe Puerh Brick',
                       '1980s Ginseng Puer', '1998 Small Tuo', '1993 Y562 (Jixing) Black Box')
  AND NOT EXISTS (
    SELECT 1 FROM products other
    WHERE other.account_id = products.account_id
      AND other.id <> products.id
      AND (other.given_name = CASE products.product_name
             WHEN '1990 Bamboo Leaf Old Tea'      THEN 'Bamboo Leaf Old Tea'
             WHEN '2004 Yiwu Raw Puerh'           THEN 'Yiwu Raw Puerh'
             WHEN '1990 Ripe Puerh Brick'         THEN 'Ripe Puerh Brick'
             WHEN '1980s Ginseng Puer'            THEN 'Ginseng Puer'
             WHEN '1998 Small Tuo'                THEN 'Small Tuo'
             WHEN '1993 Y562 (Jixing) Black Box'  THEN 'Y562 (Jixing) Black Box'
           END
        OR other.product_name = CASE products.product_name
             WHEN '1990 Bamboo Leaf Old Tea'      THEN 'Bamboo Leaf Old Tea'
             WHEN '2004 Yiwu Raw Puerh'           THEN 'Yiwu Raw Puerh'
             WHEN '1990 Ripe Puerh Brick'         THEN 'Ripe Puerh Brick'
             WHEN '1980s Ginseng Puer'            THEN 'Ginseng Puer'
             WHEN '1998 Small Tuo'                THEN 'Small Tuo'
             WHEN '1993 Y562 (Jixing) Black Box'  THEN 'Y562 (Jixing) Black Box'
           END)
  );
