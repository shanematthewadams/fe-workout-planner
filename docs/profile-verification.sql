-- Release verification: synthetic accounts and workouts are rolled back.
-- Run with a privileged database connection; no email is sent.
begin;
select set_config('fe_release.owner_a',gen_random_uuid()::text,true);
select set_config('fe_release.owner_b',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('fe_release.owner_a')::uuid),(current_setting('fe_release.owner_b')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('fe_release.owner_a'),true);
insert into public.fe_profiles(user_id,display_name,created_at) values(auth.uid(),'Release fixture A','2000-01-01');
do $assert$ begin
 if (select count(*) from public.fe_profiles)<>1 then raise exception 'Owner profile read failed'; end if;
 if (select created_at<>now() from public.fe_profiles where user_id=auth.uid()) then raise exception 'Profile creation timestamp was client-controlled'; end if;
 update public.fe_profiles set created_at='2000-01-01',display_name='Release fixture A edited' where user_id=auth.uid();
 if (select created_at<>now() from public.fe_profiles where user_id=auth.uid()) then raise exception 'Profile creation timestamp changed'; end if;
end $assert$;
do $assert$
declare payload jsonb; result jsonb;
begin
payload := jsonb_build_array(jsonb_build_object('schemaVersion',1,'id','release-fixture','title','Temporary release verification','summary','','kind','personal','duration',43,'equipment','[]'::jsonb,'running','None','format','Custom','sections','[{"id":"s","kind":"thang","title":"The Thang","blocks":[{"id":"b","title":"Route","instructions":"Q confirms route","minutes":43,"exercises":[]}]}]'::jsonb,'rawNotes','','adaptationNotes','','provenance','{"status":"personal","label":"Temporary release verification"}'::jsonb,'updatedAt','2026-10-19T00:00:00Z','attribution',jsonb_build_object('ownerId',auth.uid()::text,'creatorId',auth.uid()::text,'creatorDisplayName','Release fixture A','createdAt','2026-10-19T00:00:00Z','visibility','private')));
result := public.fe_account_plans('put',0,payload);
if (result->>'version')::integer<>1 or result->'workouts'<>payload then raise exception 'Attributed account save failed'; end if;
end $assert$;
select set_config('request.jwt.claim.sub',current_setting('fe_release.owner_b'),true);
do $assert$
declare affected integer; result jsonb;
begin
if (select count(*) from public.fe_profiles)<>0 then raise exception 'Cross-account profile read leaked'; end if;
update public.fe_profiles set display_name='Wrong owner' where user_id=current_setting('fe_release.owner_a')::uuid;
get diagnostics affected=row_count;
if affected<>0 then raise exception 'Cross-account profile update succeeded'; end if;
begin
 insert into public.fe_profiles(user_id,display_name) values(current_setting('fe_release.owner_a')::uuid,'Wrong owner');
 raise exception 'Expected ownership denial';
exception when insufficient_privilege then null; end;
insert into public.fe_profiles(user_id,display_name) values(auth.uid(),'Release fixture B');
if (select count(*) from public.fe_profiles)<>1 then raise exception 'Own profile creation failed'; end if;
result := public.fe_account_plans('get');
if result->'workouts'<>'[]'::jsonb then raise exception 'Cross-account workout read leaked'; end if;
end $assert$;
set local role anon;
do $assert$ begin
 begin perform 1 from public.fe_profiles; raise exception 'Expected guest profile denial'; exception when insufficient_privilege then null; end;
 begin perform public.fe_account_plans('get'); raise exception 'Expected guest account denial'; exception when insufficient_privilege then null; end;
end $assert$;
reset role;
rollback;
select 'profile_access_and_attributed_save_verified' as result,
(select count(*) from auth.users)::integer as durable_accounts,
(select count(*) from public.fe_profiles)::integer as durable_profiles,
(select count(*) from fe_private.fe_account_vault)::integer as durable_account_vaults;
