-- How a tea travels home: the logistics service it ships by (Adrian, 2026-11-27).
--
-- products.freight_service_id  a logistics_services row (Suitcase, Airmail,
--   Boat, or whatever Adrian names his services), or NULL.
--
-- The rate never lives on the tea. It stays on the service, with its company,
-- priced per kilo, per cubic metre or as a fixed amount, and is edited only in
-- Logistics. A tea with a service prices its freight from the last confirmed
-- bill of a shipment it travelled in by that service, else from the service's
-- quote; see src/lib/freightSource.ts. NULL is nobody chose, and the tea keeps
-- the shop freight rate exactly as before, so no price moves until a service
-- is picked.
--
-- Schema only: a column is added and no row is written.

ALTER TABLE products ADD COLUMN freight_service_id TEXT REFERENCES logistics_services(id);
