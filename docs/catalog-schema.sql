-- Prepared only; not applied to any connected project.
-- Apply to a new, dedicated FE Supabase project after organization/cost approval.
create table public.workouts (
  id text primary key,
  data jsonb not null,
  published boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint source_only check (data->>'kind' = 'source'),
  constraint version_one check (data->>'schemaVersion' = '1'),
  constraint matching_id check (data->>'id' = id)
);
alter table public.workouts enable row level security;
revoke all on public.workouts from anon, authenticated;
grant select on public.workouts to anon, authenticated;
create policy "Published sources are readable" on public.workouts for select
  to anon, authenticated using (published = true);
-- There is no browser INSERT, UPDATE, or DELETE policy or grant.
-- Personal drafts and favorites never enter this table.
