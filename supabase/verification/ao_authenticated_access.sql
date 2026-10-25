-- Read-only verification in the real authenticated database role; no account/token changes.
begin;
set local role authenticated;
select jsonb_build_object('role',current_user,
 'aos_read',(select count(*) from public.ao_sites),
 'venues_read',(select count(*) from public.ao_venues),
 'landmarks_read',(select count(*) from public.ao_landmarks),
 'write_grants',(select jsonb_agg(jsonb_build_object('table',tablename,
  'insert',has_table_privilege(current_user,format('%I.%I',schemaname,tablename),'INSERT'),
  'update',has_table_privilege(current_user,format('%I.%I',schemaname,tablename),'UPDATE'),
  'delete',has_table_privilege(current_user,format('%I.%I',schemaname,tablename),'DELETE')))
 from pg_tables where schemaname='public' and tablename like 'ao_%'),
 'backup_access',has_schema_privilege(current_user,'fe_ao_preflight_backup','USAGE')) as verification;
rollback;
