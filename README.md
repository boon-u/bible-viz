# Bible Viz — Bible Reading Visualizer

Track when and how often you've read each Bible verse, and see it at a glance.

No Bible text is stored — only references (`Book Chapter:Verse`), read counts,
and dates.

The app runs in two modes:

- **Local mode (no setup):** data lives in your browser's `localStorage`. Just
  `npm run dev` and go.
- **Cloud mode:** pick a profile name (Netflix-style, no passwords); reads sync
  via Supabase. Anyone can switch profiles to see everyone else's progress.
  Enabled by adding Supabase credentials (below).

## Run it

```bash
npm install
npm run dev      # open http://localhost:5173
```

## Cloud sync (optional)

Backend: **Supabase** (free tier — no credit card, covers a small group easily).
You do the account/credential steps; the app consumes the result. ~10 minutes.
No Google login or OAuth setup required.

### 1. Create the database

1. Sign up at [supabase.com](https://supabase.com) and create a new project
   (pick any region near you; save the database password somewhere).
2. Open **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. This creates
   the `profiles` and `reads` tables with open row-level-security policies (no
   login — anyone with the app URL can read/write all profiles).

   **Already ran an older schema?** Run
   [`supabase/migrations/001_add_avatar.sql`](supabase/migrations/001_add_avatar.sql)
   once to add the `avatar` column for emoji profile icons.

### 2. Point the app at your project

```bash
cp .env.example .env.local
```

Fill in `.env.local` with your **Project URL** and **publishable key** (Supabase
→ Project Settings → API). Restart `npm run dev`. You'll get a **Who's
reading?** screen — pick a profile or add your name and emoji avatar. After the
first pick, any reads already saved on that device are offered for one-click upload.

> `.env.local` is gitignored — your keys stay out of version control. The anon
> key is safe to ship in the browser; this model is intended for a small,
> trusted group on a private URL (anyone with access can edit any profile).

## The three views

- **Overview** — total stats, per-book coverage bars for all 66 books,
  a "most read verses" table (click a reference to jump to it in the book
  view, or expand its full date history), recent activity, and JSON
  export/import.
- **Book heatmap** — click any book card. Each chapter is a row, each verse a
  square; colour shows how many times you've read it (gray = unread,
  blue = 1×, warming up to red at 6×+). Click a square to see its read dates
  and quick-log a read of it today.
- **Log a read** — pick book, chapter, and date; tap one verse or tap two to
  select a range (or "Whole chapter"), then save.

## Data model

Reads are an append-only list of events. In the app each read looks like:

```json
{ "id": "…", "book": "Matthew", "chapter": 5, "start": 3, "end": 12, "date": "2026-07-04", "ts": 1720000000000 }
```

- `src/lib/store.js` — the `useReads({ supabase, profileId })` hook. Same API
  either way: when Supabase + a selected profile are present, reads live in the
  `reads` table scoped to that profile; otherwise they live in `localStorage`.
- `src/lib/profiles.js` — `useProfiles()`: list/create profiles, remember
  selection in localStorage.
- `src/lib/supabase.js` — creates the Supabase client from the env vars, or
  exports `null` (→ local mode) when they're absent.
- `supabase/schema.sql` — the database schema + row-level-security policies.
- `src/lib/aggregate.js` — derives per-verse counts, coverage, and top-verse
  stats from the event list.
- `src/data/bibleMeta.js` — verse counts per chapter for all 66 books
  (KJV versification: 1,189 chapters / 31,102 verses), generated from
  [aruljohn/Bible-kjv](https://github.com/aruljohn/Bible-kjv).

## Deploy

Works on any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages, etc.).

1. **Build:** `npm run build` → outputs to `dist/`
2. **Env vars on the host** (same names as `.env.local`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`)
3. **Database:** `schema.sql` applied in Supabase; run `001_add_avatar.sql` if
   profiles existed before emoji avatars.
4. **Smoke test after deploy:** open the URL → profile picker → create profile →
   log a read → confirm row appears in Supabase `reads` table.

> **Trust model:** RLS is fully open by design. Only deploy to a URL you share
> with a small, trusted group. The publishable key in the browser is normal for
> Supabase; it is not a secret, but anyone with the app URL can read/write all
> data.

## Notes

- Vite is pinned to v5 because this machine runs Node 20.14 (Vite 6+ needs
  20.19+). If you upgrade Node, feel free to upgrade Vite.
- Use **Export data (JSON)** on the Overview for backups. In local mode this
  matters most (localStorage is per-browser); in cloud mode your data is
  already on the server, but export still works for a portable copy.
