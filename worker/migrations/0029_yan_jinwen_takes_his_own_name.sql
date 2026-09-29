-- The porcelain restorer in Porcelain and Tea is Yan Jinwen (严金文). His
-- profile was created as "Shangyin Qiwu 上隐器物", a mistranslation of his
-- studio's name (缮隐漆物, Shanyin Qiwu, Shanyin Lacquerware), and its page
-- address was cut from that name. This moves the one profile to
-- /people/yan-jinwen under his own name; the app redirects the old address
-- (src/pages/renamedPeople.tsx). Approved by Adrian 2026-09-29.
--
-- A profile's id IS its page address, and a dozen columns point at it. The
-- row is renamed in place rather than copied, because a copy has to list every
-- column and the live table is not guaranteed to hold exactly the columns
-- schema.sql lists. Foreign keys are deferred to the end of the migration so
-- the profile and what points at it can move in any order; nothing is
-- deleted, so no ON DELETE CASCADE can fire.
--
-- Every statement is guarded: nothing moves unless 'shangyin-qiwu' exists and
-- 'yan-jinwen' does not, so a second run changes nothing. The profile itself
-- moves last, because its presence is what every guard reads.
--
-- Left alone on purpose: payment_method_audit_events (immutable by trigger;
-- history keeps the id it was written with) and activity logs (history).
-- Proven against seeded rows by worker/tests/yan-jinwen-migration.test.ts.

PRAGMA defer_foreign_keys = ON;

UPDATE contributor_accounts SET contributor_id = 'yan-jinwen'
 WHERE contributor_id = 'shangyin-qiwu'
   AND EXISTS (SELECT 1 FROM contributors WHERE id = 'shangyin-qiwu')
   AND NOT EXISTS (SELECT 1 FROM contributors WHERE id = 'yan-jinwen');

UPDATE event_contributors SET contributor_id = 'yan-jinwen'
 WHERE contributor_id = 'shangyin-qiwu'
   AND EXISTS (SELECT 1 FROM contributors WHERE id = 'shangyin-qiwu')
   AND NOT EXISTS (SELECT 1 FROM contributors WHERE id = 'yan-jinwen');

UPDATE contributor_profile_drafts SET contributor_id = 'yan-jinwen'
 WHERE contributor_id = 'shangyin-qiwu'
   AND EXISTS (SELECT 1 FROM contributors WHERE id = 'shangyin-qiwu')
   AND NOT EXISTS (SELECT 1 FROM contributors WHERE id = 'yan-jinwen');

UPDATE profile_favorites SET contributor_id = 'yan-jinwen'
 WHERE contributor_id = 'shangyin-qiwu'
   AND EXISTS (SELECT 1 FROM contributors WHERE id = 'shangyin-qiwu')
   AND NOT EXISTS (SELECT 1 FROM contributors WHERE id = 'yan-jinwen');

UPDATE contributor_gallery_images SET contributor_id = 'yan-jinwen'
 WHERE contributor_id = 'shangyin-qiwu'
   AND EXISTS (SELECT 1 FROM contributors WHERE id = 'shangyin-qiwu')
   AND NOT EXISTS (SELECT 1 FROM contributors WHERE id = 'yan-jinwen');

UPDATE payment_methods SET contributor_id = 'yan-jinwen'
 WHERE contributor_id = 'shangyin-qiwu'
   AND EXISTS (SELECT 1 FROM contributors WHERE id = 'shangyin-qiwu')
   AND NOT EXISTS (SELECT 1 FROM contributors WHERE id = 'yan-jinwen');

UPDATE payment_access_grants SET contributor_id = 'yan-jinwen'
 WHERE contributor_id = 'shangyin-qiwu'
   AND EXISTS (SELECT 1 FROM contributors WHERE id = 'shangyin-qiwu')
   AND NOT EXISTS (SELECT 1 FROM contributors WHERE id = 'yan-jinwen');

UPDATE payment_share_links SET contributor_id = 'yan-jinwen'
 WHERE contributor_id = 'shangyin-qiwu'
   AND EXISTS (SELECT 1 FROM contributors WHERE id = 'shangyin-qiwu')
   AND NOT EXISTS (SELECT 1 FROM contributors WHERE id = 'yan-jinwen');

UPDATE contributor_user_link_conflicts SET contributor_id = 'yan-jinwen'
 WHERE contributor_id = 'shangyin-qiwu'
   AND EXISTS (SELECT 1 FROM contributors WHERE id = 'shangyin-qiwu')
   AND NOT EXISTS (SELECT 1 FROM contributors WHERE id = 'yan-jinwen');

UPDATE contributor_user_link_conflicts SET kept_contributor_id = 'yan-jinwen'
 WHERE kept_contributor_id = 'shangyin-qiwu'
   AND EXISTS (SELECT 1 FROM contributors WHERE id = 'shangyin-qiwu')
   AND NOT EXISTS (SELECT 1 FROM contributors WHERE id = 'yan-jinwen');

UPDATE accounts SET host_contributor_id = 'yan-jinwen'
 WHERE host_contributor_id = 'shangyin-qiwu'
   AND EXISTS (SELECT 1 FROM contributors WHERE id = 'shangyin-qiwu')
   AND NOT EXISTS (SELECT 1 FROM contributors WHERE id = 'yan-jinwen');

UPDATE articles SET author_id = 'yan-jinwen'
 WHERE author_id = 'shangyin-qiwu'
   AND EXISTS (SELECT 1 FROM contributors WHERE id = 'shangyin-qiwu')
   AND NOT EXISTS (SELECT 1 FROM contributors WHERE id = 'yan-jinwen');

UPDATE articles SET pull_quote_subject = 'yan-jinwen'
 WHERE pull_quote_subject = 'shangyin-qiwu'
   AND EXISTS (SELECT 1 FROM contributors WHERE id = 'shangyin-qiwu')
   AND NOT EXISTS (SELECT 1 FROM contributors WHERE id = 'yan-jinwen');

UPDATE collection_publications SET target_id = 'yan-jinwen'
 WHERE target_type = 'person' AND target_id = 'shangyin-qiwu'
   AND EXISTS (SELECT 1 FROM contributors WHERE id = 'shangyin-qiwu')
   AND NOT EXISTS (SELECT 1 FROM contributors WHERE id = 'yan-jinwen');

-- subject_ids is a JSON array of ids: rewrite the one element, keep the order.
UPDATE articles SET subject_ids = (
    SELECT json_group_array(CASE WHEN value = 'shangyin-qiwu' THEN 'yan-jinwen' ELSE value END)
      FROM (SELECT value FROM json_each(articles.subject_ids) ORDER BY key)
  )
 WHERE EXISTS (SELECT 1 FROM json_each(COALESCE(articles.subject_ids, '[]')) WHERE value = 'shangyin-qiwu')
   AND EXISTS (SELECT 1 FROM contributors WHERE id = 'shangyin-qiwu')
   AND NOT EXISTS (SELECT 1 FROM contributors WHERE id = 'yan-jinwen');

UPDATE contributors
   SET id = 'yan-jinwen',
       display_name = 'Yan Jinwen',
       chinese_name = '严金文',
       updated_at = datetime('now')
 WHERE id = 'shangyin-qiwu'
   AND NOT EXISTS (SELECT 1 FROM contributors WHERE id = 'yan-jinwen');
