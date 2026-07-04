-- Verse Trail — Supabase schema (shared-profiles model, no login)
--
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- This REPLACES the earlier auth-based schema: it drops the old profiles/reads
-- tables and the signup trigger. Run it before you have data you want to keep.
--
-- Model: no passwords. Anyone opening the app picks a profile (a name) or makes
-- a new one, Netflix-style. Everyone can see everyone's progress. Access is
-- fully open via the public anon key + permissive row-level-security policies.

-- ── Remove the old auth-based objects, if present ──────────────────────
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.reads;
drop table if exists public.profiles;

-- ── Profiles: pick-a-name ──────────────────────────────────────────────
create table public.profiles (
  id         uuid primary key default gen_random_uuid(),
  username   text not null unique,
  avatar     text,
  color      text,
  created_at timestamptz not null default now()
);

-- ── Reads: one row per verse-read event, owned by a profile ────────────
create table public.reads (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  book        text not null,
  chapter     integer not null,
  verse_start integer not null,
  verse_end   integer not null,
  date        date not null,
  ts          bigint not null,
  created_at  timestamptz not null default now()
);

create index reads_profile_id_idx on public.reads (profile_id);

-- ── Open access ────────────────────────────────────────────────────────
-- No login, so every request comes in as the anon role. RLS stays enabled
-- with permissive policies so the app can read/write freely. (This means
-- anyone with the app can edit or delete any profile's data — intended for a
-- small, trusted group on a private URL.)
grant all on public.profiles to anon, authenticated;
grant all on public.reads to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.reads enable row level security;

create policy "profiles are public"          on public.profiles for select using (true);
create policy "anyone can create a profile"  on public.profiles for insert with check (true);
create policy "anyone can update a profile"  on public.profiles for update using (true) with check (true);
create policy "anyone can delete a profile"  on public.profiles for delete using (true);

create policy "reads are public"             on public.reads for select using (true);
create policy "anyone can add a read"        on public.reads for insert with check (true);
create policy "anyone can update a read"     on public.reads for update using (true) with check (true);
create policy "anyone can delete a read"     on public.reads for delete using (true);
