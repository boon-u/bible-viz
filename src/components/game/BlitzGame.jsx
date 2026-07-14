import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GameBoard } from "./GameBoard";
import { BibleTimeline } from "./BibleTimeline";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { RoundComplete } from "./RoundComplete";
import { WelcomeScreen } from "./WelcomeScreen";
import { applyMove, createRound, getHighScore, saveHighScore, timeBonus } from "../../game/logic";
import { createSession, saveRoundResult } from "../../lib/scores";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import "../../blitz.css";

// Bible Blitz — a binary-search training game, embedded as a feature of Bible
// Viz. The active profile is inherited from the parent app (passed in as a
// prop) rather than chosen here, so there is no profile picker or switcher.
export default function BlitzGame({ profile }) {
  const [screen, setScreen] = useState("welcome");
  const [canonMode, setCanonMode] = useState("all");
  const [round, setRound] = useState(() => createRound("all"));
  const [totalScore, setTotalScore] = useState(0);
  const [highScore, setHighScore] = useState(getHighScore);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [roundBonus, setRoundBonus] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const sessionIdRef = useRef(null);
  const roundStart = useRef(Date.now());

  useEffect(() => {
    if (screen !== "playing") return;

    const tick = () => {
      setElapsedMs(Date.now() - roundStart.current);
    };

    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [screen, round.startIndex, round.targetIndex]);

  const handleChoose = useCallback(
    (direction) => {
      if (animating || round.finished || screen !== "playing") return;

      setAnimating(true);

      setTimeout(() => {
        setRound((prev) => {
          const next = applyMove(prev, direction);

          if (next.finished) {
            const bonus = next.failed ? 0 : timeBonus(Date.now() - roundStart.current);
            const finalRoundScore = next.roundScore + bonus;
            const elapsed = Date.now() - roundStart.current;

            setRoundBonus(bonus);
            setTotalScore((s) => {
              const updated = s + finalRoundScore;
              if (!next.failed) {
                saveHighScore(updated);
              }
              setHighScore(getHighScore());
              return updated;
            });

            if (supabase && profile) {
              void saveRoundResult(supabase, {
                profileId: profile.id,
                sessionId: sessionIdRef.current,
                round: next,
                finalScore: finalRoundScore,
                elapsedMs: elapsed,
              }).then(({ ok, error }) => {
                setSaveError(ok ? null : error);
              });
            } else {
              setSaveError(null);
            }

            setTimeout(() => setScreen("roundComplete"), 600);
          }

          return next;
        });
        setAnimating(false);
      }, 350);
    },
    [animating, round.finished, screen, profile],
  );

  useEffect(() => {
    if (screen !== "playing") return;

    const onKeyDown = (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleChoose("left");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleChoose("right");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, handleChoose]);

  const startGame = useCallback(async () => {
    const newRound = createRound(canonMode);
    setRound(newRound);
    setTotalScore(0);
    setRoundBonus(0);
    setElapsedMs(0);
    roundStart.current = Date.now();
    setSaveError(null);
    sessionIdRef.current = null;

    if (supabase && profile) {
      const { sessionId, error } = await createSession(supabase, profile.id, canonMode);
      sessionIdRef.current = sessionId;
      if (error) setSaveError(error);
    }

    setScreen("playing");
  }, [canonMode, profile]);

  const nextRound = useCallback(() => {
    const newRound = createRound(canonMode);
    setRound(newRound);
    setRoundBonus(0);
    setElapsedMs(0);
    roundStart.current = Date.now();
    setScreen("playing");
  }, [canonMode]);

  const endSession = useCallback(() => {
    sessionIdRef.current = null;
    setScreen("welcome");
  }, []);

  return (
    <div className="blitz">
      <div className="bg-shapes" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            className="bg-blob"
            animate={{
              y: [0, -30, 0],
              x: [0, i % 2 === 0 ? 20 : -20, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 6 + i,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.5,
            }}
          />
        ))}
      </div>

      <main className="blitz-main">
        <AnimatePresence mode="wait">
          {screen === "welcome" && (
            <motion.div key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <WelcomeScreen
                highScore={highScore}
                mode={canonMode}
                onModeChange={setCanonMode}
                profile={profile}
                onShowLeaderboard={() => setScreen("leaderboard")}
                onStart={startGame}
              />
            </motion.div>
          )}

          {screen === "leaderboard" && (
            <motion.div key="leaderboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LeaderboardPanel profile={profile} onBack={() => setScreen("welcome")} />
            </motion.div>
          )}

          {screen === "playing" && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="play-layout"
            >
              <GameBoard
                round={round}
                elapsedMs={elapsedMs}
                totalScore={totalScore + round.roundScore}
                highScore={highScore}
                onChoose={handleChoose}
                disabled={animating}
              />
              <BibleTimeline round={round} showTarget={false} feedback={round.lastFeedback} />
            </motion.div>
          )}

          {screen === "roundComplete" && (
            <motion.div key="complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <RoundComplete
                round={round}
                elapsedMs={elapsedMs}
                roundBonus={roundBonus}
                totalScore={totalScore}
                saveError={saveError}
                onNextRound={nextRound}
                onEndSession={endSession}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="blitz-footer">
        <span>66 books · Binary search training</span>
        <span className={isSupabaseConfigured ? "footer-cloud on" : "footer-cloud off"}>
          {isSupabaseConfigured ? "☁️ Cloud saves on" : "📱 Local mode (no cloud saves)"}
        </span>
        {profile && <span className="footer-profile">Playing as {profile.username}</span>}
      </footer>
    </div>
  );
}
