-- handle_new_user(): role sanitising, barber + billing creation, usernames,
-- and email sync on auth.users updates.
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000001', 'wants.admin@example.com', '{"role":"admin","name":"Sneaky"}'),
  ('a0000000-0000-4000-8000-000000000002', 'new.barber@example.com', '{"role":"barber","name":"New Barber","business_name":"New Shop"}'),
  ('a0000000-0000-4000-8000-000000000003', 'caps.barber@example.com', '{"role":"Barber"}'),
  ('a0000000-0000-4000-8000-000000000004', 'plain.user@example.com', null),
  ('a0000000-0000-4000-8000-000000000005', 'dup1@example.com', '{"username":"Taken_Name"}'),
  ('a0000000-0000-4000-8000-000000000006', 'dup2@example.com', '{"username":"taken_name"}'),
  ('a0000000-0000-4000-8000-000000000007', 'x@example.com', '{"username":"!!","avatar_url":"javascript:alert(1)"}'),
  ('a0000000-0000-4000-8000-000000000008', 'pic@example.com', '{"avatar_url":"https://example.com/a.png"}');

select is((select role from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'), 'client',
  'signup metadata role "admin" becomes client');
select is_empty($$select 1 from public.barbers where user_id = 'a0000000-0000-4000-8000-000000000001'$$,
  'no barber row for a non-barber signup');
select is((select role from public.profiles where id = 'a0000000-0000-4000-8000-000000000003'), 'client',
  'role must be exactly "barber"');
select is((select role from public.profiles where id = 'a0000000-0000-4000-8000-000000000004'), 'client',
  'missing metadata defaults to client');

select is((select role from public.profiles where id = 'a0000000-0000-4000-8000-000000000002'), 'barber',
  'role "barber" creates a barber profile');
select is((select business_name from public.barbers where user_id = 'a0000000-0000-4000-8000-000000000002'), 'New Shop',
  'barber signup creates the barbers row');
select is(
  (select array[bb.fee_exempt, bb.charges_enabled, bb.stripe_account_id is null]
     from public.barber_billing bb join public.barbers b on b.id = bb.barber_id
    where b.user_id = 'a0000000-0000-4000-8000-000000000002'),
  array[false, false, true], 'barber signup creates a default barber_billing row');
select is((select timezone from public.barbers where user_id = 'a0000000-0000-4000-8000-000000000002'), 'America/New_York',
  'barber timezone defaults to America/New_York');

select is((select email from public.profiles where id = 'a0000000-0000-4000-8000-000000000002'), 'new.barber@example.com',
  'profile email copied from auth.users');
select is((select username from public.profiles where id = 'a0000000-0000-4000-8000-000000000004'), 'plainuser',
  'username derived from the email local part');
select is((select username from public.profiles where id = 'a0000000-0000-4000-8000-000000000005'), 'Taken_Name',
  'requested username is used when free');
select ok((select username ~ '^taken_name_[0-9a-f]{6}$' from public.profiles where id = 'a0000000-0000-4000-8000-000000000006'),
  'a case-insensitive username clash gets a random suffix');
select ok((select username ~ '^user(_[0-9a-f]{6})?$' from public.profiles where id = 'a0000000-0000-4000-8000-000000000007'),
  'unusable username falls back to "user"');
select is((select avatar_url from public.profiles where id = 'a0000000-0000-4000-8000-000000000007'), null,
  'non-https avatar_url is dropped');
select is((select avatar_url from public.profiles where id = 'a0000000-0000-4000-8000-000000000008'), 'https://example.com/a.png',
  'https avatar_url is kept');

update auth.users set email = 'renamed@example.com' where id = 'a0000000-0000-4000-8000-000000000004';
select is((select email from public.profiles where id = 'a0000000-0000-4000-8000-000000000004'), 'renamed@example.com',
  'changing the auth email updates profiles.email');

select throws_ok($$update public.profiles set role = 'admin' where id = 'a0000000-0000-4000-8000-000000000004'$$,
  '23514', null, 'profiles.role cannot hold admin');

select * from finish();
rollback;
