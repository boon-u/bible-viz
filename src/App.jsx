import { useEffect, useState } from "react";
import { useReads, readLocalReads } from "./lib/store";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { useProfiles } from "./lib/profiles";
import Overview from "./components/Overview";
import LogRead from "./components/LogRead";
import BookView from "./components/BookView";
import ProfilePicker from "./components/ProfilePicker";
import ProfileAvatar from "./components/ProfileAvatar";

const THEME_KEY = "bible-viz:theme";

function initialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export default function App() {
  const profiles = useProfiles(isSupabaseConfigured ? supabase : null);
  const store = useReads({
    supabase: isSupabaseConfigured ? supabase : null,
    profileId: profiles.selected?.id,
  });
  // view: { name: "overview" } | { name: "log" } | { name: "book", book, focus?: {chapter, verse} }
  const [view, setView] = useState({ name: "overview" });
  const [theme, setTheme] = useState(initialTheme);
  const [migrateCount, setMigrateCount] = useState(0);
  const [migrateDone, setMigrateDone] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // storage unavailable; theme still applies for this session
    }
  }, [theme]);

  // After picking a profile, if this device has local reads and the cloud profile
  // is empty, offer a one-time upload so nothing logged before sync is lost.
  useEffect(() => {
    if (!store.cloud || !store.ready || migrateDone) return;
    if (store.reads.length > 0) return;
    const local = readLocalReads();
    if (local.length > 0) setMigrateCount(local.length);
  }, [store.cloud, store.ready, store.reads.length, migrateDone]);

  const uploadLocal = async () => {
    try {
      await store.importReads(JSON.stringify(readLocalReads()));
      setMigrateCount(0);
      setMigrateDone(true);
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    }
  };

  const openBook = (book, focus) => setView({ name: "book", book, focus });

  if (isSupabaseConfigured && profiles.loading) return null;
  if (isSupabaseConfigured && !profiles.selected) {
    return (
      <ProfilePicker
        profiles={profiles.profiles}
        onSelect={profiles.selectProfile}
        onCreate={profiles.createProfile}
      />
    );
  }

  if (!store.ready) return null;

  const profile = profiles.selected;

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setView({ name: "overview" })}>
          <span className="brand-mark">✦</span> Bible Viz
        </button>
        <nav>
          <button
            className={view.name === "overview" ? "nav-btn active" : "nav-btn"}
            onClick={() => setView({ name: "overview" })}
          >
            Overview
          </button>
          <button
            className={view.name === "log" ? "nav-btn active" : "nav-btn"}
            onClick={() => setView({ name: "log" })}
          >
            + Log a read
          </button>
          <button
            className="nav-btn theme-btn"
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          {isSupabaseConfigured && profile && (
            <div className="profile-chip">
              <ProfileAvatar profile={profile} size="chip" />
              <span className="profile-name">{profile.username}</span>
              <button
                className="switch-btn"
                title="Switch profile"
                onClick={profiles.clearProfile}
              >
                Switch
              </button>
            </div>
          )}
        </nav>
      </header>

      {migrateCount > 0 && (
        <div className="migrate-banner">
          <span>
            Found <strong>{migrateCount}</strong> read{migrateCount === 1 ? "" : "s"} saved on this
            device. Add {migrateCount === 1 ? "it" : "them"} to{" "}
            <strong>{profile?.username ?? "this profile"}</strong>?
          </span>
          <div className="migrate-actions">
            <button className="primary-btn" onClick={uploadLocal}>
              Upload
            </button>
            <button
              className="ghost-btn"
              onClick={() => {
                setMigrateCount(0);
                setMigrateDone(true);
              }}
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {view.name === "overview" && <Overview store={store} onOpenBook={openBook} />}
      {view.name === "log" && <LogRead store={store} />}
      {view.name === "book" && (
        <BookView
          bookName={view.book}
          focus={view.focus}
          store={store}
          onBack={() => setView({ name: "overview" })}
        />
      )}
    </div>
  );
}
