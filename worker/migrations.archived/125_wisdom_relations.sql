-- Editorial state and validated relations layered over the static Wisdom Base.
-- Also folds the deployed article-product compatibility table into the Worker
-- migration ledger so clean and upgraded databases converge.

CREATE TABLE IF NOT EXISTS article_products (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  article_id TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now'))
);
-- The compatibility table existed outside the Worker ledger. Keep the oldest
-- exact pair if a drifted deployment accumulated duplicates before its unique
-- index was installed, then establish the durable invariant.
DELETE FROM article_products
 WHERE rowid NOT IN (
   SELECT MIN(rowid) FROM article_products GROUP BY article_id, product_id
 );
CREATE UNIQUE INDEX IF NOT EXISTS idx_article_products_unique ON article_products(article_id, product_id);
CREATE INDEX IF NOT EXISTS idx_article_products_article ON article_products(article_id);
CREATE INDEX IF NOT EXISTS idx_article_products_product ON article_products(product_id);

CREATE TABLE IF NOT EXISTS wisdom_node_overrides (
  node_type TEXT NOT NULL,
  node_id TEXT NOT NULL,
  editorial_status TEXT NOT NULL DEFAULT 'draft' CHECK (editorial_status IN ('draft','review','approved')),
  public_state TEXT NOT NULL DEFAULT 'inherit' CHECK (public_state IN ('inherit','public','hidden')),
  editor_note TEXT,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (node_type, node_id)
);

