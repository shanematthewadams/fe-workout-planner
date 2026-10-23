-- Additive installation, after account-plan-sync.sql. No auth triggers or email copies.
begin;
create table public.fe_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check(length(btrim(display_name)) between 1 and 80),
  home_region text not null default 'The FE' check(length(home_region)<=120),
  home_ao text not null default '' check(length(home_ao)<=160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.fe_profiles enable row level security;
revoke all on public.fe_profiles from public,anon,authenticated;
grant select,insert,update on public.fe_profiles to authenticated;
create policy "Read own profile" on public.fe_profiles for select to authenticated using ((select auth.uid())=user_id);
create policy "Create own profile" on public.fe_profiles for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Edit own profile" on public.fe_profiles for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create function fe_private.profile_timestamps() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if new.user_id is distinct from old.user_id then raise exception 'Profile identity is immutable'; end if;
    new.created_at := old.created_at;
  else new.created_at := now(); end if;
  new.updated_at := now();
  new.display_name := btrim(new.display_name);
  return new;
end $$;
revoke all on function fe_private.profile_timestamps() from public,anon,authenticated;
create trigger profile_timestamps before insert or update on public.fe_profiles for each row execute function fe_private.profile_timestamps();
commit;
