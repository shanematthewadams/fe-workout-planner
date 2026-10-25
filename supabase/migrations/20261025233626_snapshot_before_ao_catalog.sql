-- Operator-only logical snapshot before the authorized additive AO catalog rollout.
-- Does not change existing data, grants, RLS, RPCs or auth. Never expose this schema.
begin isolation level repeatable read;
set local timezone = 'UTC';
create schema fe_ao_preflight_backup;
revoke all on schema fe_ao_preflight_backup from public, anon, authenticated, service_role;
create table fe_ao_preflight_backup.manifest (
 object_name text primary key, snapshot_table text not null,
 captured_at timestamptz not null default now(), row_count bigint not null, checksum text not null
);
create table fe_ao_preflight_backup.definitions (id boolean primary key default true check(id), metadata jsonb not null);
insert into fe_ao_preflight_backup.definitions(metadata)
select jsonb_build_object(
 'columns',(select jsonb_agg(t) from (select * from information_schema.columns where table_schema in ('public','fe_private'))t),
 'constraints',(select jsonb_agg(t) from (select conrelid::regclass::text as object_name,conname,pg_get_constraintdef(oid) as definition from pg_constraint where connamespace in (select oid from pg_namespace where nspname in ('public','fe_private')))t),
 'indexes',(select jsonb_agg(t) from (select * from pg_indexes where schemaname in ('public','fe_private'))t),
 'policies',(select jsonb_agg(t) from (select * from pg_policies where schemaname in ('public','fe_private'))t),
 'grants',(select jsonb_agg(t) from (select * from information_schema.role_table_grants where table_schema in ('public','fe_private'))t),
 'functions',(select jsonb_agg(t) from (select n.nspname as schema,p.proname,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','fe_private') and p.prokind='f')t),
 'triggers',(select jsonb_agg(t) from (select tgrelid::regclass::text as object_name,tgname,pg_get_triggerdef(oid) as definition from pg_trigger where not tgisinternal and tgrelid in (select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','fe_private')))t)
);
do $$ declare src text; dest text; n bigint; digest text; begin
 foreach src in array array['public.workouts','public.beatdowns','public.fe_profiles','fe_private.fe_plan_vault','fe_private.fe_account_vault'] loop
 -- A fresh disposable test DB need not contain the legacy app. Production was inspected beforehand.
 if to_regclass(src) is not null then
  dest=replace(src,'.','_');
  execute format('create table fe_ao_preflight_backup.%I as select * from %s',dest,to_regclass(src));
  execute format('select count(*),md5(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text)::text,''[]'')) from fe_ao_preflight_backup.%I r',dest) into n,digest;
  insert into fe_ao_preflight_backup.manifest(object_name,snapshot_table,row_count,checksum) values(src,dest,n,digest);
 end if;
 end loop;
 for dest in select tablename from pg_tables where schemaname='fe_ao_preflight_backup' loop
  execute format('alter table fe_ao_preflight_backup.%I enable row level security',dest);
  execute format('revoke all on fe_ao_preflight_backup.%I from public,anon,authenticated,service_role',dest);
 end loop;
end $$;
commit;
