import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { modeShortLabel } from "../../game/canon";
import { formatTime } from "../../game/logic";
import { fetchLeaderboard, fetchPersonalStats } from "../../lib/scores";
import { supabase } from "../../lib/supabase";
import ProfileAvatar from "../ProfileAvatar";

export function LeaderboardPanel({ profile, onBack }) {
  const [tab, setTab] = useState("platform");
  const [modeFilter, setModeFilter] = useState("all-modes");
  const [leaderboard, setLeaderboard] = useState([]);
  const [personal, setPersonal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);

    const load = async () => {
      if (!supabase) return;
      if (tab === "platform") {
        const rows = await fetchLeaderboard(supabase, modeFilter);
        if (alive) setLeaderboard(rows);
      } else if (profile) {
        const stats = await fetchPersonalStats(supabase, profile.id);
        if (alive) setPersonal(stats);
      }
      if (alive) setLoading(false);
    };

    load();
    return () => {
      alive = false;
    };
  }, [tab, modeFilter, profile]);

  return (
    <motion.div
      className="leaderboard-panel"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="leaderboard-header">
        <button type="button" className="ghost-btn" onClick={onBack}>
          ← Back
        </button>
        <h2>Leaderboard</h2>
      </div>

      <div className="leaderboard-tabs">
        <button
          type="button"
          className={tab === "platform" ? "tab active" : "tab"}
          onClick={() => setTab("platform")}
        >
          🌍 Platform
        </button>
        <button
          type="button"
          className={tab === "personal" ? "tab active" : "tab"}
          onClick={() => setTab("personal")}
          disabled={!profile}
        >
          👤 My Record
        </button>
      </div>

      {tab === "platform" && (
        <div className="mode-filter">
          {["all-modes", "all", "ot", "nt"].map((m) => (
            <button
              key={m}
              type="button"
              className={modeFilter === m ? "filter-chip active" : "filter-chip"}
              onClick={() => setModeFilter(m)}
            >
              {m === "all-modes" ? "All modes" : modeShortLabel(m)}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="leaderboard-loading">Loading scores…</p>
      ) : tab === "platform" ? (
        <div className="leaderboard-list">
          {leaderboard.length === 0 ? (
            <p className="leaderboard-empty">No sessions yet — be the first!</p>
          ) : (
            leaderboard.map((entry, i) => (
              <div key={entry.id} className="leaderboard-row">
                <span className="rank">{i + 1}</span>
                <ProfileAvatar profile={entry.profile} size="chip" />
                <div className="leaderboard-meta">
                  <span className="leaderboard-name">{entry.profile.username}</span>
                  <span className="leaderboard-sub">
                    {entry.rounds_played} rounds · {modeShortLabel(entry.mode)}
                  </span>
                </div>
                <span className="leaderboard-score">{entry.total_score}</span>
              </div>
            ))
          )}
        </div>
      ) : personal ? (
        <div className="personal-stats">
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-value">{personal.roundsPlayed}</span>
              <span className="stat-label">Rounds</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{personal.bestSessionScore}</span>
              <span className="stat-label">Best session</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{personal.bestRoundScore}</span>
              <span className="stat-label">Best round</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{personal.totalScore}</span>
              <span className="stat-label">All-time pts</span>
            </div>
          </div>

          <h3>Recent rounds</h3>
          {personal.recentRounds.length === 0 ? (
            <p className="leaderboard-empty">No rounds yet — start training!</p>
          ) : (
            <div className="recent-rounds">
              {personal.recentRounds.map((r) => (
                <div key={r.id} className="recent-row">
                  <div className="recent-books">
                    <span>{r.start_book}</span>
                    <span className="recent-arrow">→</span>
                    <span>{r.target_book}</span>
                  </div>
                  <div className="recent-meta">
                    <span className={r.failed ? "recent-failed" : "recent-win"}>
                      {r.failed ? "Miss" : "Found"}
                    </span>
                    <span>{modeShortLabel(r.mode)}</span>
                    <span>{formatTime(r.elapsed_ms)}</span>
                    <strong>+{r.score}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="leaderboard-empty">Select a profile to see your record.</p>
      )}
    </motion.div>
  );
}
