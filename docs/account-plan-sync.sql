-- Additive account storage. Existing guest vaults and recovery codes stay unchanged.
-- Requires docs/plan-sync.sql and docs/plan-sync-hardening.sql.
begin;
create table fe_private.fe_account_vault (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version bigint not null default 1,
  workouts jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint account_payload_size check (octet_length(workouts::text) <= 5000000),
  constraint account_valid_workouts check (fe_private.valid_plan_payload(workouts))
);
alter table fe_private.fe_account_vault enable row level security;
create policy "Account owner only" on fe_private.fe_account_vault for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on fe_private.fe_account_vault from public,anon,authenticated;

-- This helper is private and checks verified JWT ownership before every operation.
create function fe_private.fe_account_plans(operation text, expected_version bigint default 0, payload jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare owner_id uuid := auth.uid(); current_row fe_private.fe_account_vault%rowtype;
begin
  if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if operation = 'get' then
    select * into current_row from fe_private.fe_account_vault where user_id=owner_id;
    return jsonb_build_object('version',coalesce(current_row.version,0),'workouts',coalesce(current_row.workouts,'[]'::jsonb));
  elsif operation = 'put' then
    if expected_version is null or expected_version<0 or payload is null or octet_length(payload::text)>5000000
      or fe_private.valid_plan_payload(payload) is not true then
      raise exception 'Invalid personal plans' using errcode='22023';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('account:'||owner_id::text,0));
    select * into current_row from fe_private.fe_account_vault where user_id=owner_id for update;
    if coalesce(current_row.version,0)<>expected_version then raise exception 'Account changed' using errcode='PT409'; end if;
    insert into fe_private.fe_account_vault(user_id,version,workouts)
      values(owner_id,coalesce(current_row.version,0)+1,payload)
      on conflict(user_id) do update set version=excluded.version,workouts=excluded.workouts,updated_at=now()
      returning * into current_row;
    return jsonb_build_object('version',current_row.version,'workouts',current_row.workouts);
  end if;
  raise exception 'Invalid operation' using errcode='22023';
end $fn$;
revoke all on function fe_private.fe_account_plans(text,bigint,jsonb) from public,anon,authenticated;
grant execute on function fe_private.fe_account_plans(text,bigint,jsonb) to authenticated;
create function public.fe_account_plans(operation text, expected_version bigint default 0, payload jsonb default '[]'::jsonb)
returns jsonb language sql security invoker set search_path = '' as $fn$
  select fe_private.fe_account_plans(operation,expected_version,payload);
$fn$;
revoke all on function public.fe_account_plans(text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.fe_account_plans(text,bigint,jsonb) to authenticated;
commit;
