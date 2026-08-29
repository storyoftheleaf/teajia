-- Vendors are stored as customers. The storefront photo, business-card photo,
-- and map location captured in Curate (VendorStrip) had nowhere to persist:
-- the columns never existed and handleUpdateCustomer's allow-list dropped them,
-- so an uploaded storefront photo + GPS pin vanished on the next reload.
-- These four columns give them a home; handleUpdateCustomer now allows them too.
ALTER TABLE customers ADD COLUMN business_card_photo TEXT;
ALTER TABLE customers ADD COLUMN storefront_photo TEXT;
ALTER TABLE customers ADD COLUMN latitude REAL;
ALTER TABLE customers ADD COLUMN longitude REAL;
