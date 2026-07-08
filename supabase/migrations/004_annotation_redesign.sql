-- Bible Viz — annotation redesign migration
--
-- Run once in Supabase → SQL Editor. Additive; existing data survives.
--
-- Highlights become range-based (a session can span verses) and gain a drawing
-- style; notes can be attached to a highlight and can link to other notes.
--
--   annotations.style       'fill' (color behind the words) | 'scribble' (hand-
--                           drawn outline). Existing rows default to 'fill'.
--   annotations.anchor      now { startVerse, startOffset, endVerse, endOffset }
--                           for highlights (old {verse,start,end} still readable;
--                           the app treats it as a single-verse range).
--   notes.annotation_id     the highlight a note was created from (nullable).
--   notes.linked_notes      jsonb array of note ids for note-to-note links.

alter table public.annotations add column if not exists style text not null default 'fill';

alter table public.notes add column if not exists annotation_id uuid;
alter table public.notes add column if not exists linked_notes jsonb not null default '[]'::jsonb;

create index if not exists notes_annotation_id_idx on public.notes (annotation_id);
