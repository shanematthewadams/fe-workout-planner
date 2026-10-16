-- Prepared for a dedicated FE project ONLY. Never apply to With or Elsewhere.
-- Fresh install; applied to the dedicated F3 Workout Planner project on 2026-10-16.
begin;
create table public.workouts (
  id text primary key,
  data jsonb not null,
  approved boolean not null default false,
  published boolean not null default false,
  managed_by text,
  updated_at timestamptz not null default now(),
  constraint source_only check ((data->>'kind' = 'source') is true),
  constraint version_one check ((data->>'schemaVersion' = '1') is true),
  constraint matching_id check ((data->>'id' = id) is true),
  constraint approved_before_publication check (not published or approved),
  constraint reviewed_before_publication check (not published or
    (data->'provenance'->>'status' in ('illustrative','regional-reviewed')) is true)
);
alter table public.workouts enable row level security;
revoke all on public.workouts from public, anon, authenticated;
grant select on public.workouts to anon, authenticated;
grant select, insert, update, delete on public.workouts to service_role;
create policy "Approved published sources are readable" on public.workouts for select
  to anon, authenticated using (published = true and approved = true);
-- No browser INSERT, UPDATE, DELETE grants or policies. No consumer accounts needed.
commit;
