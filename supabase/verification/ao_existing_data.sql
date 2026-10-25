-- Return only counts/match booleans, never private workout/profile/vault contents.
begin;
set local timezone = 'UTC';
create temporary table ao_existing_data_check(object_name text,expected_rows bigint,actual_rows bigint,unchanged boolean) on commit drop;
do $$ declare r record; n bigint; digest text; begin
 for r in select * from fe_ao_preflight_backup.manifest loop
  execute format('select count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''[]'')) from %s t',to_regclass(r.object_name)) into n,digest;
  insert into ao_existing_data_check values(r.object_name,r.row_count,n,r.checksum=digest);
 end loop;
end $$;
select jsonb_build_object('existing_data',(select jsonb_agg(t) from ao_existing_data_check t),'backup_readers',jsonb_build_object('anon',has_schema_privilege('anon','fe_ao_preflight_backup','USAGE'),'authenticated',has_schema_privilege('authenticated','fe_ao_preflight_backup','USAGE'),'service_role',has_schema_privilege('service_role','fe_ao_preflight_backup','USAGE'))) as verification;
commit;
