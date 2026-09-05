-- The shop's freight rate becomes a setting, quoted in the currency it is paid in.
--
-- Until now the default lived in code as 12 USD/kg. That was already an
-- improvement on the four conflicting numbers it replaced, but it is still the
-- wrong shape twice over. Adrian pays his forwarder in yuan, so a dollar figure
-- is a translation of the real number rather than the number; and changing it
-- when he negotiates a better rate meant a code edit and a deploy, which means
-- in practice it does not get changed.
--
-- So: 85 CNY per kilo, held on the account, converted to USD live like every
-- other cost in the shop. A better rate is now a field in Store Settings.
--
-- NULL is not "free" here either. It means this shop has never set one, and the
-- code fallback applies. Only the platform seed below writes a number, because
-- a shop that has not thought about freight should still charge for it.

ALTER TABLE accounts ADD COLUMN default_shipping_rate_per_kg REAL;
ALTER TABLE accounts ADD COLUMN default_shipping_rate_currency TEXT;

-- 85 CNY/kg is 12 USD/kg at 7.1, which is what every tea was already paying.
-- Written to every existing shop so nothing changes price on the day of this
-- migration; what changes is where the number lives and who can edit it.
UPDATE accounts
   SET default_shipping_rate_per_kg = 85,
       default_shipping_rate_currency = 'Yuan'
 WHERE default_shipping_rate_per_kg IS NULL;
