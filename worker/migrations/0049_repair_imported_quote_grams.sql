-- Three reviewed Huang Wei source messages each quote 500g. The old importer
-- stored money/g in the gram denominator. Repair only the exact known bad
-- values; preserve any subsequent human edits and every original CNY quote.
UPDATE tea_compass_entries SET price_per_unit_grams = 500
WHERE account_id = 'acc_teajia_bali'
  AND price_currency IN ('Yuan', 'CNY')
  AND ((id = '61872940-568f-4166-9622-26f607ea3986' AND price_amount = 380 AND price_per_unit_grams = 0.76)
    OR (id = 'fb3cf23f-0aa6-4f1d-aa2d-181f0fe2b83c' AND price_amount = 400 AND price_per_unit_grams = 0.8)
    OR (id = 'bf5b8052-0630-49b0-a73c-23ebefe67fc2' AND price_amount = 280 AND price_per_unit_grams = 0.56));
