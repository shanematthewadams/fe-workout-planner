-- Remove only Exicon objects. Export these rows first; never CASCADE into other schemas.
begin;
drop table public.ex_format_parameters;
drop table public.ex_formats;
drop table public.ex_variation_facilities;
drop table public.ex_variation_equipment;
drop table public.ex_exercise_facilities;
drop table public.ex_exercise_equipment;
drop table public.ex_equipment_types;
drop table public.ex_counting_conventions;
drop table public.ex_aliases;
drop table public.ex_variations;
drop table public.ex_exercises;
drop table public.ex_source_licenses;
drop function public.ex_check_publication();
commit;
