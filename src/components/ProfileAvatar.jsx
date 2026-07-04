import { profileDisplay, profileHasEmoji } from "../lib/profileDisplay";

export default function ProfileAvatar({ profile, size = "tile", className = "" }) {
  const emoji = profileHasEmoji(profile);
  const sizeClass = size === "chip" ? "profile-avatar profile-avatar-chip" : "profile-tile-avatar";
  const emojiClass = emoji ? " profile-avatar-emoji" : "";

  return (
    <span
      className={`${sizeClass}${emojiClass} ${className}`.trim()}
      style={!emoji ? { background: profile.color ?? "var(--accent)" } : undefined}
      aria-hidden="true"
    >
      {profileDisplay(profile)}
    </span>
  );
}
