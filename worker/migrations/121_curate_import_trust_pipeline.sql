ALTER TABLE tea_compass_entries ADD COLUMN origin_country TEXT;
ALTER TABLE tea_compass_entries ADD COLUMN classification TEXT;
ALTER TABLE tea_compass_entries ADD COLUMN description TEXT;

ALTER TABLE products ADD COLUMN classification TEXT;

ALTER TABLE curate_import_batches ADD COLUMN analysis_annotations_json TEXT;
