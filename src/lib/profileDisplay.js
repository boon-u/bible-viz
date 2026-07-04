// Curated emoji avatars — faith, nature, faces, animals, symbols, etc.
export const PROFILE_EMOJIS = [
  // Faith & reading
  "📖", "✝️", "🕊️", "⛪", "🙏", "🕯️", "✨", "🌟", "💫", "🍞", "🍷", "👼", "📜", "🛐",
  // Faces & mood
  "😀", "😊", "😎", "🤗", "🥰", "😇", "🤓", "🙂", "😌", "🤠", "🥳", "😺", "🐶", "🐱",
  // Nature
  "🌅", "🌄", "🌈", "🌊", "🌿", "🌸", "🌺", "🌻", "🍃", "🌲", "🌴", "🌙", "☀️", "⭐",
  // Animals
  "🦁", "🐑", "🕊", "🦋", "🐝", "🦅", "🐢", "🐠", "🦄", "🐘", "🦊", "🐻", "🐼", "🐨",
  // Hearts & colors
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💗", "💖", "💝", "🔥", "⚡", "💎",
  // Objects & hobbies
  "🎵", "🎸", "🎨", "📚", "✏️", "🏠", "☕", "🍎", "🌾", "🎯", "🏆", "🎁", "🧭", "🔔",
  // Symbols
  "♾️", "☮️", "⚓", "🗝️", "🔆", "💡", "🪴", "🧸", "🎈", "🪶", "🏔️", "🌋", "🗻", "🏝️",
];

export function profileDisplay(profile) {
  if (profile?.avatar) return profile.avatar;
  const name = profile?.username?.trim();
  return name ? name.charAt(0).toUpperCase() : "?";
}

export function profileHasEmoji(profile) {
  return Boolean(profile?.avatar);
}

export function formatProfileError(message) {
  if (/avatar.*schema cache|Could not find the 'avatar' column/i.test(message)) {
    return (
      "Database is missing the avatar column. In Supabase → SQL Editor, run: " +
      "alter table public.profiles add column if not exists avatar text; " +
      "NOTIFY pgrst, 'reload schema';"
    );
  }
  return message;
}
