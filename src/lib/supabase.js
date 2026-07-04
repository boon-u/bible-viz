import { createClient } from "@supabase/supabase-js";

// Credentials come from .env.local (see .env.example). When they are absent
// the app runs in local-only mode (localStorage) so it still works with no setup.
const url = import.meta.env.VITE_SUPABASE_URL;
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && key);

export const supabase = isSupabaseConfigured ? createClient(url, key) : null;
