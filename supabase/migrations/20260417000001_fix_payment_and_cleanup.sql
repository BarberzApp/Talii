-- Fix payment status constraint to align with Stripe webhook (adds succeeded, partially_refunded)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;

ALTER TABLE bookings 
ADD CONSTRAINT bookings_payment_status_check 
CHECK (payment_status IN ('pending', 'paid', 'succeeded', 'failed', 'refunded', 'partially_refunded'));

-- Clean up unused tables
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS cut_comments CASCADE;
DROP TABLE IF EXISTS ondemand_requests CASCADE;
DROP TABLE IF EXISTS ondemand_settings CASCADE;
