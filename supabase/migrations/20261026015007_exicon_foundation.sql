-- Additive Exicon catalog. Existing workouts, profiles, auth, and AO data are untouched.
-- Apply once through migration history; imports are independently repeatable.
begin;
create table public.ex_source_licenses (
 source_id text primary key references public.ao_sources(id),
 license_name text not null check (btrim(license_name) <> ''),
 permission_url text not null check (permission_url ~ '^https://'),
 reviewed_at timestamptz, redistribution_allowed boolean not null default false,
 check (not redistribution_allowed or reviewed_at is not null)
);
create table public.ex_exercises (
 id text primary key check(btrim(id) <> ''), name text not null check(btrim(name) <> ''), instructions text not null check(btrim(instructions) <> ''),
 movement_category text not null check(btrim(movement_category) <> ''), running boolean not null,
 alternative text not null check(btrim(alternative) <> ''), source_id text not null references public.ex_source_licenses(source_id), publication_status text not null default 'draft' check(publication_status in ('draft','reviewed','published')), revision integer not null default 1 check(revision > 0), protected boolean not null default false
);
create table public.ex_variations (
 id text primary key check(btrim(id) <> ''), exercise_id text not null references public.ex_exercises(id), region_id text references public.ao_regions(id),
 name text not null check(btrim(name) <> ''), instructions text not null check(btrim(instructions) <> ''),
 equipment_mode text not null default 'inherit' check(equipment_mode in ('inherit','replace')),
 facility_mode text not null default 'inherit' check(facility_mode in ('inherit','replace')),
 source_id text not null references public.ex_source_licenses(source_id), publication_status text not null default 'draft' check(publication_status in ('draft','reviewed','published')), revision integer not null default 1 check(revision > 0), protected boolean not null default false, unique(id,exercise_id)
);
create table public.ex_aliases (
 id text primary key check(btrim(id) <> ''), exercise_id text not null references public.ex_exercises(id), variation_id text, region_id text references public.ao_regions(id),
 alias text not null,
 normalized_alias text generated always as (btrim(regexp_replace(lower(alias),'[^a-z0-9]+',' ','g'))) stored check(normalized_alias <> ''),
 source_id text not null references public.ex_source_licenses(source_id), publication_status text not null default 'draft' check(publication_status in ('draft','reviewed','published')), revision integer not null default 1 check(revision > 0), protected boolean not null default false, foreign key(variation_id,exercise_id) references public.ex_variations(id,exercise_id)
);
create unique index ex_alias_global_unique on public.ex_aliases(normalized_alias,exercise_id,coalesce(variation_id,'')) where region_id is null;
create unique index ex_alias_region_unique on public.ex_aliases(region_id,normalized_alias,exercise_id,coalesce(variation_id,'')) where region_id is not null;
create table public.ex_counting_conventions (
 id text primary key check(btrim(id) <> ''), exercise_id text not null references public.ex_exercises(id), variation_id text, region_id text references public.ao_regions(id),
 convention text not null check(convention in ('1=1','2=1','per-side','cadence','time','distance','not-applicable','unknown')),
 cycle_description text not null check(btrim(cycle_description) <> ''), count_on smallint check(count_on between 1 and 4),
 source_id text not null references public.ex_source_licenses(source_id), publication_status text not null default 'draft' check(publication_status in ('draft','reviewed','published')), revision integer not null default 1 check(revision > 0), protected boolean not null default false, foreign key(variation_id,exercise_id) references public.ex_variations(id,exercise_id),
 check ((convention = 'cadence') = (count_on is not null))
);
create unique index ex_counting_scope_unique on public.ex_counting_conventions(exercise_id,coalesce(variation_id,''),coalesce(region_id,''),convention);
create table public.ex_equipment_types (
 id text primary key check(btrim(id) <> ''), name text not null unique check(btrim(name) <> '')
);
create table public.ex_exercise_equipment (
 exercise_id text not null references public.ex_exercises(id),
 equipment_id text not null references public.ex_equipment_types(id), required boolean not null,
 primary key(exercise_id,equipment_id)
);
create index ex_exercise_equipment_type_idx on public.ex_exercise_equipment(equipment_id);
create table public.ex_exercise_facilities (
 exercise_id text not null references public.ex_exercises(id),
 amenity_id text not null references public.ao_amenity_types(id), required boolean not null,
 primary key(exercise_id,amenity_id)
);
create index ex_exercise_facilities_type_idx on public.ex_exercise_facilities(amenity_id);
create table public.ex_variation_equipment (
 variation_id text not null references public.ex_variations(id),
 equipment_id text not null references public.ex_equipment_types(id), required boolean not null,
 primary key(variation_id,equipment_id)
);
create index ex_variation_equipment_type_idx on public.ex_variation_equipment(equipment_id);
create table public.ex_variation_facilities (
 variation_id text not null references public.ex_variations(id),
 amenity_id text not null references public.ao_amenity_types(id), required boolean not null,
 primary key(variation_id,amenity_id)
);
create index ex_variation_facilities_type_idx on public.ex_variation_facilities(amenity_id);
create table public.ex_formats (
 id text primary key check(btrim(id) <> ''), name text not null check(btrim(name) <> ''), instructions text not null check(btrim(instructions) <> ''), source_id text not null references public.ex_source_licenses(source_id), publication_status text not null default 'draft' check(publication_status in ('draft','reviewed','published')), revision integer not null default 1 check(revision > 0), protected boolean not null default false
);
create table public.ex_format_parameters (
 format_id text not null references public.ex_formats(id), parameter_key text not null check(btrim(parameter_key) <> ''),
 value_type text not null check(value_type in ('integer','number','text','boolean')), required boolean not null,
 minimum numeric, maximum numeric, primary key(format_id,parameter_key),
 check(minimum is null or maximum is null or minimum <= maximum),
 check(value_type in ('integer','number') or (minimum is null and maximum is null)),
 check(value_type <> 'integer' or ((minimum is null or minimum=trunc(minimum)) and (maximum is null or maximum=trunc(maximum))))
);
create index ex_exercises_source_id_idx on public.ex_exercises(source_id);
create index ex_variations_exercise_id_idx on public.ex_variations(exercise_id);
create index ex_variations_region_id_idx on public.ex_variations(region_id);
create index ex_variations_source_id_idx on public.ex_variations(source_id);
create index ex_aliases_exercise_id_idx on public.ex_aliases(exercise_id);
create index ex_aliases_variation_id_idx on public.ex_aliases(variation_id);
create index ex_aliases_region_id_idx on public.ex_aliases(region_id);
create index ex_aliases_source_id_idx on public.ex_aliases(source_id);
create index ex_counting_conventions_exercise_id_idx on public.ex_counting_conventions(exercise_id);
create index ex_counting_conventions_variation_id_idx on public.ex_counting_conventions(variation_id);
create index ex_counting_conventions_region_id_idx on public.ex_counting_conventions(region_id);
create index ex_counting_conventions_source_id_idx on public.ex_counting_conventions(source_id);
create index ex_formats_source_id_idx on public.ex_formats(source_id);
-- Invoker-only validation: operators cannot accidentally publish unlicensed content.
-- Revoking permission later is always allowed and immediately hides descendants via RLS.
create function public.ex_check_publication() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if new.publication_status = 'published' then
  if not exists(select 1 from public.ex_source_licenses l where l.source_id=new.source_id and l.redistribution_allowed and l.reviewed_at is not null) then
   raise exception 'Exicon source permission is required for publication' using errcode='23514';
  end if;
  if tg_table_name in ('ex_variations','ex_aliases','ex_counting_conventions') then
   if not exists(select 1 from public.ex_exercises e join public.ex_source_licenses l on l.source_id=e.source_id where e.id=new.exercise_id and e.publication_status='published' and l.redistribution_allowed and l.reviewed_at is not null) then
    raise exception 'Published canonical exercise is required' using errcode='23514';
   end if;
  end if;
  if tg_table_name in ('ex_aliases','ex_counting_conventions') then
   if new.variation_id is not null then
   if not exists(select 1 from public.ex_variations v join public.ex_source_licenses l on l.source_id=v.source_id where v.id=new.variation_id and v.exercise_id=new.exercise_id and v.publication_status='published' and l.redistribution_allowed and l.reviewed_at is not null and (v.region_id is null or v.region_id is not distinct from new.region_id)) then
    raise exception 'Published variation with matching regional scope is required' using errcode='23514';
   end if;
   end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function public.ex_check_publication() from public,anon,authenticated;
