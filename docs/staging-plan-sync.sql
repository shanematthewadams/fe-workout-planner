-- PREPARED ONLY. Requires Shane's explicit approval before applying to the existing project.
-- New staging schema/RPC only; production vaults and legacy Studio tables are untouched.
-- Dedicated FE project only. Accountless capability storage; no keys in logs.
begin;
create schema if not exists fe_staging_private;
grant usage on schema fe_staging_private to anon,authenticated;
create table fe_staging_private.fe_plan_vault (
  key_hash text primary key,
  version bigint not null default 1,
  workouts jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint array_payload check (jsonb_typeof(workouts) = 'array' and jsonb_array_length(workouts) <= 200)
);
alter table fe_staging_private.fe_plan_vault enable row level security;
create policy "No direct browser access" on fe_staging_private.fe_plan_vault for all to anon,authenticated using (false) with check (false);
revoke all on fe_staging_private.fe_plan_vault from public,anon,authenticated;
create function fe_staging_private.fe_staging_sync_plans(sync_code text, operation text, expected_version bigint default 0, payload jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare kh text; current_row fe_staging_private.fe_plan_vault%rowtype; item jsonb;
begin
  if sync_code is null or sync_code !~ '^[a-f0-9]{64}$' then raise exception 'Invalid sync code' using errcode='22023'; end if;
  kh := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(sync_code,'UTF8')),'hex');
  if operation = 'get' then
    select * into current_row from fe_staging_private.fe_plan_vault where key_hash=kh;
    return jsonb_build_object('version',coalesce(current_row.version,0),'workouts',coalesce(current_row.workouts,'[]'::jsonb));
  elsif operation = 'put' then
    if payload is null or jsonb_typeof(payload)<>'array' or jsonb_array_length(payload)>200 or octet_length(payload::text)>5000000 then raise exception 'Invalid payload' using errcode='22023'; end if;
    for item in select value from jsonb_array_elements(payload) loop
      if (item->>'schemaVersion'='1' and item->>'kind'='personal' and length(item->>'id') between 1 and 100 and length(item->>'title') between 1 and 160 and jsonb_typeof(item->'sections')='array') is not true then raise exception 'Invalid personal plan' using errcode='22023'; end if;
    end loop;
    if (select count(distinct value->>'id') from jsonb_array_elements(payload)) <> jsonb_array_length(payload) then raise exception 'Duplicate IDs' using errcode='22023'; end if;
    -- Serialize competing creation/update, including a previously missing vault.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(kh,0));
    select * into current_row from fe_staging_private.fe_plan_vault where key_hash=kh for update;
    if coalesce(current_row.version,0) <> expected_version then raise exception 'Cloud changed' using errcode='PT409'; end if;
    insert into fe_staging_private.fe_plan_vault(key_hash,version,workouts) values(kh,coalesce(current_row.version,0)+1,payload)
      on conflict(key_hash) do update set version=excluded.version,workouts=excluded.workouts,updated_at=now() returning * into current_row;
    return jsonb_build_object('version',current_row.version,'workouts',current_row.workouts);
  end if;
  raise exception 'Invalid operation' using errcode='22023';
