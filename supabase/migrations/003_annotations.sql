-- Bible Viz — annotations migration (paper-Bible layer over the chapter reader)
--
-- Run once in Supabase → SQL Editor. Additive: leaves profiles / reads / notes /
-- note_refs untouched. One flexible, profile-scoped table backs every annotation
-- kind on the reader — highlights now, freeform ink / text boxes / arrows later.
--
--   kind='highlight'  anchor = {verse, start, end}   (char offsets into the verse;
--                     a whole-verse highlight is start:0..end:length), color set.
--   kind='textbox'    geometry = {x, y, width}, text = content        (later stage)
--   kind='ink'        geometry = {paths, width}, transcription = text (later stage)
--   kind='arrow'      geometry = {from:{x,y}, to:{x,y}}               (later stage)
--
-- Like notes, annotations are personal: scoped to the authoring profile via
-- profile_id; RLS is open (small trusted group) but the app filters by profile.

create table if not exists public.annotations (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  book          text not null,
  chapter       integer not null,
  kind          text not null,
  color         text,
  anchor        jsonb,
  geometry      jsonb,
  text          text,
  transcription text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists annotations_profile_id_idx on public.annotations (profile_id);
create index if not exists annotations_loc_idx        on public.annotations (profile_id, book, chapter);

grant all on public.annotations to anon, authenticated;
alter table public.annotations enable row level security;

create policy "annotations are public"        on public.annotations for select using (true);
create policy "anyone can add an annotation"   on public.annotations for insert with check (true);
create policy "anyone can update an annotation" on public.annotations for update using (true) with check (true);
create policy "anyone can delete an annotation" on public.annotations for delete using (true);
