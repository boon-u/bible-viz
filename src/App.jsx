import { useEffect, useState } from "react";
import { useReads, readLocalReads } from "./lib/store";
import { useNotes } from "./lib/notes";
import { useAnnotations } from "./lib/annotations";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { useProfiles } from "./lib/profiles";
import Overview from "./components/Overview";
import LogRead from "./components/LogRead";
import BookView from "./components/BookView";
import ChapterReader from "./components/ChapterReader";
import NotesBrowser from "./components/NotesBrowser";
import NoteReader from "./components/NoteReader";
import GraphView from "./components/GraphView";
import CommandPalette from "./components/CommandPalette";
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
  const notesStore = useNotes({
    supabase: isSupabaseConfigured ? supabase : null,
    profileId: profiles.selected?.id,
  });
  const annoStore = useAnnotations({
    supabase: isSupabaseConfigured ? supabase : null,
    profileId: profiles.selected?.id,
  });
  // view: { name: "overview" } | { name: "log" } | { name: "notes", tag? }
  //     | { name: "note", noteId } | { name: "graph" }
  //     | { name: "book", book, focus?: {chapter, verse} }
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
  const openNoteById = (id) => setView({ name: "note", noteId: id });
  const openTopic = (tag) => setView({ name: "notes", tag });
  const openRead = (book, chapter) => setView({ name: "read", book, chapter });

  // Default reader location: the most recently read passage, else John 1.
  const openReadDefault = () => {
    const last = store.reads.length ? store.reads.reduce((a, b) => (b.ts > a.ts ? b : a)) : null;
    openRead(last?.book ?? "John", last?.chapter ?? 1);
  };

  // Navigate to a structured Scripture reference: focus the verse when known,
  // else open the book.
  const openRef = (ref) => {
    if (!ref?.book) return;
    if (ref.chapter && ref.verseStart) openBook(ref.book, { chapter: ref.chapter, verse: ref.verseStart });
    else openBook(ref.book);
  };

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
  const navItem = (name, label) => (
    <button
      className={view.name === name ? "nav-btn active" : "nav-btn"}
      onClick={() => setView({ name })}
    >
      {label}
    </button>
  );

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setView({ name: "overview" })}>
          <span className="brand-mark">✦</span> Bible Viz
        </button>
        <nav>
          {navItem("overview", "Overview")}
          <button
            className={view.name === "read" ? "nav-btn active" : "nav-btn"}
            onClick={openReadDefault}
          >
            Read
          </button>
          {navItem("notes", "Notes")}
          {navItem("graph", "Graph")}
          {navItem("log", "+ Log a read")}
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

      {view.name === "overview" && (
        <Overview store={store} notesStore={notesStore} profile={profile} onOpenBook={openBook} />
      )}
      {view.name === "log" && <LogRead store={store} />}
      {view.name === "read" && (
        <ChapterReader
          bookName={view.book}
          chapter={view.chapter}
          store={store}
          notesStore={notesStore}
          annoStore={annoStore}
          onOpenNote={openNoteById}
          onChangeLocation={openRead}
        />
      )}
      {view.name === "notes" && (
        <NotesBrowser key={view.tag ?? "all"} notes={notesStore.notes} initialTag={view.tag} onOpen={(n) => openNoteById(n.id)} />
      )}
      {view.name === "note" && (() => {
        const note = notesStore.notes.find((n) => n.id === view.noteId);
        if (!note) return <NotesBrowser notes={notesStore.notes} onOpen={(n) => openNoteById(n.id)} />;
        return (
          <NoteReader
            note={note}
            reads={store.reads}
            onOpenRef={openRef}
            onDelete={notesStore.deleteNote}
            onBack={() => setView({ name: "notes" })}
          />
        );
      })()}
      {view.name === "graph" && (
        <GraphView
          notes={notesStore.notes}
          reads={store.reads}
          theme={theme}
          onOpenNote={openNoteById}
          onOpenRef={openRef}
          onOpenTopic={openTopic}
        />
      )}
      {view.name === "book" && (
        <BookView
          bookName={view.book}
          focus={view.focus}
          store={store}
          notes={notesStore.notes}
          onOpenNote={(n) => openNoteById(n.id)}
          onBack={() => setView({ name: "overview" })}
        />
      )}

      <CommandPalette
        notes={notesStore.notes}
        onOpenNote={openNoteById}
        onOpenRef={openRef}
        onOpenTopic={openTopic}
      />
    </div>
  );
}
