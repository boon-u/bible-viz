-- Bible Viz — Supabase schema (shared-profiles model, no login)
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

-- ── Bible Blitz game (embedded feature) ────────────────────────────────
-- A "session" groups the rounds played in one sitting; each round result is
-- stored individually. Both are keyed to a profile (the same profiles table
-- above — the game inherits whichever profile is selected in the app).

create table if not exists public.trainer_sessions (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  mode           text not null check (mode in ('all', 'ot', 'nt')),
  total_score    integer not null default 0,
  rounds_played  integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.trainer_rounds (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  session_id     uuid references public.trainer_sessions (id) on delete set null,
  mode           text not null check (mode in ('all', 'ot', 'nt')),
  start_book     text not null,
  target_book    text not null,
  score          integer not null,
  moves          integer not null,
  correct_moves  integer not null,
  wrong_moves    integer not null,
  elapsed_ms     integer not null,
  failed         boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists trainer_sessions_profile_id_idx  on public.trainer_sessions (profile_id);
create index if not exists trainer_sessions_total_score_idx on public.trainer_sessions (total_score desc);
create index if not exists trainer_rounds_profile_id_idx    on public.trainer_rounds (profile_id);
create index if not exists trainer_rounds_score_idx         on public.trainer_rounds (score desc);
create index if not exists trainer_rounds_created_at_idx    on public.trainer_rounds (created_at desc);

grant all on public.trainer_sessions to anon, authenticated;
grant all on public.trainer_rounds to anon, authenticated;

alter table public.trainer_sessions enable row level security;
alter table public.trainer_rounds enable row level security;

do $$ begin
  create policy "sessions are public"      on public.trainer_sessions for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "anyone can create a session" on public.trainer_sessions for insert with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "anyone can update a session" on public.trainer_sessions for update using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "rounds are public"        on public.trainer_rounds for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "anyone can add a round"   on public.trainer_rounds for insert with check (true);
exception when duplicate_object then null; end $$;
