-- Keep the existing snapshot compatible; add a separate reviewed planner read.
begin;
create function public.fe_exicon_review_fingerprint(exercise_id text,format_id text) returns text
language sql stable security invoker set search_path='' as $$
 select case when exercise_id is not null and format_id is null then (
 select pg_catalog.md5(pg_catalog.jsonb_build_object('exercise',to_jsonb(e),
 'aliases',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.ex_aliases a where a.exercise_id=e.id),'[]'::jsonb),
 'counting',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from public.ex_counting_conventions c where c.exercise_id=e.id),'[]'::jsonb),
 'equipment',coalesce((select jsonb_agg(to_jsonb(q) order by q.equipment_id) from public.ex_exercise_equipment q where q.exercise_id=e.id),'[]'::jsonb),
 'facilities',coalesce((select jsonb_agg(to_jsonb(f) order by f.amenity_id) from public.ex_exercise_facilities f where f.exercise_id=e.id),'[]'::jsonb))::text)
 from public.ex_exercises e where e.id=exercise_id
 ) when format_id is not null and exercise_id is null then (
 select pg_catalog.md5(pg_catalog.jsonb_build_object('format',to_jsonb(f),'parameters',coalesce((select jsonb_agg(to_jsonb(p) order by p.parameter_key) from public.ex_format_parameters p where p.format_id=f.id),'[]'::jsonb))::text)
 from public.ex_formats f where f.id=format_id
 ) else null end;
$$;
revoke all on function public.fe_exicon_review_fingerprint(text,text) from public,anon,authenticated;
grant execute on function public.fe_exicon_review_fingerprint(text,text) to anon,authenticated,service_role;
create table public.ex_codex_planner_links (
 id text primary key, exercise_id text references public.ex_exercises(id),format_id text references public.ex_formats(id),
 entry_id text not null references public.ex_codex_entries(id),
 entry_fingerprint text not null check(entry_fingerprint ~ '^[a-f0-9]{64}$'),
 planning_fingerprint text not null check(planning_fingerprint ~ '^[a-f0-9]{32}$'),
 relation text not null check(relation in ('equivalent','local-adaptation')),
 reviewed_at timestamptz not null,reviewed_by text not null,notes text not null check(length(notes)>10),
 enabled boolean not null default true,protected boolean not null default true,
 check(num_nonnulls(exercise_id,format_id)=1),unique(exercise_id),unique(format_id)
);
create index ex_codex_planner_links_entry_idx on public.ex_codex_planner_links(entry_id);
alter table public.ex_codex_planner_links enable row level security;
revoke all on public.ex_codex_planner_links from public,anon,authenticated;
grant select on public.ex_codex_planner_links to anon,authenticated;
grant all on public.ex_codex_planner_links to service_role;
create policy ex_codex_planner_links_read on public.ex_codex_planner_links for select to anon,authenticated
using(enabled and exists(select 1 from public.ex_codex_entries e where e.id=ex_codex_planner_links.entry_id and e.fingerprint=ex_codex_planner_links.entry_fingerprint)
and planning_fingerprint=public.fe_exicon_review_fingerprint(exercise_id,format_id));
create policy ex_codex_planner_links_operator on public.ex_codex_planner_links for all to service_role using(true) with check(true);
create function public.fe_exicon_planner_catalog() returns jsonb
language sql stable security invoker set search_path='' as $$
 select public.fe_exicon_catalog() || jsonb_build_object('codex_links',coalesce((
 select jsonb_agg(jsonb_build_object('exercise_id',l.exercise_id,'format_id',l.format_id,'entry_id',e.id,'entry_name',e.name,
 'description',case when l.relation='equivalent' then e.description else null end,'relation',l.relation,'review_note',l.notes,'reviewed_at',l.reviewed_at) order by l.id)
 from public.ex_codex_planner_links l join public.ex_codex_entries e on e.id=l.entry_id
 -- Repeat the review predicates explicitly: owner/operator RPC callers bypass RLS too.
 where l.enabled and e.present and e.fingerprint=l.entry_fingerprint
 and exists(select 1 from public.ex_codex_reuse r where r.source_id=e.source_id and r.enabled)
 and l.planning_fingerprint=public.fe_exicon_review_fingerprint(l.exercise_id,l.format_id)
 ),'[]'::jsonb));
$$;
revoke all on function public.fe_exicon_planner_catalog() from public,anon,authenticated;
grant execute on function public.fe_exicon_planner_catalog() to anon,authenticated,service_role;
commit;
