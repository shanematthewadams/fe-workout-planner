-- Leaves all catalog rows/tables and the planner fallback intact.
begin;
drop function public.fe_exicon_catalog();
commit;
