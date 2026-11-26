import { crossShopTeaSql } from './hostTableTeas';

// The caller supplies SQL expressions for an already scoped account/event pair.
// Keep legacy menu roots visible only when the saved recap has no typed list.
export function sessionServedTeas(accountId: string, eventId: string) {
  const validLedger = `CASE WHEN json_valid(s.tea_ledger) THEN s.tea_ledger ELSE '{}' END`;
  const menuName = "COALESCE(NULLIF(trim(m.custom_name), ''), NULLIF(trim(p.given_name), ''), NULLIF(trim(p.product_name), ''))";
  return `WITH recap_ledger AS (
    SELECT json_extract(${validLedger}, '$.served_teas') AS served
    FROM event_post_session s
    WHERE s.account_id = ${accountId} AND s.event_id = ${eventId}
      AND json_type(${validLedger}, '$.served_teas') = 'array'
  ), stored_teas AS (
    SELECT CASE WHEN t.type = 'object' THEN t.value ELSE '{}' END AS tea,
           CAST(t.key AS INTEGER) AS position
    FROM recap_ledger, json_each(recap_ledger.served) t
  ), teas AS (
    SELECT json_extract(st.tea, '$.id') AS id,
           trim(json_extract(st.tea, '$.name')) AS name,
           linked.id AS product_id, st.position AS position
    FROM stored_teas st
    LEFT JOIN products linked ON linked.account_id = ${accountId}
      AND linked.id = json_extract(st.tea, '$.product_id')
      AND json_extract(st.tea, '$.source') IN ('menu', 'shop')
    WHERE json_type(st.tea, '$.id') = 'text' AND json_type(st.tea, '$.name') = 'text'
      AND length(trim(json_extract(st.tea, '$.id'))) BETWEEN 1 AND 120
      AND length(trim(json_extract(st.tea, '$.name'))) BETWEEN 1 AND 240
    UNION ALL
    SELECT m.id, ${menuName} AS name, p.id AS product_id, m.brew_order AS position
    FROM event_tea_menu m
    LEFT JOIN products p ON p.id = m.product_id AND (p.account_id = m.account_id OR ${crossShopTeaSql('p')})
    WHERE m.account_id = ${accountId} AND m.event_id = ${eventId}
      AND (m.reveal_date IS NULL OR datetime(m.reveal_date) <= datetime('now'))
      AND ${menuName} IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM recap_ledger)
  )
  SELECT id, name, product_id FROM teas ORDER BY position ASC NULLS LAST, id ASC`;
}

export function readSessionServedTeas(db: D1Database, accountId: string, eventId: string) {
  return db.prepare(sessionServedTeas('?1', '?2')).bind(accountId, eventId)
    .all<{ id: string; name: string; product_id: string | null }>();
}

export function sessionServedTeaName(photoAlias = 'p') {
  return `(SELECT tea.name
    FROM (${sessionServedTeas(`${photoAlias}.account_id`, `${photoAlias}.event_id`)}) AS tea
    WHERE tea.id = ${photoAlias}.tea_id LIMIT 1)`;
}
