import { useState } from "react";
import { PROFILE_EMOJIS } from "../lib/profileDisplay";
import ProfileAvatar from "./ProfileAvatar";

function ProfileTile({ profile, onSelect }) {
  return (
    <button className="profile-tile" onClick={() => onSelect(profile.id)}>
      <ProfileAvatar profile={profile} />
      <span className="profile-tile-name">{profile.username}</span>
    </button>
  );
}

export default function ProfilePicker({ profiles, onSelect, onCreate }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(PROFILE_EMOJIS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setAdding(false);
    setName("");
    setAvatar(PROFILE_EMOJIS[0]);
    setError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onCreate({ username: name, avatar });
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile-screen">
      <div className="profile-screen-inner">
        <h1 className="profile-screen-title">
          <span className="brand-mark">✦</span> Who&apos;s reading?
        </h1>
        <p className="profile-screen-tagline">
          Pick your profile to track progress, or add a new one with a name and
          emoji avatar. Switch anytime to see everyone&apos;s stats.
        </p>

        <div className="profile-grid">
          {profiles.map((p) => (
            <ProfileTile key={p.id} profile={p} onSelect={onSelect} />
          ))}

          {!adding && (
            <button className="profile-tile profile-tile-add" onClick={() => setAdding(true)}>
              <span className="profile-tile-avatar profile-tile-avatar-add">+</span>
              <span className="profile-tile-name">Add profile</span>
            </button>
          )}
        </div>

        {adding && (
          <form className="profile-add-panel" onSubmit={submit}>
            <div className="profile-add-preview">
              <span className="profile-add-preview-emoji" aria-hidden="true">
                {avatar}
              </span>
              <span className="profile-add-preview-label">Your avatar</span>
            </div>

            <p className="profile-add-label">
              Pick one ({PROFILE_EMOJIS.length} options)
            </p>
            <div className="emoji-picker" role="listbox" aria-label="Profile avatar">
              {PROFILE_EMOJIS.map((emoji, i) => (
                <button
                  key={`${i}-${emoji}`}
                  type="button"
                  role="option"
                  aria-selected={avatar === emoji}
                  aria-label={`Avatar ${emoji}`}
                  className={avatar === emoji ? "emoji-option selected" : "emoji-option"}
                  onClick={() => setAvatar(emoji)}
                  disabled={busy}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <input
              className="profile-add-input"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              autoFocus
              disabled={busy}
            />
            <div className="profile-add-actions">
              <button type="submit" className="primary-btn" disabled={busy || !name.trim()}>
                {busy ? "Creating…" : "Create profile"}
              </button>
              <button type="button" className="ghost-btn" disabled={busy} onClick={resetForm}>
                Cancel
              </button>
            </div>
            {error && <p className="profile-add-error">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
