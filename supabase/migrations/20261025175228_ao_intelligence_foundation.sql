-- Additive catalog only. Does not touch workouts, beatdowns, auth or fe_profiles.
begin;
create table public.ao_sources (
 id text primary key, kind text not null check(kind in ('nation','local_inventory','review')),
 url text not null, captured_at timestamptz not null, description text not null
);
create table public.ao_regions (
 id text primary key, name text not null, nation_org_id bigint unique,
 source_id text not null references public.ao_sources(id), configuration jsonb not null default '{}'
);
create table public.ao_sites (
 id text primary key, region_id text not null references public.ao_regions(id), name text not null,
 nation_org_id bigint unique, activity text not null check(activity in ('bootcamp','run','ruck')),
 ruck_option boolean not null default false,
 location_mode text not null check(location_mode in ('fixed','site_q_selected','rotating')),
 planning_mode text not null, warmup text not null, mary text not null, cot text not null,
 schedule_reference text not null, source_id text not null references public.ao_sources(id),
 unique(region_id,name)
);
create index ao_sites_region_idx on public.ao_sites(region_id);
create table public.ao_venues (
 id text primary key, name text not null, address text, lighting text, access_notes text,
 terrain_notes text, source_id text not null references public.ao_sources(id), unique(name,address)
);
-- Official pins belong to the upstream meeting location, not an invented venue centroid.
create table public.ao_official_locations (
 nation_location_id bigint primary key, name text not null,
 latitude double precision check(latitude between -90 and 90),
 longitude double precision check(longitude between -180 and 180),
 source_id text not null references public.ao_sources(id),
 check((latitude is null) = (longitude is null))
);
create table public.ao_venue_assignments (
 id text primary key, ao_id text not null references public.ao_sites(id),
 venue_id text not null references public.ao_venues(id),
 meeting_point text not null, precision text not null, season_label text not null,
 lighting_notes text, access_notes text, terrain_notes text, route_notes text, local_notes text,
 selection text not null check(selection in ('default','site_q_required')),
 effective_from date, effective_until date,
 source_id text not null references public.ao_sources(id),
 unique(ao_id,venue_id), check(effective_until is null or effective_from is null or effective_until >= effective_from)
);
create unique index ao_one_default_venue_idx on public.ao_venue_assignments(ao_id) where selection='default';
create index ao_assignments_venue_idx on public.ao_venue_assignments(venue_id);
-- Upstream default pins are retained separately: they cannot select a seasonal venue.
create table public.ao_nation_defaults (
 ao_id text primary key references public.ao_sites(id),
 nation_location_id bigint not null references public.ao_official_locations(nation_location_id)
);
create index ao_nation_defaults_location_idx on public.ao_nation_defaults(nation_location_id);
create table public.ao_amenity_types (
 id text primary key, name text not null unique
);
create table public.ao_venue_amenities (
 id text primary key, venue_id text not null references public.ao_venues(id),
 amenity_id text not null references public.ao_amenity_types(id),
 availability text not null check(availability in ('present','absent','unknown','restricted')),
 verification text not null check(verification in ('reported','unverified','reviewed')),
 evidence text not null, source_id text not null references public.ao_sources(id),
 unique(venue_id,amenity_id),
 check(availability = 'unknown' or verification <> 'unverified')
);
create index ao_amenities_type_idx on public.ao_venue_amenities(amenity_id);
create table public.ao_landmarks (
 id text primary key, name text not null, venue_id text references public.ao_venues(id),
 description text not null, kind text not null, use_cases text not null, surface text, lighting text,
 restrictions text, precision text not null default 'description_only',
 verification text not null check(verification in ('reported','unverified','reviewed')),
 source_id text not null references public.ao_sources(id), evidence text not null
);
create index ao_landmarks_venue_idx on public.ao_landmarks(venue_id);
create table public.ao_landmark_links (
 id text primary key, ao_id text not null references public.ao_sites(id),
 landmark_id text not null references public.ao_landmarks(id),
 proximity text not null check(proximity in ('on_site','nearby','unknown')),
 unique(ao_id,landmark_id)
);
create index ao_landmark_links_landmark_idx on public.ao_landmark_links(landmark_id);
-- Catalog administration is server/database-operator only in Sprint 1. No client write grant,
-- no user/profile based admin escalation, no privileged public functions or bypassing views.
do $$ declare t text; begin
 foreach t in array array['ao_sources','ao_regions','ao_sites','ao_venues','ao_official_locations',
 'ao_venue_assignments','ao_nation_defaults','ao_amenity_types','ao_venue_amenities','ao_landmarks','ao_landmark_links'] loop
 if t not in ('ao_sources','ao_nation_defaults','ao_amenity_types','ao_landmark_links') then
 execute format('create index %I on public.%I(source_id)',t || '_source_idx',t);
 end if;
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public, anon, authenticated',t);
 execute format('grant select on public.%I to anon, authenticated',t);
 execute format('create policy catalog_read on public.%I for select to anon, authenticated using (true)',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy catalog_operator on public.%I for all to service_role using (true) with check (true)',t);
 end loop;
end $$;
commit;