grant execute on function public.ex_check_publication() to service_role;
create trigger ex_exercises_publication before insert or update on public.ex_exercises for each row execute function public.ex_check_publication();
create trigger ex_variations_publication before insert or update on public.ex_variations for each row execute function public.ex_check_publication();
create trigger ex_aliases_publication before insert or update on public.ex_aliases for each row execute function public.ex_check_publication();
create trigger ex_counting_conventions_publication before insert or update on public.ex_counting_conventions for each row execute function public.ex_check_publication();
create trigger ex_formats_publication before insert or update on public.ex_formats for each row execute function public.ex_check_publication();
alter table public.ex_source_licenses enable row level security;
revoke all on public.ex_source_licenses from public,anon,authenticated;
grant select on public.ex_source_licenses to anon,authenticated;
grant all on public.ex_source_licenses to service_role;
create policy ex_source_licenses_public_read on public.ex_source_licenses for select to anon,authenticated using (redistribution_allowed and reviewed_at is not null);
create policy ex_source_licenses_operator on public.ex_source_licenses for all to service_role using(true) with check(true);
alter table public.ex_exercises enable row level security;
revoke all on public.ex_exercises from public,anon,authenticated;
grant select on public.ex_exercises to anon,authenticated;
grant all on public.ex_exercises to service_role;
create policy ex_exercises_public_read on public.ex_exercises for select to anon,authenticated using (publication_status='published' and exists(select 1 from public.ex_source_licenses l where l.source_id=ex_exercises.source_id));
create policy ex_exercises_operator on public.ex_exercises for all to service_role using(true) with check(true);
alter table public.ex_variations enable row level security;
revoke all on public.ex_variations from public,anon,authenticated;
grant select on public.ex_variations to anon,authenticated;
grant all on public.ex_variations to service_role;
create policy ex_variations_public_read on public.ex_variations for select to anon,authenticated using (publication_status='published' and exists(select 1 from public.ex_source_licenses l where l.source_id=ex_variations.source_id) and exists(select 1 from public.ex_exercises e where e.id=ex_variations.exercise_id));
create policy ex_variations_operator on public.ex_variations for all to service_role using(true) with check(true);
alter table public.ex_aliases enable row level security;
revoke all on public.ex_aliases from public,anon,authenticated;
grant select on public.ex_aliases to anon,authenticated;
grant all on public.ex_aliases to service_role;
create policy ex_aliases_public_read on public.ex_aliases for select to anon,authenticated using (publication_status='published' and exists(select 1 from public.ex_source_licenses l where l.source_id=ex_aliases.source_id) and exists(select 1 from public.ex_exercises e where e.id=ex_aliases.exercise_id) and (variation_id is null or exists(select 1 from public.ex_variations v where v.id=ex_aliases.variation_id and (v.region_id is null or v.region_id is not distinct from ex_aliases.region_id))));
create policy ex_aliases_operator on public.ex_aliases for all to service_role using(true) with check(true);
alter table public.ex_counting_conventions enable row level security;
revoke all on public.ex_counting_conventions from public,anon,authenticated;
grant select on public.ex_counting_conventions to anon,authenticated;
grant all on public.ex_counting_conventions to service_role;
create policy ex_counting_conventions_public_read on public.ex_counting_conventions for select to anon,authenticated using (publication_status='published' and exists(select 1 from public.ex_source_licenses l where l.source_id=ex_counting_conventions.source_id) and exists(select 1 from public.ex_exercises e where e.id=ex_counting_conventions.exercise_id) and (variation_id is null or exists(select 1 from public.ex_variations v where v.id=ex_counting_conventions.variation_id and (v.region_id is null or v.region_id is not distinct from ex_counting_conventions.region_id))));
create policy ex_counting_conventions_operator on public.ex_counting_conventions for all to service_role using(true) with check(true);
alter table public.ex_equipment_types enable row level security;
revoke all on public.ex_equipment_types from public,anon,authenticated;
grant select on public.ex_equipment_types to anon,authenticated;
grant all on public.ex_equipment_types to service_role;
create policy ex_equipment_types_public_read on public.ex_equipment_types for select to anon,authenticated using (true);
create policy ex_equipment_types_operator on public.ex_equipment_types for all to service_role using(true) with check(true);
alter table public.ex_exercise_equipment enable row level security;
revoke all on public.ex_exercise_equipment from public,anon,authenticated;
grant select on public.ex_exercise_equipment to anon,authenticated;
grant all on public.ex_exercise_equipment to service_role;
create policy ex_exercise_equipment_public_read on public.ex_exercise_equipment for select to anon,authenticated using (exists(select 1 from public.ex_exercises e where e.id=ex_exercise_equipment.exercise_id));
create policy ex_exercise_equipment_operator on public.ex_exercise_equipment for all to service_role using(true) with check(true);
alter table public.ex_exercise_facilities enable row level security;
revoke all on public.ex_exercise_facilities from public,anon,authenticated;
grant select on public.ex_exercise_facilities to anon,authenticated;
grant all on public.ex_exercise_facilities to service_role;
create policy ex_exercise_facilities_public_read on public.ex_exercise_facilities for select to anon,authenticated using (exists(select 1 from public.ex_exercises e where e.id=ex_exercise_facilities.exercise_id));
create policy ex_exercise_facilities_operator on public.ex_exercise_facilities for all to service_role using(true) with check(true);
alter table public.ex_variation_equipment enable row level security;
revoke all on public.ex_variation_equipment from public,anon,authenticated;
grant select on public.ex_variation_equipment to anon,authenticated;
grant all on public.ex_variation_equipment to service_role;
create policy ex_variation_equipment_public_read on public.ex_variation_equipment for select to anon,authenticated using (exists(select 1 from public.ex_variations v where v.id=ex_variation_equipment.variation_id));
create policy ex_variation_equipment_operator on public.ex_variation_equipment for all to service_role using(true) with check(true);
alter table public.ex_variation_facilities enable row level security;
revoke all on public.ex_variation_facilities from public,anon,authenticated;
grant select on public.ex_variation_facilities to anon,authenticated;
grant all on public.ex_variation_facilities to service_role;
create policy ex_variation_facilities_public_read on public.ex_variation_facilities for select to anon,authenticated using (exists(select 1 from public.ex_variations v where v.id=ex_variation_facilities.variation_id));
create policy ex_variation_facilities_operator on public.ex_variation_facilities for all to service_role using(true) with check(true);
alter table public.ex_formats enable row level security;
revoke all on public.ex_formats from public,anon,authenticated;
grant select on public.ex_formats to anon,authenticated;
grant all on public.ex_formats to service_role;
create policy ex_formats_public_read on public.ex_formats for select to anon,authenticated using (publication_status='published' and exists(select 1 from public.ex_source_licenses l where l.source_id=ex_formats.source_id));
create policy ex_formats_operator on public.ex_formats for all to service_role using(true) with check(true);
alter table public.ex_format_parameters enable row level security;
revoke all on public.ex_format_parameters from public,anon,authenticated;
grant select on public.ex_format_parameters to anon,authenticated;
grant all on public.ex_format_parameters to service_role;
create policy ex_format_parameters_public_read on public.ex_format_parameters for select to anon,authenticated using (exists(select 1 from public.ex_formats f where f.id=ex_format_parameters.format_id));
create policy ex_format_parameters_operator on public.ex_format_parameters for all to service_role using(true) with check(true);
commit;
