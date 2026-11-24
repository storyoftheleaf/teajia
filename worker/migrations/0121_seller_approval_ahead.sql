-- Adrian can approve a person to sell before they open a Tea Chest. The
-- approval waits on the person and is copied onto their Tea Chest account the
-- moment it is created. Empty by default: nobody is approved by this file.
ALTER TABLE users ADD COLUMN seller_approved_at TEXT;
ALTER TABLE users ADD COLUMN seller_approved_by TEXT;
