-- The Almedia workspace renders every amount in one currency (see
-- ALMEDIA_CURRENCY in the web app). The column default said EUR while the
-- billing view rendered dollars, so a hand-typed booking could disagree with
-- the figures it was compared against.
--
-- Existing rows are moved too: the values were never converted, only labelled,
-- so relabelling them is the whole change. Nothing is multiplied by a rate.
ALTER TABLE "bookings" ALTER COLUMN "currency" SET DEFAULT 'USD';

UPDATE "bookings" SET "currency" = 'USD' WHERE "currency" = 'EUR';