end $$;
revoke all on function fe_staging_private.fe_staging_sync_plans(text,text,bigint,jsonb) from public;
grant execute on function fe_staging_private.fe_staging_sync_plans(text,text,bigint,jsonb) to anon,authenticated;
-- Only the capability-checking helper elevates privileges; it is outside the Data API schema.
create function public.fe_staging_sync_plans(sync_code text, operation text, expected_version bigint default 0, payload jsonb default '[]'::jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select fe_staging_private.fe_staging_sync_plans(sync_code,operation,expected_version,payload);
$$;
revoke all on function public.fe_staging_sync_plans(text,text,bigint,jsonb) from public;
grant execute on function public.fe_staging_sync_plans(text,text,bigint,jsonb) to anon,authenticated;

create or replace function fe_staging_private.valid_plan_payload(payload jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $fn$
declare item jsonb; kinds text[]; identifiers text[];
begin
  if jsonb_typeof(payload) is distinct from 'array' or jsonb_array_length(payload)>200 then return false; end if;
  for item in select value from jsonb_array_elements(payload) loop
    if not extensions.jsonb_matches_schema($schema${"$ref":"#/definitions/Workout","definitions":{"Workout":{"type":"object","properties":{"schemaVersion":{"type":"number","const":1},"id":{"type":"string","minLength":1,"maxLength":100},"originId":{"type":"string","maxLength":100},"title":{"type":"string","minLength":1,"maxLength":160},"summary":{"type":"string","maxLength":20000},"kind":{"const":"personal"},"duration":{"anyOf":[{"type":"number","minimum":1,"maximum":300},{"type":"null"}]},"equipment":{"type":"array","items":{"type":"string","maxLength":100},"maxItems":20},"running":{"type":"string","enum":["None","Light","Moderate"]},"format":{"type":"string","enum":["Circuit","11s","EMOM","AMRAP","Ladder","Partner","Stations","Chipper","Custom"]},"sections":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","minLength":1,"maxLength":100},"kind":{"type":"string","enum":["warmup","thang","mary"]},"title":{"type":"string","maxLength":20000},"blocks":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","minLength":1,"maxLength":100},"title":{"type":"string","maxLength":20000},"instructions":{"type":"string","maxLength":20000},"minutes":{"anyOf":[{"type":"number","minimum":0,"maximum":300},{"type":"null"}]},"exercises":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","minLength":1,"maxLength":100},"name":{"type":"string","maxLength":20000},"amount":{"type":"string","maxLength":20000},"unit":{"type":"string","enum":["reps","seconds","minutes","meters","rounds","instructions"]},"sets":{"type":"integer","minimum":1,"maximum":100},"counting":{"type":"string","enum":["total","1=1","2=1","per side","cadence","time","distance","not applicable"]},"instructions":{"type":"string","maxLength":20000}},"required":["id","name","amount","unit","counting","instructions"],"additionalProperties":false},"maxItems":100}},"required":["id","title","instructions","minutes","exercises"],"additionalProperties":false},"minItems":1,"maxItems":50}},"required":["id","kind","title","blocks"],"additionalProperties":false},"minItems":1,"maxItems":3},"rawNotes":{"type":"string","maxLength":20000},"adaptationNotes":{"type":"string","maxLength":20000},"provenance":{"type":"object","properties":{"status":{"type":"string","enum":["illustrative","personal","imported-unreviewed","regional-reviewed"]},"label":{"type":"string","maxLength":20000},"sourceId":{"type":"string","maxLength":100},"q":{"type":"string","maxLength":160},"ao":{"type":"string","maxLength":160},"eventDate":{"type":"string","pattern":"^\\d{4}-\\d{2}-\\d{2}$"},"checkedAt":{"type":"string","format":"date-time"},"issues":{"type":"array","items":{"type":"string","maxLength":500},"maxItems":30},"durationBasis":{"type":"string","enum":["source","inferred","unknown"]},"generation":{"type":"object","properties":{"provider":{"type":"string","enum":["OpenRouter","Gemini"]},"model":{"type":"string","maxLength":200},"referenceSourceIds":{"type":"array","items":{"type":"string","maxLength":100},"maxItems":3}},"required":["provider","model","referenceSourceIds"],"additionalProperties":false},"url":{"type":"string","format":"uri","maxLength":2000}},"required":["status","label"],"additionalProperties":false},"schedule":{"type":"object","properties":{"startTime":{"type":"string","pattern":"^([01]\\d|2[0-3]):[0-5]\\d$"},"requiredFeatures":{"type":"array","items":{"type":"string","enum":["track","stairs","bleachers","parkingLot","shelter","hills","field","pullupBars","benches","walls","runningRoute"]},"maxItems":11,"default":[]},"siteSummary":{"type":"string","maxLength":1600}},"required":["startTime"],"additionalProperties":false},"updatedAt":{"type":"string","format":"date-time"}},"required":["schemaVersion","id","title","summary","kind","duration","equipment","running","format","sections","rawNotes","adaptationNotes","provenance","updatedAt"],"additionalProperties":false}},"$schema":"http://json-schema.org/draft-07/schema#"}$schema$::json,item) then return false; end if;
    select array_agg(value->>'kind') into kinds from jsonb_array_elements(item->'sections');
    if not ('thang'=any(kinds)) or cardinality(kinds)<>(select count(distinct k) from unnest(kinds) k) then return false; end if;
    select array_agg(id) into identifiers from (
      select s->>'id' as id from jsonb_array_elements(item->'sections') s
      union all select b->>'id' from jsonb_array_elements(item->'sections') s cross join lateral jsonb_array_elements(s->'blocks') b
      union all select e->>'id' from jsonb_array_elements(item->'sections') s cross join lateral jsonb_array_elements(s->'blocks') b cross join lateral jsonb_array_elements(b->'exercises') e
    ) ids;
    if cardinality(identifiers)<>(select count(distinct id) from unnest(identifiers) id) then return false; end if;
  end loop;
  return true;
end $fn$;
revoke all on function fe_staging_private.valid_plan_payload(jsonb) from public,anon,authenticated;
alter table fe_staging_private.fe_plan_vault add constraint valid_workout_payload check (fe_staging_private.valid_plan_payload(workouts)) not valid;

commit;
