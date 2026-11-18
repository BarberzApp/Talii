-- Admin moderation columns: barbers.listing_suspended hides a listing everywhere
-- regardless of is_public; reports.reported_user_id is never readable by clients;
-- profiles.deleted_at marks self-deleted accounts.
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, email, raw_user_meta_data) values
  ('a8000000-0000-4000-8000-000000000001', 'mod.barber@example.com', '{"name":"Mod Barber","role":"barber","username":"modbarber","business_name":"Suspended Cuts"}'),
  ('a8000000-0000-4000-8000-000000000002', 'mod.client@example.com', '{"name":"Mod Client"}'),
  ('a8000000-0000-4000-8000-000000000003', 'mod.reviewer@example.com', '{"name":"Mod Reviewer"}');

update public.barbers set latitude = 10, longitude = 10, city = 'Modville'
  where user_id = 'a8000000-0000-4000-8000-000000000001';
insert into public.services (barber_id, name, duration_minutes, price_cents)
select id, 'Mod Cut', 30, 1000 from public.barbers where user_id = 'a8000000-0000-4000-8000-000000000001';

create temp table mod_barber as
  select id from public.barbers where user_id = 'a8000000-0000-4000-8000-000000000001';
grant select on mod_barber to anon, authenticated;

create temp table stats_before as select * from public.admin_platform_stats();

-- Listed before suspension.
select ok(public.barber_is_listed((select id from mod_barber)), 'a public barber is listed');

update public.barbers set listing_suspended = true where id = (select id from mod_barber);

select ok(not public.barber_is_listed((select id from mod_barber)), 'a suspended barber is not listed even though is_public');
select ok((select is_public from public.barbers where id = (select id from mod_barber)), 'is_public (the barber''s choice) is unchanged');
select is_empty($$select 1 from public.nearby_barbers(10, 10, 5)$$, 'nearby_barbers leaves out a suspended barber');
select is_empty($$select 1 from public.search_barbers('suspended cuts')$$, 'search_barbers leaves out a suspended barber');
select is(
  (select a.barbers_suspended - b.barbers_suspended from public.admin_platform_stats() a, stats_before b),
  1::bigint, 'admin_platform_stats counts suspended barbers');
select is(
  (select a.barbers_listed - b.barbers_listed from public.admin_platform_stats() a, stats_before b),
  -1::bigint, 'suspending a listed barber drops the listed count by one');

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select is_empty($$select 1 from public.barbers where id = (select id from mod_barber)$$, 'anon cannot read a suspended barber');
select is_empty($$select 1 from public.services where barber_id = (select id from mod_barber)$$, 'anon cannot read a suspended barber''s services');
select is_empty($$select 1 from public.public_profiles where id = 'a8000000-0000-4000-8000-000000000001'$$,
  'public_profiles leaves out a suspended barber');
select throws_ok($$update public.barbers set listing_suspended = false$$, '42501', null, 'anon cannot clear listing_suspended');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"a8000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.barbers where id = (select id from mod_barber)), 1,
  'the owner still reads their own suspended barber row');
select throws_ok($$update public.barbers set listing_suspended = false where user_id = auth.uid()$$, '42501', null,
  'the owner cannot clear listing_suspended');
reset role;

-- Reports: the reporter never sees reported_user_id.
insert into public.reports (reporter_id, reported_user_id, content_type, content_id, reason)
values ('a8000000-0000-4000-8000-000000000002', 'a8000000-0000-4000-8000-000000000003', 'review',
        'a8000000-0000-4000-8000-0000000000ff', 'spam');

set local role authenticated;
set local request.jwt.claims to '{"sub":"a8000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select status from public.reports where reporter_id = auth.uid()), 'pending',
  'the reporter reads the status of their own report');
select throws_ok($$select reported_user_id from public.reports$$, '42501', null,
  'the reporter cannot read reported_user_id');
select throws_ok($$select * from public.reports$$, '42501', null, 'select * on reports is refused (column grant)');
reset role;

-- Deleted accounts.
select is((select deleted_at from public.profiles where id = 'a8000000-0000-4000-8000-000000000002'), null::timestamptz,
  'profiles.deleted_at is null for a live account');

select * from finish();
rollback;
