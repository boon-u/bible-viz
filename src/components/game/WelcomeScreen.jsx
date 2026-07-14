import { motion } from "framer-motion";
import { modeDescription } from "../../game/canon";
import { isSupabaseConfigured } from "../../lib/supabase";
import ProfileAvatar from "../ProfileAvatar";

const MODES = ["all", "ot", "nt"];

export function WelcomeScreen({
  highScore,
  mode,
  onModeChange,
  profile,
  onShowLeaderboard,
  onStart,
}) {
  return (
    <motion.div
      className="welcome"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {profile && (
        <div className="welcome-profile">
          <ProfileAvatar profile={profile} size="chip" />
          <span>Playing as {profile.username}</span>
        </div>
      )}

      <motion.div
        className="welcome-mascot"
        animate={{ y: [0, -10, 0], rotate: [0, 3, -3, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
      >
        📚
      </motion.div>

      <h1>Bible Blitz</h1>
      <p className="welcome-subtitle">Master the order of Bible books using binary search!</p>

      <div className="canon-picker">
        <p className="canon-label">Choose your canon</p>
        <div className="canon-options">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              className={mode === m ? "canon-btn active" : "canon-btn"}
              onClick={() => onModeChange(m)}
            >
              <span className="canon-btn-title">
                {m === "all"
                  ? "📖 Whole Bible"
                  : m === "ot"
                    ? "📜 Old Testament"
                    : "✝️ New Testament"}
              </span>
              <span className="canon-btn-desc">{modeDescription(m)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="welcome-rules">
        <div className="rule">
          <span className="rule-icon">📍</span>
          <div>
            <strong>Start somewhere</strong>
            <p>You begin at one book and must find your target.</p>
          </div>
        </div>
        <div className="rule">
          <span className="rule-icon">⌨️</span>
          <div>
            <strong>Keyboard friendly</strong>
            <p>Use ← and → arrow keys to pick Earlier or Later.</p>
          </div>
        </div>
        <div className="rule">
          <span className="rule-icon">⭐</span>
          <div>
            <strong>Score big</strong>
            <p>+25 per correct move, −15 for wrong turns, speed bonuses too!</p>
          </div>
        </div>
      </div>

      {!isSupabaseConfigured && highScore > 0 && (
        <p className="welcome-highscore">🏆 Local best: {highScore}</p>
      )}

      <div className="welcome-actions">
        <motion.button
          type="button"
          className="primary-btn start-btn"
          onClick={onStart}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Start Training
        </motion.button>

        {isSupabaseConfigured && (
          <button type="button" className="ghost-btn leaderboard-btn" onClick={onShowLeaderboard}>
            🏆 Leaderboard
          </button>
        )}
      </div>
    </motion.div>
  );
}
