-- Bind the actual source name/description too: a manual edit may leave its raw-source SHA unchanged.
begin;
create function public.fe_codex_text_review_fingerprint(entry_id text) returns text
language sql stable security invoker set search_path='' as $$
 select pg_catalog.md5(pg_catalog.jsonb_build_object('name',e.name,'description',e.description)::text)
 from public.ex_codex_entries e where e.id=entry_id;
$$;
revoke all on function public.fe_codex_text_review_fingerprint(text) from public,anon,authenticated;
grant execute on function public.fe_codex_text_review_fingerprint(text) to anon,authenticated,service_role;
alter table public.ex_codex_planner_links add column entry_text_fingerprint text check(entry_text_fingerprint ~ '^[a-f0-9]{32}$');
-- Existing links are withheld until an explicit fingerprint-checked metadata backfill runs.
drop policy ex_codex_planner_links_read on public.ex_codex_planner_links;
create policy ex_codex_planner_links_read on public.ex_codex_planner_links for select to anon,authenticated
using(enabled and exists(select 1 from public.ex_codex_entries e where e.id=ex_codex_planner_links.entry_id and e.fingerprint=ex_codex_planner_links.entry_fingerprint)
and entry_text_fingerprint=public.fe_codex_text_review_fingerprint(entry_id)
and planning_fingerprint=public.fe_exicon_review_fingerprint(exercise_id,format_id));
create or replace function public.fe_exicon_planner_catalog() returns jsonb
language sql stable security invoker set search_path='' as $$
 select public.fe_exicon_catalog() || jsonb_build_object('codex_links',coalesce((
 select jsonb_agg(jsonb_build_object('exercise_id',l.exercise_id,'format_id',l.format_id,'entry_id',e.id,'entry_name',e.name,
 'description',case when l.relation='equivalent' then e.description else null end,'relation',l.relation,'review_note',l.notes,'reviewed_at',l.reviewed_at) order by l.id)
 from public.ex_codex_planner_links l join public.ex_codex_entries e on e.id=l.entry_id
 -- Repeat the review predicates explicitly: owner/operator RPC callers bypass RLS too.
 where l.enabled and e.present and e.fingerprint=l.entry_fingerprint
 and l.entry_text_fingerprint=public.fe_codex_text_review_fingerprint(l.entry_id)
 and exists(select 1 from public.ex_codex_reuse r where r.source_id=e.source_id and r.enabled)
 and l.planning_fingerprint=public.fe_exicon_review_fingerprint(l.exercise_id,l.format_id)
 ),'[]'::jsonb));
$$;
commit;
