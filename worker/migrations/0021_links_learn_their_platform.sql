-- contributors.links has been a flat list of {label, url} pairs. The
-- creator-profiles design wants a typed list instead: {platform, value,
-- qr_image_url?} where platform is one of wechat, instagram, website,
-- other, because a WeChat ID is not a website and a QR image only ever
-- belongs to a WeChat entry.
--
-- No production contributor is known to have a published profile yet.
-- is_published defaults to 0 and the public writer path for links has not
-- shipped, so this backfill has nothing real to get wrong. It is written
-- anyway rather than assuming the table is empty, because "nothing found"
-- and "nobody looked" are different claims and only running the migration
-- checks which one is true.
--
-- The rule, applied per link inside every row's array. A migration must
-- never drop an address, so both branches keep the url:
--   - the url does not belong to a recognisable social or messaging
--     platform (instagram.com, facebook.com, twitter.com, x.com,
--     tiktok.com, t.me, wa.me, whatsapp.com, wechat.com, weixin.qq.com)
--     so it becomes platform 'website', value is the url.
--   - otherwise it becomes platform 'other', value is STILL the url (the
--     address is never dropped), and the row's old label, if it had one,
--     rides along as an optional 'label' field on the same object, since
--     "WeChat" or "Instagram" reads better on a card than the raw address.
--     No qr_image_url is set by this migration; nothing in the old shape
--     ever carried one.
--
-- The website/other split is a judgment call, not a literal reading of the
-- plan: the plan names "website-shaped urls get platform: website,
-- everything else falls to other" without defining "website-shaped"
-- further, and no real row exists yet to check the call against. Recorded
-- in todo/plans/creator-profiles-migration-preview.md with seeded
-- before/after shapes for Adrian to see before this lands, per the
-- migration-that-moves-data rule in CLAUDE.md.
--
-- Idempotent by the presence of the OLD 'url' key, not the label: a row
-- already in the new shape never carries a top-level 'url' (only
-- 'platform' and 'value', with an optional 'label'), so running this twice,
-- or running it after a row has been hand-written in the new shape, changes
-- nothing on the second pass. A contributor with an empty links array
-- (`[]`) is left exactly as it is, because there is nothing in it to
-- convert.

UPDATE contributors
   SET links = (
     SELECT COALESCE(json_group_array(
       CASE
         WHEN is_website THEN json_object('platform', 'website', 'value', url)
         WHEN label IS NOT NULL AND label <> '' THEN json_object('platform', 'other', 'value', url, 'label', label)
         ELSE json_object('platform', 'other', 'value', url)
       END
     ), '[]')
       FROM (
         SELECT
           json_extract(le.value, '$.url') AS url,
           json_extract(le.value, '$.label') AS label,
           (
             json_extract(le.value, '$.url') NOT LIKE '%instagram.com%'
             AND json_extract(le.value, '$.url') NOT LIKE '%facebook.com%'
             AND json_extract(le.value, '$.url') NOT LIKE '%twitter.com%'
             AND json_extract(le.value, '$.url') NOT LIKE '%x.com%'
             AND json_extract(le.value, '$.url') NOT LIKE '%tiktok.com%'
             AND json_extract(le.value, '$.url') NOT LIKE '%t.me%'
             AND json_extract(le.value, '$.url') NOT LIKE '%wa.me%'
             AND json_extract(le.value, '$.url') NOT LIKE '%whatsapp.com%'
             AND json_extract(le.value, '$.url') NOT LIKE '%wechat.com%'
             AND json_extract(le.value, '$.url') NOT LIKE '%weixin.qq.com%'
           ) AS is_website
         FROM json_each(contributors.links) AS le
       )
   )
 WHERE json_valid(links)
   AND EXISTS (
     SELECT 1 FROM json_each(contributors.links) AS le2
     WHERE json_extract(le2.value, '$.url') IS NOT NULL
   );
