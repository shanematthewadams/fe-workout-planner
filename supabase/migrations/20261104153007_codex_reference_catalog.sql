-- Official reference data is distinct from reviewed planner mechanics.
-- No existing catalog, account, profile, saved plan or auth definition is altered.
begin;
create table public.ex_codex_reuse (
 source_id text primary key references public.ao_sources(id),
 decision_id text not null unique, decided_by text not null, decided_at timestamptz not null,
 basis text not null check(basis='product-owner-interpretation'),
 upstream_permission text not null check(upstream_permission='unresolved'),
 rationale text not null check(length(rationale)>=40), enabled boolean not null default false,
 last_capture_at timestamptz
);
comment on table public.ex_codex_reuse is 'Operator authorization to import; not a representation of an upstream license or consent.';
create table public.ex_codex_entries (
 id text primary key check(length(id) between 1 and 512), name text not null check(btrim(name)<>''),
 description text not null check(btrim(description)<>''), fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 captured_at timestamptz not null, source_id text not null references public.ex_codex_reuse(source_id),
 present boolean not null default true, protected boolean not null default false
);
create index ex_codex_entries_source_idx on public.ex_codex_entries(source_id);
create table public.ex_codex_aliases (
 entry_id text not null references public.ex_codex_entries(id), alias text not null check(btrim(alias)<>''),
 primary key(entry_id,alias)
);
create index ex_codex_alias_search_idx on public.ex_codex_aliases(lower(alias));
create table public.ex_codex_tags (
 id text primary key check(length(id) between 1 and 512), name text not null check(btrim(name)<>'')
);
create table public.ex_codex_entry_tags (
 entry_id text not null references public.ex_codex_entries(id), tag_id text not null references public.ex_codex_tags(id), primary key(entry_id,tag_id)
);
create index ex_codex_entry_tags_tag_idx on public.ex_codex_entry_tags(tag_id);
-- Some upstream mentions target absent/lexicon entries. Keep those exact IDs without fictional parents.
create table public.ex_codex_mentions (
 entry_id text not null references public.ex_codex_entries(id), target_id text not null check(length(target_id) between 1 and 512), primary key(entry_id,target_id)
);
alter table public.ex_codex_reuse enable row level security;
revoke all on public.ex_codex_reuse from public,anon,authenticated;
grant select on public.ex_codex_reuse to anon,authenticated;
grant all on public.ex_codex_reuse to service_role;
create policy ex_codex_reuse_operator on public.ex_codex_reuse for all to service_role using(true) with check(true);
alter table public.ex_codex_entries enable row level security;
revoke all on public.ex_codex_entries from public,anon,authenticated;
grant select on public.ex_codex_entries to anon,authenticated;
grant all on public.ex_codex_entries to service_role;
create policy ex_codex_entries_operator on public.ex_codex_entries for all to service_role using(true) with check(true);
alter table public.ex_codex_aliases enable row level security;
revoke all on public.ex_codex_aliases from public,anon,authenticated;
grant select on public.ex_codex_aliases to anon,authenticated;
grant all on public.ex_codex_aliases to service_role;
create policy ex_codex_aliases_operator on public.ex_codex_aliases for all to service_role using(true) with check(true);
alter table public.ex_codex_tags enable row level security;
revoke all on public.ex_codex_tags from public,anon,authenticated;
grant select on public.ex_codex_tags to anon,authenticated;
grant all on public.ex_codex_tags to service_role;
create policy ex_codex_tags_operator on public.ex_codex_tags for all to service_role using(true) with check(true);
alter table public.ex_codex_entry_tags enable row level security;
revoke all on public.ex_codex_entry_tags from public,anon,authenticated;
grant select on public.ex_codex_entry_tags to anon,authenticated;
grant all on public.ex_codex_entry_tags to service_role;
create policy ex_codex_entry_tags_operator on public.ex_codex_entry_tags for all to service_role using(true) with check(true);
alter table public.ex_codex_mentions enable row level security;
revoke all on public.ex_codex_mentions from public,anon,authenticated;
grant select on public.ex_codex_mentions to anon,authenticated;
grant all on public.ex_codex_mentions to service_role;
create policy ex_codex_mentions_operator on public.ex_codex_mentions for all to service_role using(true) with check(true);
create policy ex_codex_reuse_read on public.ex_codex_reuse for select to anon,authenticated using(enabled);
create policy ex_codex_entries_read on public.ex_codex_entries for select to anon,authenticated using(present and exists(select 1 from public.ex_codex_reuse r where r.source_id=ex_codex_entries.source_id));
create policy ex_codex_aliases_read on public.ex_codex_aliases for select to anon,authenticated using(exists(select 1 from public.ex_codex_entries e where e.id=ex_codex_aliases.entry_id));
create policy ex_codex_entry_tags_read on public.ex_codex_entry_tags for select to anon,authenticated using(exists(select 1 from public.ex_codex_entries e where e.id=ex_codex_entry_tags.entry_id));
create policy ex_codex_mentions_read on public.ex_codex_mentions for select to anon,authenticated using(exists(select 1 from public.ex_codex_entries e where e.id=ex_codex_mentions.entry_id));
create policy ex_codex_tags_read on public.ex_codex_tags for select to anon,authenticated using(exists(select 1 from public.ex_codex_entry_tags t where t.tag_id=ex_codex_tags.id));
create function public.fe_codex_reference() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('version',1,'attribution','F3 Nation · F3 Codex','entries',coalesce((
 select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'description',e.description,'fingerprint',e.fingerprint,'captured_at',e.captured_at,
 'aliases',coalesce((select jsonb_agg(a.alias order by a.alias) from public.ex_codex_aliases a where a.entry_id=e.id),'[]'::jsonb),
 'tags',coalesce((select jsonb_agg(t.name order by t.name) from public.ex_codex_entry_tags et join public.ex_codex_tags t on t.id=et.tag_id where et.entry_id=e.id),'[]'::jsonb),
 'mentioned_ids',coalesce((select jsonb_agg(m.target_id order by m.target_id) from public.ex_codex_mentions m where m.entry_id=e.id),'[]'::jsonb)) order by e.name,e.id)
 from public.ex_codex_entries e),'[]'::jsonb));
$$;
revoke all on function public.fe_codex_reference() from public,anon,authenticated;
grant execute on function public.fe_codex_reference() to anon,authenticated,service_role;
commit;
