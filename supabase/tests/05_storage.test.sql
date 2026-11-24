-- Storage buckets and owner-folder policies on storage.objects.
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

-- The Storage API sets this before deleting rows; without it a statement-level
-- trigger blocks every direct DELETE regardless of policy.
set local storage.allow_delete_query to 'true';

select is(
  (select array_agg(id || ':' || public::text order by id) from storage.buckets where id in ('avatars', 'media')),
  array['avatars:true', 'media:true'], 'avatars and media buckets exist and are public-read');
select ok(
  (select bool_and(m like 'image/%') from storage.buckets, unnest(allowed_mime_types) m where id in ('avatars', 'media')),
  'both buckets accept images only');
select ok(
  (select bool_and(file_size_limit is not null) from storage.buckets where id in ('avatars', 'media')),
  'both buckets have a file size limit');

insert into auth.users (id, email) values
  ('51000000-0000-4000-8000-000000000001', 'store.one@example.com'),
  ('51000000-0000-4000-8000-000000000002', 'store.two@example.com'),
  ('51000000-0000-4000-8000-000000000003', 'store.disabled@example.com');

update public.profiles set is_disabled = true where id = '51000000-0000-4000-8000-000000000003';

insert into storage.objects (bucket_id, name, owner) values
  ('media', '51000000-0000-4000-8000-000000000002/portfolio/1.jpg', '51000000-0000-4000-8000-000000000002'),
  ('media', '51000000-0000-4000-8000-000000000003/portfolio/1.jpg', '51000000-0000-4000-8000-000000000003');

-- Disabled user ----------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub":"51000000-0000-4000-8000-000000000003","role":"authenticated"}';

select throws_ok($$insert into storage.objects (bucket_id, name, owner)
  values ('avatars', '51000000-0000-4000-8000-000000000003/avatar.png', '51000000-0000-4000-8000-000000000003')$$,
  '42501', null, 'a disabled user cannot upload, even into own folder');
update storage.objects set metadata = '{"x":1}' where name = '51000000-0000-4000-8000-000000000003/portfolio/1.jpg';
delete from storage.objects where name = '51000000-0000-4000-8000-000000000003/portfolio/1.jpg';

reset role;

select is(
  (select metadata from storage.objects where name = '51000000-0000-4000-8000-000000000003/portfolio/1.jpg'), null,
  'a disabled user cannot update own objects');
select is((select count(*)::int from storage.objects where name = '51000000-0000-4000-8000-000000000003/portfolio/1.jpg'), 1,
  'a disabled user cannot delete own objects');

-- User one -------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok($$insert into storage.objects (bucket_id, name, owner)
  values ('avatars', '51000000-0000-4000-8000-000000000001/avatar.png', '51000000-0000-4000-8000-000000000001')$$,
  'user can upload into own avatars folder');
select lives_ok($$insert into storage.objects (bucket_id, name, owner)
  values ('media', '51000000-0000-4000-8000-000000000001/portfolio/a.jpg', '51000000-0000-4000-8000-000000000001')$$,
  'user can upload into own media folder');
select throws_ok($$insert into storage.objects (bucket_id, name, owner)
  values ('avatars', '51000000-0000-4000-8000-000000000002/avatar.png', '51000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'user cannot upload into another user''s folder');
select throws_ok($$insert into storage.objects (bucket_id, name, owner)
  values ('avatars', 'avatar.png', '51000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'user cannot upload to the bucket root');
select lives_ok($$update storage.objects set name = '51000000-0000-4000-8000-000000000001/avatar2.png'
  where name = '51000000-0000-4000-8000-000000000001/avatar.png'$$,
  'user can rename an object inside own folder');
select throws_ok($$update storage.objects set name = '51000000-0000-4000-8000-000000000002/stolen.png'
  where name = '51000000-0000-4000-8000-000000000001/avatar2.png'$$,
  '42501', null, 'user cannot move an object into another user''s folder');
select is_empty($$select 1 from storage.objects where name like '51000000-0000-4000-8000-000000000002/%'$$,
  'user cannot list another user''s objects');
select lives_ok($$delete from storage.objects where name = '51000000-0000-4000-8000-000000000001/portfolio/a.jpg'$$,
  'user can delete an object in own folder');

update storage.objects set metadata = '{"x":1}' where name = '51000000-0000-4000-8000-000000000002/portfolio/1.jpg';
delete from storage.objects where name = '51000000-0000-4000-8000-000000000002/portfolio/1.jpg';

reset role;

select is(
  (select metadata from storage.objects where name = '51000000-0000-4000-8000-000000000002/portfolio/1.jpg'), null,
  'another user''s object was not updated');
select is((select count(*)::int from storage.objects where name = '51000000-0000-4000-8000-000000000002/portfolio/1.jpg'), 1,
  'another user''s object was not deleted');

-- Anonymous -------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok($$insert into storage.objects (bucket_id, name)
  values ('avatars', '51000000-0000-4000-8000-000000000001/anon.png')$$,
  '42501', null, 'anon cannot upload');

delete from storage.objects where bucket_id in ('avatars', 'media');

reset role;

select is((select count(*)::int from storage.objects where name like '51000000-%'), 3,
  'anon cannot delete objects (own-folder delete removed exactly one)');

select * from finish();
rollback;
