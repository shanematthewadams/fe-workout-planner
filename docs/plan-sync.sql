-- Dedicated FE project only. Accountless capability storage; no keys in logs.
begin;
create schema if not exists fe_private;
grant usage on schema fe_private to anon,authenticated;
create table fe_private.fe_plan_vault (
  key_hash text primary key,
  version bigint not null default 1,
  workouts jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint array_payload check (jsonb_typeof(workouts) = 'array' and jsonb_array_length(workouts) <= 200)
);
alter table fe_private.fe_plan_vault enable row level security;
create policy "No direct browser access" on fe_private.fe_plan_vault for all to anon,authenticated using (false) with check (false);
revoke all on fe_private.fe_plan_vault from public,anon,authenticated;
create function fe_private.fe_sync_plans(sync_code text, operation text, expected_version bigint default 0, payload jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare kh text; current_row fe_private.fe_plan_vault%rowtype; item jsonb;
begin
  if sync_code is null or sync_code !~ '^[a-f0-9]{64}$' then raise exception 'Invalid sync code' using errcode='22023'; end if;
  kh := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(sync_code,'UTF8')),'hex');
  if operation = 'get' then
    select * into current_row from fe_private.fe_plan_vault where key_hash=kh;
    return jsonb_build_object('version',coalesce(current_row.version,0),'workouts',coalesce(current_row.workouts,'[]'::jsonb));
  elsif operation = 'put' then
    if payload is null or jsonb_typeof(payload)<>'array' or jsonb_array_length(payload)>200 or octet_length(payload::text)>5000000 then raise exception 'Invalid payload' using errcode='22023'; end if;
    for item in select value from jsonb_array_elements(payload) loop
      if (item->>'schemaVersion'='1' and item->>'kind'='personal' and length(item->>'id') between 1 and 100 and length(item->>'title') between 1 and 160 and jsonb_typeof(item->'sections')='array') is not true then raise exception 'Invalid personal plan' using errcode='22023'; end if;
    end loop;
    if (select count(distinct value->>'id') from jsonb_array_elements(payload)) <> jsonb_array_length(payload) then raise exception 'Duplicate IDs' using errcode='22023'; end if;
    -- Serialize competing creation/update, including a previously missing vault.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(kh,0));
    select * into current_row from fe_private.fe_plan_vault where key_hash=kh for update;
    if coalesce(current_row.version,0) <> expected_version then raise exception 'Cloud changed' using errcode='PT409'; end if;
    insert into fe_private.fe_plan_vault(key_hash,version,workouts) values(kh,coalesce(current_row.version,0)+1,payload)
      on conflict(key_hash) do update set version=excluded.version,workouts=excluded.workouts,updated_at=now() returning * into current_row;
    return jsonb_build_object('version',current_row.version,'workouts',current_row.workouts);
  end if;
  raise exception 'Invalid operation' using errcode='22023';
end $$;
revoke all on function fe_private.fe_sync_plans(text,text,bigint,jsonb) from public;
grant execute on function fe_private.fe_sync_plans(text,text,bigint,jsonb) to anon,authenticated;
-- Only the capability-checking helper elevates privileges; it is outside the Data API schema.
create function public.fe_sync_plans(sync_code text, operation text, expected_version bigint default 0, payload jsonb default '[]'::jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select fe_private.fe_sync_plans(sync_code,operation,expected_version,payload);
$$;
revoke all on function public.fe_sync_plans(text,text,bigint,jsonb) from public;
grant execute on function public.fe_sync_plans(text,text,bigint,jsonb) to anon,authenticated;
-- Legacy Studio rows remain readable for explicit import; browser writes end here.
revoke insert,update,delete,truncate,references,trigger on public.beatdowns from anon,authenticated;
drop policy if exists "Allow public insert beatdowns" on public.beatdowns;
drop policy if exists "Allow public update beatdowns" on public.beatdowns;
drop policy if exists "Allow public delete beatdowns" on public.beatdowns;
commit;
