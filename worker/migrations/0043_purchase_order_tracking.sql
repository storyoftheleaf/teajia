-- In process (plan todo/plans/samples-to-orders.md, build 4): a placed purchase
-- order is followed by supplier and route through Placed, Sent, Shipped and
-- Received, and carries the carrier's tracking number once there is one.
--
--   ship_mode        'air' or 'sea', the route this order travels by. The buying
--                    basket places one order per supplier per route, so a parcel
--                    and its tracking number belong to one order. NULL is an
--                    order placed before routes existed, or from another door.
--   tracking_number  as the carrier or forwarder wrote it. Set by hand in the app
--                    or by an agent (set_order_tracking). NULL is none yet.
--
-- status keeps its existing words (confirmed, sent, received, cancelled) and
-- gains 'shipped'. There is no CHECK on it today and none is added here, so
-- older rows and other doors keep working.
--
-- Schema only: no row is written, no default is set.

ALTER TABLE purchase_orders ADD COLUMN ship_mode TEXT CHECK (ship_mode IS NULL OR ship_mode IN ('air', 'sea'));
ALTER TABLE purchase_orders ADD COLUMN tracking_number TEXT;
