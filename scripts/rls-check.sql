-- RLS Verification Script (manual execution)
-- Use service_role to seed data, then switch to authenticated role for checks.
-- Replace placeholder UUIDs before running.

-- Required session context variables (example):
-- SET LOCAL "request.jwt.claim.sub" = 'user-uuid';
-- SET LOCAL "request.jwt.claim.role" = 'authenticated';

-- 1) Client can only see their own bookings
-- Expect: 1 row for client_a, 0 rows for client_b
SELECT id, client_id, barber_id
FROM bookings
WHERE client_id IN ('client_a_uuid', 'client_b_uuid');

-- 2) Barber can only see their own bookings
-- Expect: rows only for barber_a
SELECT id, client_id, barber_id
FROM bookings
WHERE barber_id IN ('barber_a_uuid', 'barber_b_uuid');

-- 3) Users cannot update other users' profiles
-- Expect: update should affect 0 rows
UPDATE profiles
SET phone = '0000000000'
WHERE id = 'other_user_uuid';

-- 4) Service role can bypass RLS
-- Expect: update should succeed when using service_role key
UPDATE profiles
SET phone = '1111111111'
WHERE id = 'other_user_uuid';
