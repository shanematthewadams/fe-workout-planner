-- Rollback only the new review layer. Existing snapshots/catalog/users remain intact.
begin;
drop function public.fe_exicon_planner_catalog();
drop table public.ex_codex_planner_links;
drop function if exists public.fe_codex_text_review_fingerprint(text);
drop function public.fe_exicon_review_fingerprint(text,text);
commit;
-- To withdraw just the newly reviewed 42 movement rows instead, revoke their internal publication authorization:
-- update public.ex_source_licenses set redistribution_allowed=false where source_id='f3-q-builder-reviewed-planner-v1';
-- No deletion or restoration of existing user tables is appropriate.
