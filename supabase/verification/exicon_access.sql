-- Read-only role verification; no account session or user record is borrowed.
begin;
set local role authenticated;
select 'authenticated' as role,
 (select count(*) from public.ex_exercises) as exercises,
 (select count(*) from public.ex_aliases) as aliases,
 (select count(*) from public.ex_counting_conventions) as counting,
 (select count(*) from public.ex_formats) as formats;
select tablename,
 has_table_privilege(current_user,format('%I.%I',schemaname,tablename),'INSERT') as can_insert,
 has_table_privilege(current_user,format('%I.%I',schemaname,tablename),'UPDATE') as can_update,
 has_table_privilege(current_user,format('%I.%I',schemaname,tablename),'DELETE') as can_delete
from pg_tables where schemaname='public' and tablename like 'ex_%' order by tablename;
rollback;
select has_function_privilege('anon','public.ex_check_publication()','EXECUTE') as anon_trigger_execute,
 has_function_privilege('authenticated','public.ex_check_publication()','EXECUTE') as authenticated_trigger_execute,
 has_function_privilege('service_role','public.ex_check_publication()','EXECUTE') as operator_trigger_execute;
