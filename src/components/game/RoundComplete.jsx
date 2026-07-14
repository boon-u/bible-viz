import { motion } from "framer-motion";
import { formatTime, globalBook } from "../../game/logic";

function Confetti() {
  const pieces = Array.from({ length: 24 }, (_, i) => i);
  const colors = ["#ffd166", "#06d6a0", "#ef476f", "#118ab2", "#9b5de5", "#f4a261"];

  return (
    <div className="confetti-container" aria-hidden>
      {pieces.map((i) => (
        <motion.span
          key={i}
          className="confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            background: colors[i % colors.length],
          }}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{
            y: 400 + Math.random() * 200,
            opacity: [1, 1, 0],
            rotate: Math.random() * 720 - 360,
            x: (Math.random() - 0.5) * 120,
          }}
          transition={{
            duration: 2 + Math.random(),
            delay: Math.random() * 0.4,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

export function RoundComplete({
  round,
  elapsedMs,
  roundBonus,
  totalScore,
  saveError,
  onNextRound,
  onEndSession,
}) {
  const target = globalBook(round.targetIndex, round);
  const current = globalBook(round.currentIndex, round);
  const perfect = !round.failed && round.wrongMoves === 0;

  if (round.failed) {
    return (
      <motion.div
        className="round-complete failed"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      >
        <motion.div
          className="complete-mascot"
          animate={{ rotate: [0, -8, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          🧭
        </motion.div>

        <h2>Search range exhausted</h2>
        <p className="complete-subtitle">
          Too many wrong turns narrowed the range past <strong>{target.name}</strong>.
        </p>
        <p className="complete-book">
          {target.name} is {round.targetIndex < round.currentIndex ? "earlier" : "later"} than{" "}
          {current.name} in the Bible.
        </p>
        <p className="complete-time">
          Stopped at {current.name} after {formatTime(elapsedMs)}
        </p>

        <div className="complete-breakdown">
          <div className="breakdown-row">
            <span>Points earned</span>
            <span>{round.roundScore}</span>
          </div>
          <div className="breakdown-row total">
            <span>Total score</span>
            <span>{totalScore}</span>
          </div>
        </div>

        <div className="complete-stats">
          <span>{round.moves} moves</span>
          <span>{round.correctMoves} correct</span>
          <span>{round.wrongMoves} wrong</span>
        </div>

        <div className="complete-actions">
          {saveError && (
            <p className="save-error" role="alert">
              Score not saved to cloud: {saveError}
            </p>
          )}
          <motion.button
            type="button"
            className="primary-btn"
            onClick={onNextRound}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
          >
            Try Another →
          </motion.button>
          <button type="button" className="ghost-btn" onClick={onEndSession}>
            End session
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="round-complete"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      <Confetti />

      <motion.div
        className="complete-mascot"
        animate={{ y: [0, -12, 0], rotate: [0, 5, -5, 0] }}
        transition={{ repeat: Infinity, duration: 2.5 }}
      >
        🎉
      </motion.div>

      <h2>You found it!</h2>
      <p className="complete-book">{target.name}</p>
      <p className="complete-time">Completed in {formatTime(elapsedMs)}</p>

      <div className="complete-breakdown">
        <div className="breakdown-row">
          <span>Round points</span>
          <span>+{round.roundScore}</span>
        </div>
        <div className="breakdown-row">
          <span>Speed bonus</span>
          <span>+{roundBonus}</span>
        </div>
        {perfect && (
          <div className="breakdown-row perfect">
            <span>Perfect navigation!</span>
            <span>⭐</span>
          </div>
        )}
        <div className="breakdown-row total">
          <span>Total score</span>
          <span>{totalScore}</span>
        </div>
      </div>

      <div className="complete-stats">
        <span>{round.moves} moves</span>
        <span>{round.correctMoves} correct</span>
        <span>{round.wrongMoves} wrong</span>
      </div>

      <div className="complete-actions">
        {saveError && (
          <p className="save-error" role="alert">
            Score not saved to cloud: {saveError}
          </p>
        )}
        <motion.button
          type="button"
          className="primary-btn"
          onClick={onNextRound}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
        >
          Next Round →
        </motion.button>
        <button type="button" className="ghost-btn" onClick={onEndSession}>
          End session
        </button>
      </div>
    </motion.div>
  );
}
