import { globalBook } from "../game/logic";

// Cloud persistence for Bible Blitz: a session groups the rounds played in one
// sitting; each round result is stored individually. All keyed to a profile
// (inherited from the Bible Viz profile selection).

export async function createSession(supabase, profileId, mode) {
  const { data, error } = await supabase
    .from("trainer_sessions")
    .insert({ profile_id: profileId, mode, total_score: 0, rounds_played: 0 })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create session:", error.message);
    return { sessionId: null, error: error.message };
  }
  return { sessionId: data.id, error: null };
}

export async function saveRoundResult(supabase, { profileId, sessionId, round, finalScore, elapsedMs }) {
  const startBook = globalBook(round.startIndex, round).name;
  const targetBook = globalBook(round.targetIndex, round).name;

  const { error: roundError } = await supabase.from("trainer_rounds").insert({
    profile_id: profileId,
    session_id: sessionId,
    mode: round.mode,
    start_book: startBook,
    target_book: targetBook,
    score: finalScore,
    moves: round.moves,
    correct_moves: round.correctMoves,
    wrong_moves: round.wrongMoves,
    elapsed_ms: elapsedMs,
    failed: round.failed,
  });

  if (roundError) {
    console.error("Failed to save round:", roundError.message);
    return { ok: false, error: roundError.message };
  }

  if (sessionId) {
    const { data: session } = await supabase
      .from("trainer_sessions")
      .select("total_score, rounds_played")
      .eq("id", sessionId)
      .single();

    if (session) {
      const { error: sessionError } = await supabase
        .from("trainer_sessions")
        .update({
          total_score: session.total_score + finalScore,
          rounds_played: session.rounds_played + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (sessionError) {
        console.error("Failed to update session:", sessionError.message);
        return { ok: false, error: sessionError.message };
      }
    }
  }

  return { ok: true, error: null };
}

export async function fetchLeaderboard(supabase, modeFilter = "all-modes", limit = 20) {
  let query = supabase
    .from("trainer_sessions")
    .select(`
      id,
      total_score,
      rounds_played,
      mode,
      created_at,
      profile:profiles (username, avatar, color)
    `)
    .gt("rounds_played", 0)
    .order("total_score", { ascending: false })
    .limit(limit);

  if (modeFilter !== "all-modes") {
    query = query.eq("mode", modeFilter);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Failed to load leaderboard:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    total_score: row.total_score,
    rounds_played: row.rounds_played,
    mode: row.mode,
    created_at: row.created_at,
    profile: Array.isArray(row.profile) ? row.profile[0] : row.profile,
  }));
}

export async function fetchPersonalStats(supabase, profileId) {
  const [roundsRes, sessionsRes] = await Promise.all([
    supabase
      .from("trainer_rounds")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("trainer_sessions")
      .select("total_score")
      .eq("profile_id", profileId)
      .order("total_score", { ascending: false })
      .limit(1),
  ]);

  const rounds = roundsRes.data ?? [];
  const bestSession = sessionsRes.data?.[0]?.total_score ?? 0;

  return {
    roundsPlayed: rounds.length,
    bestSessionScore: bestSession,
    bestRoundScore: rounds.reduce((max, r) => Math.max(max, r.score), 0),
    totalScore: rounds.reduce((sum, r) => sum + r.score, 0),
    recentRounds: rounds.slice(0, 15),
  };
}
