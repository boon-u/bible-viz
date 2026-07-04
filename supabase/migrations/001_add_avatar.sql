-- Run once in Supabase → SQL Editor if profiles already exists without avatar.
alter table public.profiles add column if not exists avatar text;

-- Refresh PostgREST schema cache so the API sees the new column immediately.
notify pgrst, 'reload schema';
