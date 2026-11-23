-- A photo of the vendor's face, so Adrian can find a vendor he remembers by
-- face when he has forgotten the name or the shop (Adrian, 2026-11-23: "a lot
-- of times maybe I don't know the vendor name or the shop name, but I remember
-- the face").
--
-- It sits beside the two photos a vendor already has (storefront_photo,
-- business_card_photo) on the customers row tagged vendor, and holds the same
-- kind of value: the URL that /api/upload-image returned. Owner-tier back
-- office, never on the storefront.
--
-- Schema only: no row is written. NULL means no face photo yet, and the vendor
-- faces fall back to the storefront photo, then the business card, then the
-- vendor's initials.

ALTER TABLE customers ADD COLUMN face_photo TEXT;
