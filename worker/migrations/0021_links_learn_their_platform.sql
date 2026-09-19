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
-- The rule, applied per link inside every row's array:
--   - the url does not belong to a recognisable social or messaging
--     platform (instagram.com, facebook.com, twitter.com, x.com,
--     tiktok.com, t.me, wa.me, whatsapp.com, wechat.com, weixin.qq.com)
--     so it stays platform 'website', value becomes the url.
--   - otherwise it becomes platform 'other', value becomes the label the
--     row already carried, since a label like "WeChat" or "Instagram" reads
--     better on a card than a url nobody is meant to click through. No
--     qr_image_url is set by this migration; nothing in the old shape ever
--     carried one.
--
-- This split is a judgment call, not a literal reading of the plan: the
-- plan names "website-shaped urls get platform: website, everything else
-- falls to other" without defining "website-shaped" further, and no real
-- row exists yet to check the call against. Recorded in
-- todo/plans/creator-profiles-migration-preview.md with seeded before/after
-- shapes for Adrian to see before this lands, per the migration-that-moves-
-- data rule in CLAUDE.md.
--
-- Only rows whose array still has at least one entry carrying the OLD
-- `label` key are rewritten, so running this twice, or running it after a
-- row has already been written in the new shape by hand, changes nothing on
-- the second pass. A contributor with an empty links array (`[]`) is left
-- exactly as it is, because there is nothing in it to convert.

UPDATE contributors
   SET links = (
     SELECT COALESCE(json_group_array(json_object('platform', platform, 'value', link_value)), '[]')
       FROM (
         SELECT
           CASE
             WHEN json_extract(le.value, '$.url') NOT LIKE '%instagram.com%'
              AND json_extract(le.value, '$.url') NOT LIKE '%facebook.com%'
              AND json_extract(le.value, '$.url') NOT LIKE '%twitter.com%'
              AND json_extract(le.value, '$.url') NOT LIKE '%x.com%'
              AND json_extract(le.value, '$.url') NOT LIKE '%tiktok.com%'
              AND json_extract(le.value, '$.url') NOT LIKE '%t.me%'
              AND json_extract(le.value, '$.url') NOT LIKE '%wa.me%'
              AND json_extract(le.value, '$.url') NOT LIKE '%whatsapp.com%'
              AND json_extract(le.value, '$.url') NOT LIKE '%wechat.com%'
              AND json_extract(le.value, '$.url') NOT LIKE '%weixin.qq.com%'
             THEN 'website'
             ELSE 'other'
           END AS platform,
           CASE
             WHEN json_extract(le.value, '$.url') NOT LIKE '%instagram.com%'
              AND json_extract(le.value, '$.url') NOT LIKE '%facebook.com%'
              AND json_extract(le.value, '$.url') NOT LIKE '%twitter.com%'
              AND json_extract(le.value, '$.url') NOT LIKE '%x.com%'
              AND json_extract(le.value, '$.url') NOT LIKE '%tiktok.com%'
              AND json_extract(le.value, '$.url') NOT LIKE '%t.me%'
              AND json_extract(le.value, '$.url') NOT LIKE '%wa.me%'
              AND json_extract(le.value, '$.url') NOT LIKE '%whatsapp.com%'
              AND json_extract(le.value, '$.url') NOT LIKE '%wechat.com%'
              AND json_extract(le.value, '$.url') NOT LIKE '%weixin.qq.com%'
             THEN json_extract(le.value, '$.url')
             ELSE json_extract(le.value, '$.label')
           END AS link_value
         FROM json_each(contributors.links) AS le
       )
   )
 WHERE json_valid(links)
   AND EXISTS (
     SELECT 1 FROM json_each(contributors.links) AS le2
     WHERE json_extract(le2.value, '$.label') IS NOT NULL
   );
