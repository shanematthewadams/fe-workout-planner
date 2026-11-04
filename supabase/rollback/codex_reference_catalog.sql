-- Disable public reference reads first: update ex_codex_reuse set enabled=false where source_id='f3-nation-codex-reference-v1';
-- Full rollback drops only this reference corpus, never reviewed planner exercises or user data.
begin;
drop function public.fe_codex_reference();
drop table public.ex_codex_mentions;
drop policy ex_codex_tags_read on public.ex_codex_tags;
drop table public.ex_codex_entry_tags;
drop table public.ex_codex_tags;
drop table public.ex_codex_aliases;
drop table public.ex_codex_entries;
drop table public.ex_codex_reuse;
commit;
