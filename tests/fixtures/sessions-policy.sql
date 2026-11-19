-- Disposable local D1 fixtures only. Seed a fresh offline fixture database first.
UPDATE accounts SET public_enabled=1 WHERE id='acc_teajia_bali';
INSERT INTO users (id,email,username,name,password_hash,role,email_verified_at)
VALUES ('policy-member','member@test.invalid','member','Fixture member','b7ad567477c83756aab9a542b2be04f77dbae25115d85f22070d74d8cc4779dc','user','2026-11-19'),
       ('policy-peer','peer@test.invalid','peer','Fixture peer','b7ad567477c83756aab9a542b2be04f77dbae25115d85f22070d74d8cc4779dc','user','2026-11-19');
INSERT INTO account_members (id,account_id,user_id,role,status,permissions)
VALUES ('policy-member-bali','acc_teajia_bali','policy-member','viewer','active','{"bundles":[]}'),
       ('policy-member-au','acc_teajia_australia','policy-member','viewer','active','{"bundles":[]}'),
       ('policy-peer-bali','acc_teajia_bali','policy-peer','viewer','active','{"bundles":[]}');
INSERT INTO events (id,account_id,slug,title,event_date,total_capacity,status,lifecycle_status,public_visibility,recap_status)
VALUES ('policy-event','acc_teajia_bali','policy-evening','Fixture Tea Evening','2026-11-19',10,'closed','registration_closed','public','draft'),
       ('policy-legacy','acc_teajia_bali','policy-legacy','Legacy Evening','2026-11-18',10,'closed','completed','public','published');
INSERT INTO event_attendees (id,account_id,event_id,full_name,email,magic_token,status,attended)
VALUES ('policy-attendee','acc_teajia_bali','policy-event','Fixture member','member@test.invalid','policy-attendee-token','confirmed',1),
       ('policy-no-show','acc_teajia_bali','policy-event','Fixture peer','peer@test.invalid','policy-no-show-token','confirmed',0);
INSERT INTO event_post_session (id,account_id,event_id,session_notes,host_notes)
VALUES ('policy-draft','acc_teajia_bali','policy-event','Original host draft','Private host observation'),
       ('policy-legacy-recap','acc_teajia_bali','policy-legacy','Legacy published recap','Private legacy host');
INSERT INTO products (id,account_id,type,product_name,cost_amount,cost_currency)
VALUES ('policy-tea','acc_teajia_bali','Oolong','Fixture Oolong',0,'Yuan');
INSERT INTO tea_compass_entries (id,user_id,account_id,name,status)
VALUES ('policy-source','sandbox-operator','acc_teajia_bali','Shared tea reference','in_stock');
INSERT INTO tea_compass_entries (id,user_id,account_id,name,status,source_entry_id,source_invoice_id,source_invoice_line_id)
VALUES ('policy-purchase','policy-member','acc_teajia_bali','Purchased fixture tea','available_to_taste','policy-source','fixture-invoice','fixture-line');
INSERT INTO compass_shares(id,source_entry_id,source_account_id,source_user_id,source_user_name,shared_metadata,invite_token)
VALUES ('policy-share','policy-source','acc_teajia_bali','sandbox-operator','Sandbox host','{"name":"Shared tea reference","type":"Oolong","year":2024}','policy-invite');
