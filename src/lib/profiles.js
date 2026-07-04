import { useCallback, useEffect, useState } from "react";
import { PROFILE_EMOJIS, formatProfileError } from "./profileDisplay";

const PROFILE_KEY = "bible-viz:profile-id";

const PROFILE_COLORS = [
  "#4f8ef7",
  "#22c55e",
  "#f43f5e",
  "#a855f7",
  "#f97316",
  "#06b6d4",
  "#eab308",
  "#ec4899",
];

function readStoredProfileId() {
  try {
    return localStorage.getItem(PROFILE_KEY);
  } catch {
    return null;
  }
}

function storeProfileId(id) {
  try {
    if (id) localStorage.setItem(PROFILE_KEY, id);
    else localStorage.removeItem(PROFILE_KEY);
  } catch {
    // storage unavailable; selection still works for the session
  }
}

// Netflix-style profiles: pick a name, no passwords. Everyone can see
// everyone's progress by switching profiles.
export function useProfiles(supabase) {
  const [profiles, setProfiles] = useState([]);
  const [selectedId, setSelectedId] = useState(readStoredProfileId);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    setLoading(true);
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) console.error("Failed to load profiles:", error.message);
        else setProfiles(data ?? []);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [supabase]);

  const selectProfile = useCallback((id) => {
    setSelectedId(id);
    storeProfileId(id);
  }, []);

  const clearProfile = useCallback(() => {
    setSelectedId(null);
    storeProfileId(null);
  }, []);

  const createProfile = useCallback(
    async ({ username, avatar }) => {
      const trimmed = username.trim();
      if (!trimmed) throw new Error("Enter a name");
      if (trimmed.length > 32) throw new Error("Name must be 32 characters or less");

      const pickedAvatar = PROFILE_EMOJIS.includes(avatar) ? avatar : PROFILE_EMOJIS[0];
      const color = PROFILE_COLORS[Math.floor(Math.random() * PROFILE_COLORS.length)];
      const { data, error } = await supabase
        .from("profiles")
        .insert({ username: trimmed, avatar: pickedAvatar, color })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") throw new Error("That name is already taken");
        throw new Error(formatProfileError(error.message));
      }

      setProfiles((prev) => [...prev, data]);
      selectProfile(data.id);
      return data;
    },
    [supabase, selectProfile],
  );

  const selected = profiles.find((p) => p.id === selectedId) ?? null;

  // Drop stale selection if the profile was deleted server-side.
  useEffect(() => {
    if (!loading && selectedId && profiles.length > 0 && !selected) {
      clearProfile();
    }
  }, [loading, selectedId, selected, profiles.length, clearProfile]);

  return {
    profiles,
    selected,
    loading,
    selectProfile,
    clearProfile,
    createProfile,
  };
}
