-- Export catalog first; dropping these tables loses catalog edits. Never use CASCADE.
-- Old app remains supported by JSON. Existing user tables are not affected.
begin;
drop table public.ao_landmark_links;
drop table public.ao_landmarks;
drop table public.ao_venue_amenities;
drop table public.ao_amenity_types;
drop table public.ao_nation_defaults;
drop table public.ao_venue_assignments;
drop table public.ao_official_locations;
drop table public.ao_venues;
drop table public.ao_sites;
drop table public.ao_regions;
drop table public.ao_sources;
commit;
