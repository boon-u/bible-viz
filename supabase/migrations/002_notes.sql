-- Bible Viz — notes migration (study-notebook feature)
--
-- Run once in Supabase → SQL Editor → New query → paste → Run. Additive: it does
-- NOT touch the existing `profiles` / `reads` tables, so your reading data is safe.
--
-- Adds three tables:
--   notes            — one study note, anchored to a book/chapter/verse (or none
--                      for a pure topic note), body is Markdown, tags for topics.
--   note_refs        — cross-references: passages a note points to (graph edges).
--   note_attachments — RESERVED for a future images/scribbled-PDF feature. Created
--                      now so that feature is purely additive; NO app UI uses it yet.
--
-- Model note: unlike `reads` (shared across the group), notes are personal prep
-- material. They stay scoped to the authoring profile via `profile_id`; RLS is
-- still open (small trusted group) but the app always filters by the current
-- profile, so you only see your own notes.

-- ── Notes ───────────────────────────────────────────────────────────────
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  book        text,                         -- null ⇒ pure topic note
  chapter     integer,                      -- null ⇒ book-level note
  verse_start integer,                      -- null ⇒ chapter-level note
  verse_end   integer,
  category    text not null default 'general',
  title       text not null,
  body        text not null default '',     -- Markdown
  tags        text[] not null default '{}',
  source      text,                         -- e.g. 'ai', an author name, a book
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists notes_profile_id_idx on public.notes (profile_id);
create index if not exists notes_anchor_idx      on public.notes (book, chapter, verse_start);

-- ── Cross-references (graph edges) ──────────────────────────────────────
create table if not exists public.note_refs (
  id          uuid primary key default gen_random_uuid(),
  note_id     uuid not null references public.notes (id) on delete cascade,
  book        text not null,
  chapter     integer,
  verse_start integer,
  verse_end   integer,
  label       text                          -- optional human label for the ref
);

create index if not exists note_refs_note_id_idx on public.note_refs (note_id);
create index if not exists note_refs_target_idx  on public.note_refs (book, chapter, verse_start);

-- ── Attachments (RESERVED — no app UI yet) ──────────────────────────────
-- Present so a future images / scribbled-PDF feature needs no schema rework.
-- Files would live in a Supabase Storage bucket; `storage_path` points at them.
create table if not exists public.note_attachments (
  id           uuid primary key default gen_random_uuid(),
  note_id      uuid not null references public.notes (id) on delete cascade,
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  kind         text not null,               -- 'image' | 'pdf'
  storage_path text not null,
  filename     text,
  mime         text,
  size         bigint,
  created_at   timestamptz not null default now()
);

create index if not exists note_attachments_note_id_idx on public.note_attachments (note_id);

-- ── Open access (same trust model as reads) ─────────────────────────────
grant all on public.notes            to anon, authenticated;
grant all on public.note_refs        to anon, authenticated;
grant all on public.note_attachments to anon, authenticated;

alter table public.notes            enable row level security;
alter table public.note_refs        enable row level security;
alter table public.note_attachments enable row level security;

create policy "notes are public"            on public.notes for select using (true);
create policy "anyone can add a note"       on public.notes for insert with check (true);
create policy "anyone can update a note"    on public.notes for update using (true) with check (true);
create policy "anyone can delete a note"    on public.notes for delete using (true);

create policy "note_refs are public"        on public.note_refs for select using (true);
create policy "anyone can add a note_ref"   on public.note_refs for insert with check (true);
create policy "anyone can update a note_ref" on public.note_refs for update using (true) with check (true);
create policy "anyone can delete a note_ref" on public.note_refs for delete using (true);

create policy "attachments are public"      on public.note_attachments for select using (true);
create policy "anyone can add attachment"   on public.note_attachments for insert with check (true);
create policy "anyone can update attachment" on public.note_attachments for update using (true) with check (true);
create policy "anyone can delete attachment" on public.note_attachments for delete using (true);