CREATE TABLE IF NOT EXISTS wisdom_relations (
  id TEXT PRIMARY KEY,
  node_type TEXT NOT NULL,
  node_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('article','tea_profile','wisdom_node','product_tasting','promoted_tasting_note')),
  target_id TEXT NOT NULL,
  target_subtype TEXT,
  relationship_kind TEXT NOT NULL CHECK (relationship_kind IN ('supports','illustrates','mentions','is_example_of')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','exact_backfill','inferred')),
  review_status TEXT NOT NULL DEFAULT 'proposed' CHECK (review_status IN ('proposed','approved','rejected')),
  account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((target_type = 'wisdom_node' AND target_subtype IS NOT NULL) OR
         (target_type != 'wisdom_node' AND target_subtype IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_wisdom_relations_identity
  ON wisdom_relations(ifnull(account_id, '__global__'), node_type, node_id, target_type, target_id, ifnull(target_subtype, ''), relationship_kind);
CREATE INDEX IF NOT EXISTS idx_wisdom_relations_node
  ON wisdom_relations(node_type, node_id, review_status);
CREATE INDEX IF NOT EXISTS idx_wisdom_relations_target
  ON wisdom_relations(target_type, target_id, review_status);

-- Adapt only reproducible legacy article/product links: an exact canonical
-- cultivar slug and exactly one product -> tea-profile anchor. These remain
-- proposed until a platform editor approves them, preserving the publication
-- boundary while avoiding a second article/tea truth.
WITH cultivar_manifest(node_id) AS (VALUES
  ('anji-bai-cha'),('asahi'),('asatsuyu'),('ba-xian'),('bai-ji-guan'),('bai-wen'),('ban-tian-yao'),('bei-dou'),('ben-shan'),('benifuki'),('benihikari'),('bi-luo-chun-qunti'),('chin-hsin'),('cui-yu'),('da-hong-pao'),('da-ye-zhong'),('da-yeh-oolong'),('fo-shou'),('fuding-da-bai'),('goko'),('gui-hua-xiang'),('hong-yu'),('hong-yun'),('huang-guan-yin'),('huang-jin-gui'),('huangshan-qunti-zhong'),('inzatsu-131'),('jin-xuan'),('ju-duo-zai'),('kanayamidori'),('kirari-31'),('komakage'),('koshun'),('liu-an-gua-pian'),('long-jing-43'),('long-jing-qunti-zhong'),('mao-xie'),('mei-zhan'),('meiryoku'),('mengding-ganlu'),('mengku-da-ye-zhong'),('mi-lan-xiang'),('oku-yutaka'),('okuhikari'),('okumidori'),('qi-lan'),('qi-men-zhong'),('qing-xin'),('qing-xin-da-mao'),('qing-xin-gan-zhi'),('que-she'),('rou-gui'),('saemidori'),('samidori'),('shi-da-cha'),('shizu-7132'),('shui-jin-gui'),('shui-xian'),('si-ji-chun'),('sofu'),('song-zhong'),('taiwanese-wild-tea'),('takachiho'),('tie-guan-yin'),('tie-luo-han'),('tong-tian-xiang'),('ujihikari'),('wu-yi'),('wuyi-cai-cha'),('xing-ren-xiang'),('ya-shi-xiang'),('yabukita'),('ying-xiang'),('yiwu-da-ye-zhong'),('yutakamidori'),('zairai'),('zhenghe-da-bai'),('zhi-lan-xiang'),('zi-juan')
), exact_links AS (
  SELECT ap.article_id, a.account_id, pl.profile_id,
         lower(replace(replace(trim(p.cultivar), ' ', '-'), '_', '-')) AS node_id
    FROM article_products ap
    JOIN articles a ON a.id = ap.article_id
    JOIN products p ON p.id = ap.product_id AND p.account_id = a.account_id
    JOIN product_listings pl ON pl.legacy_product_id = p.id AND pl.account_id = p.account_id
    JOIN cultivar_manifest manifest
      ON manifest.node_id = lower(replace(replace(trim(p.cultivar), ' ', '-'), '_', '-'))
   WHERE (SELECT COUNT(DISTINCT anchor.profile_id) FROM product_listings anchor
           WHERE anchor.legacy_product_id = p.id AND anchor.account_id = p.account_id) = 1
)
INSERT OR IGNORE INTO wisdom_relations
  (id, node_type, node_id, target_type, target_id, target_subtype, relationship_kind,
   source, review_status, account_id, created_at, updated_at)
SELECT lower(hex(randomblob(16))), 'cultivar', node_id, 'article', article_id, NULL, 'supports',
       'exact_backfill', 'proposed', account_id, datetime('now'), datetime('now')
  FROM exact_links;

WITH cultivar_manifest(node_id) AS (VALUES
  ('anji-bai-cha'),('asahi'),('asatsuyu'),('ba-xian'),('bai-ji-guan'),('bai-wen'),('ban-tian-yao'),('bei-dou'),('ben-shan'),('benifuki'),('benihikari'),('bi-luo-chun-qunti'),('chin-hsin'),('cui-yu'),('da-hong-pao'),('da-ye-zhong'),('da-yeh-oolong'),('fo-shou'),('fuding-da-bai'),('goko'),('gui-hua-xiang'),('hong-yu'),('hong-yun'),('huang-guan-yin'),('huang-jin-gui'),('huangshan-qunti-zhong'),('inzatsu-131'),('jin-xuan'),('ju-duo-zai'),('kanayamidori'),('kirari-31'),('komakage'),('koshun'),('liu-an-gua-pian'),('long-jing-43'),('long-jing-qunti-zhong'),('mao-xie'),('mei-zhan'),('meiryoku'),('mengding-ganlu'),('mengku-da-ye-zhong'),('mi-lan-xiang'),('oku-yutaka'),('okuhikari'),('okumidori'),('qi-lan'),('qi-men-zhong'),('qing-xin'),('qing-xin-da-mao'),('qing-xin-gan-zhi'),('que-she'),('rou-gui'),('saemidori'),('samidori'),('shi-da-cha'),('shizu-7132'),('shui-jin-gui'),('shui-xian'),('si-ji-chun'),('sofu'),('song-zhong'),('taiwanese-wild-tea'),('takachiho'),('tie-guan-yin'),('tie-luo-han'),('tong-tian-xiang'),('ujihikari'),('wu-yi'),('wuyi-cai-cha'),('xing-ren-xiang'),('ya-shi-xiang'),('yabukita'),('ying-xiang'),('yiwu-da-ye-zhong'),('yutakamidori'),('zairai'),('zhenghe-da-bai'),('zhi-lan-xiang'),('zi-juan')
), exact_links AS (
  SELECT a.account_id, pl.profile_id,
         lower(replace(replace(trim(p.cultivar), ' ', '-'), '_', '-')) AS node_id
    FROM article_products ap
    JOIN articles a ON a.id = ap.article_id
    JOIN products p ON p.id = ap.product_id AND p.account_id = a.account_id
    JOIN product_listings pl ON pl.legacy_product_id = p.id AND pl.account_id = p.account_id
    JOIN cultivar_manifest manifest
      ON manifest.node_id = lower(replace(replace(trim(p.cultivar), ' ', '-'), '_', '-'))
   WHERE (SELECT COUNT(DISTINCT anchor.profile_id) FROM product_listings anchor
           WHERE anchor.legacy_product_id = p.id AND anchor.account_id = p.account_id) = 1
)
INSERT OR IGNORE INTO wisdom_relations
  (id, node_type, node_id, target_type, target_id, target_subtype, relationship_kind,
   source, review_status, account_id, created_at, updated_at)
SELECT lower(hex(randomblob(16))), 'cultivar', node_id, 'tea_profile', profile_id, NULL, 'is_example_of',
       'exact_backfill', 'proposed', account_id, datetime('now'), datetime('now')
  FROM exact_links;
