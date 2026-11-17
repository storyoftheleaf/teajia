-- The consolidated schema omitted the guard from archived migration 127.
-- A negative hold is the reservation batch's insufficient-stock sentinel.
CREATE TRIGGER IF NOT EXISTS trg_stock_holds_available_quantity
BEFORE INSERT ON stock_holds
FOR EACH ROW WHEN NEW.held_grams < 0
BEGIN
  SELECT RAISE(ABORT, 'insufficient available stock');
END;
