-- One read-only, caller-RLS snapshot. Does not grant new table writes or bypass policies.
begin;
create function public.fe_exicon_catalog() returns jsonb
language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object(
 'version',1,
 'ao_sources',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.ao_sources s where exists(select 1 from public.ex_source_licenses l where l.source_id=s.id)),'[]'::jsonb),
 'ex_source_licenses',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.ex_source_licenses t),'[]'::jsonb),
 'ex_exercises',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.ex_exercises t),'[]'::jsonb),
 'ex_variations',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.ex_variations t),'[]'::jsonb),
 'ex_aliases',coalesce((select jsonb_agg(to_jsonb(t)-'normalized_alias' order by to_jsonb(t)::text) from public.ex_aliases t),'[]'::jsonb),
 'ex_counting_conventions',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.ex_counting_conventions t),'[]'::jsonb),
 'ex_equipment_types',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.ex_equipment_types t),'[]'::jsonb),
 'ex_exercise_equipment',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.ex_exercise_equipment t),'[]'::jsonb),
 'ex_exercise_facilities',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.ex_exercise_facilities t),'[]'::jsonb),
 'ex_variation_equipment',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.ex_variation_equipment t),'[]'::jsonb),
 'ex_variation_facilities',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.ex_variation_facilities t),'[]'::jsonb),
 'ex_formats',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.ex_formats t),'[]'::jsonb),
 'ex_format_parameters',coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.ex_format_parameters t),'[]'::jsonb)
 );
$$;
revoke all on function public.fe_exicon_catalog() from public;
grant execute on function public.fe_exicon_catalog() to anon,authenticated,service_role;
comment on function public.fe_exicon_catalog() is 'Published Exicon snapshot using caller grants/RLS; no privileged access or writes.';
commit;
