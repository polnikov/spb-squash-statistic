import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Domain: a squash league. A season has divisions (1..3). Each season runs
 * a number of stages (этапы); every stage is played per division and maps to
 * a RankedIn tournament that the parser imports. A stage-division yields a
 * standings table (results) and the head-to-head matches behind it.
 *
 * Column names are written in camelCase and mapped to snake_case columns via
 * the `casing: "snake_case"` setting in drizzle.config.ts and the db client.
 */

export const stageStatus = pgEnum("stage_status", ["done", "upcoming"]);
export const parseStatus = pgEnum("parse_status", [
  "pending",
  "queued",
  "parsing",
  "done",
  "failed",
]);
export const userRole = pgEnum("user_role", ["admin"]);
/** Scope of a PlayerStatsAggregate / PlayerOpponentStats row. */
export const playerStatsScope = pgEnum("player_stats_scope", [
  "career",
  "season",
  "season_division",
  "stage",
  "stage_division",
]);
/** Reliability bucket by sample size. */
export const sampleSizeLevelEnum = pgEnum("sample_size_level", [
  "very_low",
  "low",
  "medium",
  "high",
]);
/** Analytical playing-level tier derived from skillIndex. */
export const skillIndexStatusEnum = pgEnum("skill_index_status", [
  "below_level",
  "developing",
  "competitive",
  "good",
  "strong",
  "very_strong",
  "dominant",
]);
/** Head-to-head comfort tier. */
export const matchupStatusEnum = pgEnum("matchup_status", [
  "very_comfortable",
  "comfortable",
  "equal",
  "uncomfortable",
  "very_uncomfortable",
  "not_enough_data",
]);
/** Metric plotted on a chart series point. */
export const metricKeyEnum = pgEnum("metric_key", [
  "matchWinRatePct",
  "gameWinRatePct",
  "rallyWinRatePct",
  "formIndex",
  "skillIndex",
  "gameBalancePerMatch",
  "rallyBalancePerMatch",
  "cumulativeGameBalance",
  "cumulativeRallyBalance",
  "matchesPlayed",
]);

export const seasons = pgTable("seasons", {
  id: serial("id").primaryKey(),
  // e.g. "25/26"
  label: text("label").notNull().unique(),
  startYear: integer("start_year").notNull(),
  isCurrent: boolean("is_current").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  // Display name fallback is: adminName ?? rankedinName.
  name: text("name").notNull(),
  rankedinName: text("rankedin_name").notNull(),
  adminName: text("admin_name"),
  // RankedIn id, e.g. "R000064106"
  rankedinId: text("rankedin_id").unique(),
  // Strength Rating (Elo). Opponent-aware, cross-division. Recomputed by a
  // global chronological pass over all matches (see lib/stats/strength-rating).
  strengthRating: integer("strength_rating"),
  strengthRatingGames: integer("strength_rating_games").notNull().default(0),
  strengthRatingPeak: integer("strength_rating_peak"),
  strengthRatingLastCalculatedAt: timestamp("strength_rating_last_calculated_at", { withTimezone: true }),
  strengthRatingVersion: varchar("strength_rating_version", { length: 32 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("players_strength_rating_idx").on(t.strengthRating)]);

export const playerRankedinAliases = pgTable(
  "player_rankedin_aliases",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    rankedinId: text("rankedin_id").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("player_rankedin_aliases_player_idx").on(t.playerId)],
);

export const stages = pgTable(
  "stages",
  {
    id: serial("id").primaryKey(),
    seasonId: integer("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    number: smallint("number").notNull(),
    date: date("date"),
    status: stageStatus("status").notNull().default("upcoming"),
  },
  (t) => [unique("stages_season_number_uq").on(t.seasonId, t.number)],
);

/**
 * One stage played within one division. The unit the BullMQ parser imports
 * from a single RankedIn tournament.
 */
export const stageDivisions = pgTable(
  "stage_divisions",
  {
    id: serial("id").primaryKey(),
    stageId: integer("stage_id")
      .notNull()
      .references(() => stages.id, { onDelete: "cascade" }),
    division: smallint("division").notNull(),
    rankedinTournamentId: text("rankedin_tournament_id"),
    rankedinClassId: text("rankedin_class_id"),
    parseStatus: parseStatus("parse_status").notNull().default("pending"),
    parsedAt: timestamp("parsed_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => [unique("stage_divisions_stage_division_uq").on(t.stageId, t.division)],
);

/** Division roster: which players belong to a division in a season. */
export const rosters = pgTable(
  "rosters",
  {
    id: serial("id").primaryKey(),
    seasonId: integer("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    division: smallint("division").notNull(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
  },
  (t) => [unique("rosters_uq").on(t.seasonId, t.division, t.playerId)],
);

/** A player's standings row for one stage in one division. */
export const results = pgTable(
  "results",
  {
    id: serial("id").primaryKey(),
    stageId: integer("stage_id")
      .notNull()
      .references(() => stages.id, { onDelete: "cascade" }),
    division: smallint("division").notNull(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    place: smallint("place").notNull(),
    matches: smallint("matches").notNull().default(0),
    wonMatches: smallint("won_matches").notNull().default(0),
    lostMatches: smallint("lost_matches").notNull().default(0),
    games: smallint("games").notNull().default(0),
    wonGames: smallint("won_games").notNull().default(0),
    lostGames: smallint("lost_games").notNull().default(0),
    balls: integer("balls").notNull().default(0),
    wonBalls: integer("won_balls").notNull().default(0),
    lostBalls: integer("lost_balls").notNull().default(0),
    courtMinutes: integer("court_minutes").notNull().default(0),
    rank: integer("rank"),
    skill: numeric("skill", { precision: 4, scale: 1 }),
    // RankedIn rating snapshot around the stage (for player history charts).
    ratingBefore: numeric("rating_before", { precision: 6, scale: 2 }),
    ratingAfter: numeric("rating_after", { precision: 6, scale: 2 }),
    points: smallint("points").notNull().default(0),
  },
  (t) => [unique("results_uq").on(t.stageId, t.division, t.playerId)],
);

/** Head-to-head match behind the standings (stored once, canonical A vs B). */
export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  stageId: integer("stage_id")
    .notNull()
    .references(() => stages.id, { onDelete: "cascade" }),
  division: smallint("division").notNull(),
  playerAId: integer("player_a_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  playerBId: integer("player_b_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  gamesA: smallint("games_a").notNull(),
  gamesB: smallint("games_b").notNull(),
  winnerId: integer("winner_id").references(() => players.id),
  // per-game ball scores, e.g. [{ a: 11, b: 8 }, { a: 11, b: 6 }]
  scoreDetail: jsonb("score_detail").$type<{ a: number; b: number }[]>(),
  durationMinutes: integer("duration_minutes"),
  retired: boolean("retired").notNull().default(false),
  // comeback flags (derived from scoreDetail) for fast filtering
  playerATrailed0_2: boolean("player_a_trailed_0_2").notNull().default(false),
  playerBTrailed0_2: boolean("player_b_trailed_0_2").notNull().default(false),
  playerALed2_0: boolean("player_a_led_2_0").notNull().default(false),
  playerBLed2_0: boolean("player_b_led_2_0").notNull().default(false),
  isReverseSweep: boolean("is_reverse_sweep").notNull().default(false),
  reverseSweepWinnerId: integer("reverse_sweep_winner_id").references(() => players.id),
  reverseSweepLoserId: integer("reverse_sweep_loser_id").references(() => players.id),
  wasFifthForcedAfter0_2: boolean("was_fifth_forced_after_0_2").notNull().default(false),
});

/**
 * Source-of-truth game rows behind a match. Backfilled from
 * `matches.scoreDetail`; kept as canonical A-vs-B per-game scores so all
 * game/rally stats recalculate from rows, not from the JSON blob.
 */
export const matchGames = pgTable(
  "match_games",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    gameNumber: smallint("game_number").notNull(),
    playerAId: integer("player_a_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    playerBId: integer("player_b_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    playerAScore: smallint("player_a_score").notNull(),
    playerBScore: smallint("player_b_score").notNull(),
    winnerId: integer("winner_id").references(() => players.id),
    loserId: integer("loser_id").references(() => players.id),
    durationSec: integer("duration_sec"),
    /** Absolute point difference in the game. */
    pointMargin: smallint("point_margin").notNull().default(0),
    /** abs(a - b) === 2, e.g. 11:9, 12:10, 13:11. */
    isCloseGame: boolean("is_close_game").notNull().default(false),
    /** max(a, b) > 11, e.g. 12:10, 13:11. */
    isOvertimeGame: boolean("is_overtime_game").notNull().default(false),
    /** abs(a - b) >= 5, e.g. 11:6, 11:5. */
    isDominantGame: boolean("is_dominant_game").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("match_games_match_game_uq").on(t.matchId, t.gameNumber),
    index("match_games_match_idx").on(t.matchId),
    index("match_games_winner_idx").on(t.winnerId),
    index("match_games_loser_idx").on(t.loserId),
  ],
);

/**
 * Denormalized player statistics computed from matches + match_games.
 * One row per (player, scope): career (no season/stage), season (seasonId),
 * stage (seasonId + stageId). Percentages are nullable cache recalculated
 * from raw data; counters default to 0.
 */
export const playerStatsAggregate = pgTable(
  "player_stats_aggregate",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    scope: playerStatsScope("scope").notNull(),
    seasonId: integer("season_id").references(() => seasons.id, { onDelete: "cascade" }),
    stageId: integer("stage_id").references(() => stages.id, { onDelete: "cascade" }),
    // Set for season_division / stage_division scopes; null otherwise.
    division: smallint("division"),

    // participation & volume
    seasonsPlayed: integer("seasons_played").notNull().default(0),
    stagesPlayed: integer("stages_played").notNull().default(0),
    divisionsPlayed: integer("divisions_played").notNull().default(0),
    matchesPlayed: integer("matches_played").notNull().default(0),
    matchesWon: integer("matches_won").notNull().default(0),
    matchesLost: integer("matches_lost").notNull().default(0),
    gamesPlayed: integer("games_played").notNull().default(0),
    gamesWon: integer("games_won").notNull().default(0),
    gamesLost: integer("games_lost").notNull().default(0),
    ralliesPlayed: integer("rallies_played").notNull().default(0),
    ralliesWon: integer("rallies_won").notNull().default(0),
    ralliesLost: integer("rallies_lost").notNull().default(0),
    firstMatchAt: timestamp("first_match_at", { withTimezone: true }),
    lastMatchAt: timestamp("last_match_at", { withTimezone: true }),

    // winrate (cache)
    matchWinRatePct: numeric("match_win_rate_pct", { precision: 6, scale: 3 }),
    gameWinRatePct: numeric("game_win_rate_pct", { precision: 6, scale: 3 }),
    rallyWinRatePct: numeric("rally_win_rate_pct", { precision: 6, scale: 3 }),

    // balances
    gameBalance: integer("game_balance").notNull().default(0),
    rallyBalance: integer("rally_balance").notNull().default(0),
    gameBalancePerMatch: numeric("game_balance_per_match", { precision: 8, scale: 3 }),
    rallyBalancePerMatch: numeric("rally_balance_per_match", { precision: 8, scale: 3 }),

    // best-of-5 score distribution
    wins3_0: integer("wins_3_0").notNull().default(0),
    wins3_1: integer("wins_3_1").notNull().default(0),
    wins3_2: integer("wins_3_2").notNull().default(0),
    losses2_3: integer("losses_2_3").notNull().default(0),
    losses1_3: integer("losses_1_3").notNull().default(0),
    losses0_3: integer("losses_0_3").notNull().default(0),
    cleanWins: integer("clean_wins").notNull().default(0),
    cleanLosses: integer("clean_losses").notNull().default(0),
    cleanWinRatePct: numeric("clean_win_rate_pct", { precision: 6, scale: 3 }),
    cleanLossRatePct: numeric("clean_loss_rate_pct", { precision: 6, scale: 3 }),

    // five-game matches
    fiveGameMatches: integer("five_game_matches").notNull().default(0),
    fiveGameMatchesWon: integer("five_game_matches_won").notNull().default(0),
    fiveGameMatchesLost: integer("five_game_matches_lost").notNull().default(0),
    fiveGameMatchRatePct: numeric("five_game_match_rate_pct", { precision: 6, scale: 3 }),
    fiveGameWinRatePct: numeric("five_game_win_rate_pct", { precision: 6, scale: 3 }),
    fifthGameRalliesWon: integer("fifth_game_rallies_won").notNull().default(0),
    fifthGameRalliesLost: integer("fifth_game_rallies_lost").notNull().default(0),
    fifthGameRallyWinRatePct: numeric("fifth_game_rally_win_rate_pct", { precision: 6, scale: 3 }),

    // close & overtime games
    closeGamesPlayed: integer("close_games_played").notNull().default(0),
    closeGamesWon: integer("close_games_won").notNull().default(0),
    closeGamesLost: integer("close_games_lost").notNull().default(0),
    closeGameRatePct: numeric("close_game_rate_pct", { precision: 6, scale: 3 }),
    closeGameWinRatePct: numeric("close_game_win_rate_pct", { precision: 6, scale: 3 }),
    overtimeGamesPlayed: integer("overtime_games_played").notNull().default(0),
    overtimeGamesWon: integer("overtime_games_won").notNull().default(0),
    overtimeGamesLost: integer("overtime_games_lost").notNull().default(0),
    overtimeGameRatePct: numeric("overtime_game_rate_pct", { precision: 6, scale: 3 }),
    overtimeGameWinRatePct: numeric("overtime_game_win_rate_pct", { precision: 6, scale: 3 }),

    // dominant & heavy-lost games
    dominantGamesWon: integer("dominant_games_won").notNull().default(0),
    heavyGamesLost: integer("heavy_games_lost").notNull().default(0),
    dominantGameWinRatePct: numeric("dominant_game_win_rate_pct", { precision: 6, scale: 3 }),
    heavyGameLossRatePct: numeric("heavy_game_loss_rate_pct", { precision: 6, scale: 3 }),

    // time & load
    totalMatchDurationSec: integer("total_match_duration_sec").notNull().default(0),
    avgMatchDurationSec: numeric("avg_match_duration_sec", { precision: 10, scale: 2 }),
    shortestMatchDurationSec: integer("shortest_match_duration_sec"),
    longestMatchDurationSec: integer("longest_match_duration_sec"),
    avgGameDurationSec: numeric("avg_game_duration_sec", { precision: 10, scale: 2 }),
    avgSecondsPerRally: numeric("avg_seconds_per_rally", { precision: 10, scale: 2 }),
    matchLoadScore: numeric("match_load_score", { precision: 10, scale: 3 }),

    // composite indexes
    formIndex: numeric("form_index", { precision: 6, scale: 3 }),
    skillIndex: numeric("skill_index", { precision: 6, scale: 3 }),
    skillIndexStatus: skillIndexStatusEnum("skill_index_status"),
    matchConversionPp: numeric("match_conversion_pp", { precision: 6, scale: 3 }),
    gameConversionPp: numeric("game_conversion_pp", { precision: 6, scale: 3 }),
    resultConversionPp: numeric("result_conversion_pp", { precision: 6, scale: 3 }),

    // comeback: trailing 0:2 / leading 2:0
    matchesTrailed0_2: integer("matches_trailed_0_2").notNull().default(0),
    reverseSweepWins: integer("reverse_sweep_wins").notNull().default(0),
    reverseSweepWinRatePct: numeric("reverse_sweep_win_rate_pct", { precision: 6, scale: 3 }),
    forcedFifthAfterTrailing0_2: integer("forced_fifth_after_trailing_0_2").notNull().default(0),
    forcedFifthRateAfterTrailing0_2Pct: numeric("forced_fifth_rate_after_trailing_0_2_pct", { precision: 6, scale: 3 }),
    matchesLostAfterTrailing0_2: integer("matches_lost_after_trailing_0_2").notNull().default(0),
    gamesWonAfterTrailing0_2: integer("games_won_after_trailing_0_2").notNull().default(0),
    avgGamesWonAfterTrailing0_2: numeric("avg_games_won_after_trailing_0_2", { precision: 6, scale: 3 }),
    matchesLed2_0: integer("matches_led_2_0").notNull().default(0),
    winsAfterLeading2_0: integer("wins_after_leading_2_0").notNull().default(0),
    lossesAfterLeading2_0: integer("losses_after_leading_2_0").notNull().default(0),
    blownTwoGameLeadRatePct: numeric("blown_two_game_lead_rate_pct", { precision: 6, scale: 3 }),
    reverseSweepLosses: integer("reverse_sweep_losses").notNull().default(0),

    // per-match averages
    avgGamesWonPerMatch: numeric("avg_games_won_per_match", { precision: 8, scale: 3 }),
    avgGamesLostPerMatch: numeric("avg_games_lost_per_match", { precision: 8, scale: 3 }),
    avgGamesPlayedPerMatch: numeric("avg_games_played_per_match", { precision: 8, scale: 3 }),
    avgRalliesWonPerMatch: numeric("avg_rallies_won_per_match", { precision: 8, scale: 3 }),
    avgRalliesLostPerMatch: numeric("avg_rallies_lost_per_match", { precision: 8, scale: 3 }),
    avgRalliesPlayedPerMatch: numeric("avg_rallies_played_per_match", { precision: 8, scale: 3 }),
    avgMatchGamesWon: numeric("avg_match_games_won", { precision: 8, scale: 3 }),
    avgMatchGamesLost: numeric("avg_match_games_lost", { precision: 8, scale: 3 }),
    avgRallyMarginPerGame: numeric("avg_rally_margin_per_game", { precision: 8, scale: 3 }),

    // streaks & recent form
    currentWinStreak: integer("current_win_streak").notNull().default(0),
    currentLossStreak: integer("current_loss_streak").notNull().default(0),
    longestWinStreak: integer("longest_win_streak").notNull().default(0),
    longestLossStreak: integer("longest_loss_streak").notNull().default(0),
    last5MatchesPlayed: integer("last5_matches_played").notNull().default(0),
    last5MatchesWon: integer("last5_matches_won").notNull().default(0),
    last5MatchesLost: integer("last5_matches_lost").notNull().default(0),
    last5MatchWinRatePct: numeric("last5_match_win_rate_pct", { precision: 6, scale: 3 }),
    last5GameWinRatePct: numeric("last5_game_win_rate_pct", { precision: 6, scale: 3 }),
    last5RallyWinRatePct: numeric("last5_rally_win_rate_pct", { precision: 6, scale: 3 }),
    last10MatchesPlayed: integer("last10_matches_played").notNull().default(0),
    last10MatchesWon: integer("last10_matches_won").notNull().default(0),
    last10MatchesLost: integer("last10_matches_lost").notNull().default(0),
    last10MatchWinRatePct: numeric("last10_match_win_rate_pct", { precision: 6, scale: 3 }),
    last10GameWinRatePct: numeric("last10_game_win_rate_pct", { precision: 6, scale: 3 }),
    last10RallyWinRatePct: numeric("last10_rally_win_rate_pct", { precision: 6, scale: 3 }),

    // trends & cumulative
    matchWinRateTrendPp: numeric("match_win_rate_trend_pp", { precision: 6, scale: 3 }),
    gameWinRateTrendPp: numeric("game_win_rate_trend_pp", { precision: 6, scale: 3 }),
    rallyWinRateTrendPp: numeric("rally_win_rate_trend_pp", { precision: 6, scale: 3 }),
    formIndexTrend: numeric("form_index_trend", { precision: 6, scale: 3 }),
    cumulativeGameBalance: integer("cumulative_game_balance").notNull().default(0),
    cumulativeRallyBalance: integer("cumulative_rally_balance").notNull().default(0),

    statsReliabilityScore: numeric("stats_reliability_score", { precision: 4, scale: 3 }),

    sampleSizeLevel: sampleSizeLevelEnum("sample_size_level"),

    // system
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // nullable season/stage make a plain composite unique useless (NULLs are
    // distinct in Postgres), so enforce one row per scope via partial indexes.
    uniqueIndex("psa_career_uq")
      .on(t.playerId)
      .where(sql`${t.scope} = 'career'`),
    uniqueIndex("psa_season_uq")
      .on(t.playerId, t.seasonId)
      .where(sql`${t.scope} = 'season'`),
    uniqueIndex("psa_season_division_uq")
      .on(t.playerId, t.seasonId, t.division)
      .where(sql`${t.scope} = 'season_division'`),
    uniqueIndex("psa_stage_uq")
      .on(t.playerId, t.seasonId, t.stageId)
      .where(sql`${t.scope} = 'stage'`),
    uniqueIndex("psa_stage_division_uq")
      .on(t.playerId, t.seasonId, t.stageId, t.division)
      .where(sql`${t.scope} = 'stage_division'`),
    index("psa_player_idx").on(t.playerId),
    index("psa_scope_idx").on(t.scope),
    index("psa_season_idx").on(t.seasonId),
    index("psa_stage_idx").on(t.stageId),
    index("psa_player_scope_idx").on(t.playerId, t.scope),
    index("psa_player_season_idx").on(t.playerId, t.seasonId),
    index("psa_calculated_at_idx").on(t.calculatedAt),
  ],
);

/**
 * Per-match Strength Rating (Elo) audit trail. One row per player per match,
 * written by the global chronological recompute. Source for the rating
 * progression chart and reproducibility checks.
 */
export const playerRatingHistory = pgTable(
  "player_rating_history",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    ratingBefore: integer("rating_before").notNull(),
    ratingAfter: integer("rating_after").notNull(),
    delta: integer("delta").notNull(),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("player_rating_history_player_match_idx").on(t.playerId, t.matchId),
    index("player_rating_history_match_idx").on(t.matchId),
  ],
);

/**
 * Head-to-head statistics from `playerId`'s perspective against `opponentId`.
 * One row per ordered pair; the mirror pair (opponent vs player) is a separate
 * row. All metrics recalculated from matches + match_games.
 */
export const playerOpponentStats = pgTable(
  "player_opponent_stats",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    opponentId: integer("opponent_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    // H2H scope: career (season/division null) | season (seasonId) |
    // season_division (seasonId + division). Defaults to career for back-compat.
    scope: playerStatsScope("scope").notNull().default("career"),
    seasonId: integer("h2h_season_id").references(() => seasons.id, { onDelete: "cascade" }),
    division: smallint("h2h_division"),

    meetingsPlayed: integer("meetings_played").notNull().default(0),
    firstMeetingAt: timestamp("first_meeting_at", { withTimezone: true }),
    lastMeetingAt: timestamp("last_meeting_at", { withTimezone: true }),

    // match / game / rally
    h2hMatchesWon: integer("h2h_matches_won").notNull().default(0),
    h2hMatchesLost: integer("h2h_matches_lost").notNull().default(0),
    h2hMatchWinRatePct: numeric("h2h_match_win_rate_pct", { precision: 6, scale: 3 }),
    h2hGamesPlayed: integer("h2h_games_played").notNull().default(0),
    h2hGamesWon: integer("h2h_games_won").notNull().default(0),
    h2hGamesLost: integer("h2h_games_lost").notNull().default(0),
    h2hGameWinRatePct: numeric("h2h_game_win_rate_pct", { precision: 6, scale: 3 }),
    h2hGameBalance: integer("h2h_game_balance").notNull().default(0),
    h2hGameBalancePerMatch: numeric("h2h_game_balance_per_match", { precision: 8, scale: 3 }),
    h2hRalliesPlayed: integer("h2h_rallies_played").notNull().default(0),
    h2hRalliesWon: integer("h2h_rallies_won").notNull().default(0),
    h2hRalliesLost: integer("h2h_rallies_lost").notNull().default(0),
    h2hRallyWinRatePct: numeric("h2h_rally_win_rate_pct", { precision: 6, scale: 3 }),
    h2hRallyBalance: integer("h2h_rally_balance").notNull().default(0),
    h2hRallyBalancePerMatch: numeric("h2h_rally_balance_per_match", { precision: 8, scale: 3 }),

    // distribution
    h2hWins3_0: integer("h2h_wins_3_0").notNull().default(0),
    h2hWins3_1: integer("h2h_wins_3_1").notNull().default(0),
    h2hWins3_2: integer("h2h_wins_3_2").notNull().default(0),
    h2hLosses2_3: integer("h2h_losses_2_3").notNull().default(0),
    h2hLosses1_3: integer("h2h_losses_1_3").notNull().default(0),
    h2hLosses0_3: integer("h2h_losses_0_3").notNull().default(0),
    h2hCleanWins: integer("h2h_clean_wins").notNull().default(0),
    h2hCleanLosses: integer("h2h_clean_losses").notNull().default(0),

    // five-game
    h2hFiveGameMatches: integer("h2h_five_game_matches").notNull().default(0),
    h2hFiveGameMatchesWon: integer("h2h_five_game_matches_won").notNull().default(0),
    h2hFiveGameMatchesLost: integer("h2h_five_game_matches_lost").notNull().default(0),
    h2hFiveGameWinRatePct: numeric("h2h_five_game_win_rate_pct", { precision: 6, scale: 3 }),

    // close / overtime / dominant
    h2hCloseGamesWon: integer("h2h_close_games_won").notNull().default(0),
    h2hCloseGamesLost: integer("h2h_close_games_lost").notNull().default(0),
    h2hCloseGameWinRatePct: numeric("h2h_close_game_win_rate_pct", { precision: 6, scale: 3 }),
    h2hOvertimeGamesWon: integer("h2h_overtime_games_won").notNull().default(0),
    h2hOvertimeGamesLost: integer("h2h_overtime_games_lost").notNull().default(0),
    h2hDominantGamesWon: integer("h2h_dominant_games_won").notNull().default(0),
    h2hHeavyGamesLost: integer("h2h_heavy_games_lost").notNull().default(0),

    // time
    h2hTotalMatchDurationSec: integer("h2h_total_match_duration_sec").notNull().default(0),
    h2hAvgMatchDurationSec: numeric("h2h_avg_match_duration_sec", { precision: 10, scale: 2 }),

    // comeback: trailing 0:2 / leading 2:0
    h2hMatchesTrailed0_2: integer("h2h_matches_trailed_0_2").notNull().default(0),
    h2hReverseSweepWins: integer("h2h_reverse_sweep_wins").notNull().default(0),
    h2hReverseSweepWinRatePct: numeric("h2h_reverse_sweep_win_rate_pct", { precision: 6, scale: 3 }),
    h2hForcedFifthAfterTrailing0_2: integer("h2h_forced_fifth_after_trailing_0_2").notNull().default(0),
    h2hForcedFifthRateAfterTrailing0_2Pct: numeric("h2h_forced_fifth_rate_after_trailing_0_2_pct", { precision: 6, scale: 3 }),
    h2hMatchesLostAfterTrailing0_2: integer("h2h_matches_lost_after_trailing_0_2").notNull().default(0),
    h2hGamesWonAfterTrailing0_2: integer("h2h_games_won_after_trailing_0_2").notNull().default(0),
    h2hAvgGamesWonAfterTrailing0_2: numeric("h2h_avg_games_won_after_trailing_0_2", { precision: 6, scale: 3 }),
    h2hMatchesLed2_0: integer("h2h_matches_led_2_0").notNull().default(0),
    h2hWinsAfterLeading2_0: integer("h2h_wins_after_leading_2_0").notNull().default(0),
    h2hLossesAfterLeading2_0: integer("h2h_losses_after_leading_2_0").notNull().default(0),
    h2hBlownTwoGameLeadRatePct: numeric("h2h_blown_two_game_lead_rate_pct", { precision: 6, scale: 3 }),
    h2hReverseSweepLosses: integer("h2h_reverse_sweep_losses").notNull().default(0),

    // h2h per-match averages
    h2hAvgGamesWonPerMatch: numeric("h2h_avg_games_won_per_match", { precision: 8, scale: 3 }),
    h2hAvgGamesLostPerMatch: numeric("h2h_avg_games_lost_per_match", { precision: 8, scale: 3 }),
    h2hAvgGamesPlayedPerMatch: numeric("h2h_avg_games_played_per_match", { precision: 8, scale: 3 }),
    h2hAvgRalliesWonPerMatch: numeric("h2h_avg_rallies_won_per_match", { precision: 8, scale: 3 }),
    h2hAvgRalliesLostPerMatch: numeric("h2h_avg_rallies_lost_per_match", { precision: 8, scale: 3 }),
    h2hAvgRalliesPlayedPerMatch: numeric("h2h_avg_rallies_played_per_match", { precision: 8, scale: 3 }),
    h2hAvgRallyMarginPerGame: numeric("h2h_avg_rally_margin_per_game", { precision: 8, scale: 3 }),

    // h2h trends
    h2hMatchWinRateTrendPp: numeric("h2h_match_win_rate_trend_pp", { precision: 6, scale: 3 }),
    h2hGameWinRateTrendPp: numeric("h2h_game_win_rate_trend_pp", { precision: 6, scale: 3 }),
    h2hRallyWinRateTrendPp: numeric("h2h_rally_win_rate_trend_pp", { precision: 6, scale: 3 }),

    statsReliabilityScore: numeric("stats_reliability_score", { precision: 4, scale: 3 }),

    // recent form (most-recent-first)
    h2hLast5MatchesWon: integer("h2h_last5_matches_won").notNull().default(0),
    h2hLast5MatchesLost: integer("h2h_last5_matches_lost").notNull().default(0),
    h2hRecentResults: jsonb("h2h_recent_results").$type<("W" | "L")[]>(),
    h2hRecentMatchScores: jsonb("h2h_recent_match_scores").$type<string[]>(),

    // matchup interpretation (numbers / enum / flags only)
    matchupComfortIndex: numeric("matchup_comfort_index", { precision: 6, scale: 3 }),
    matchupStatus: matchupStatusEnum("matchup_status"),
    hasClosingProblemVsOpponent: boolean("has_closing_problem_vs_opponent").notNull().default(false),
    hasPositiveTrendVsOpponent: boolean("has_positive_trend_vs_opponent").notNull().default(false),
    isHighLoadOpponent: boolean("is_high_load_opponent").notNull().default(false),
    sampleSizeLevel: sampleSizeLevelEnum("sample_size_level"),

    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // one row per (player, opponent) within each scope; NULLs are distinct in
    // Postgres so per-scope partial uniques are required.
    uniqueIndex("pos_career_uq").on(t.playerId, t.opponentId).where(sql`${t.scope} = 'career'`),
    uniqueIndex("pos_season_uq")
      .on(t.playerId, t.opponentId, t.seasonId)
      .where(sql`${t.scope} = 'season'`),
    uniqueIndex("pos_season_division_uq")
      .on(t.playerId, t.opponentId, t.seasonId, t.division)
      .where(sql`${t.scope} = 'season_division'`),
    index("pos_player_idx").on(t.playerId),
    index("pos_player_scope_idx").on(t.playerId, t.scope),
    index("pos_opponent_idx").on(t.opponentId),
    index("pos_comfort_idx").on(t.matchupComfortIndex),
    index("pos_status_idx").on(t.matchupStatus),
    index("pos_calculated_at_idx").on(t.calculatedAt),
  ],
);

/**
 * Optional chart-series cache (section 9): one point per (player, metric,
 * season, stage). Lets the UI draw season/career trend charts without heavy
 * recomputation. Rebuilt from aggregates by the recalc service.
 */
export const playerMetricSeriesPoint = pgTable(
  "player_metric_series_point",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    metricKey: metricKeyEnum("metric_key").notNull(),
    seasonId: integer("season_id").references(() => seasons.id, { onDelete: "cascade" }),
    stageId: integer("stage_id").references(() => stages.id, { onDelete: "cascade" }),
    /** Order on the chart (stage number within a season). */
    orderIndex: integer("order_index").notNull(),
    label: text("label").notNull(),
    value: numeric("value", { precision: 12, scale: 3 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("pmsp_uq").on(t.playerId, t.metricKey, t.seasonId, t.stageId),
    index("pmsp_player_idx").on(t.playerId),
    index("pmsp_player_metric_idx").on(t.playerId, t.metricKey),
    index("pmsp_player_season_idx").on(t.playerId, t.seasonId),
  ],
);

/** Configurable place -> points table (per season, optionally per division). */
export const pointsTable = pgTable(
  "points_table",
  {
    id: serial("id").primaryKey(),
    // Strictly per division (no all-divisions variant).
    division: smallint("division").notNull(),
    // The table is in effect for stages on or after this date; the latest
    // effective table at a stage's date wins. Season-agnostic — a stage maps to
    // a table purely by its date, so the same rules carry across seasons.
    effectiveFrom: date("effective_from").notNull(),
    place: smallint("place").notNull(),
    // decimal — points may have tenths/hundredths, e.g. 20.50
    points: numeric("points", { precision: 7, scale: 2 }).notNull(),
  },
  (t) => [
    unique("points_table_uq").on(t.division, t.effectiveFrom, t.place),
    index("points_table_lookup_idx").on(t.division, t.effectiveFrom),
  ],
);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("admin"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- relations (query convenience) ---

export const seasonsRelations = relations(seasons, ({ many }) => ({
  stages: many(stages),
  rosters: many(rosters),
}));

export const stagesRelations = relations(stages, ({ one, many }) => ({
  season: one(seasons, { fields: [stages.seasonId], references: [seasons.id] }),
  stageDivisions: many(stageDivisions),
  results: many(results),
  matches: many(matches),
}));

export const stageDivisionsRelations = relations(stageDivisions, ({ one }) => ({
  stage: one(stages, { fields: [stageDivisions.stageId], references: [stages.id] }),
}));

export const playersRelations = relations(players, ({ many }) => ({
  results: many(results),
  rosters: many(rosters),
  rankedinAliases: many(playerRankedinAliases),
}));

export const playerRankedinAliasesRelations = relations(playerRankedinAliases, ({ one }) => ({
  player: one(players, { fields: [playerRankedinAliases.playerId], references: [players.id] }),
}));

export const resultsRelations = relations(results, ({ one }) => ({
  stage: one(stages, { fields: [results.stageId], references: [stages.id] }),
  player: one(players, { fields: [results.playerId], references: [players.id] }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  stage: one(stages, { fields: [matches.stageId], references: [stages.id] }),
  playerA: one(players, { fields: [matches.playerAId], references: [players.id] }),
  playerB: one(players, { fields: [matches.playerBId], references: [players.id] }),
  games: many(matchGames),
}));

export const matchGamesRelations = relations(matchGames, ({ one }) => ({
  match: one(matches, { fields: [matchGames.matchId], references: [matches.id] }),
  playerA: one(players, { fields: [matchGames.playerAId], references: [players.id] }),
  playerB: one(players, { fields: [matchGames.playerBId], references: [players.id] }),
}));

export const playerStatsAggregateRelations = relations(playerStatsAggregate, ({ one }) => ({
  player: one(players, { fields: [playerStatsAggregate.playerId], references: [players.id] }),
  season: one(seasons, { fields: [playerStatsAggregate.seasonId], references: [seasons.id] }),
  stage: one(stages, { fields: [playerStatsAggregate.stageId], references: [stages.id] }),
}));

export const playerOpponentStatsRelations = relations(playerOpponentStats, ({ one }) => ({
  player: one(players, { fields: [playerOpponentStats.playerId], references: [players.id] }),
  opponent: one(players, { fields: [playerOpponentStats.opponentId], references: [players.id] }),
}));

export type Season = typeof seasons.$inferSelect;
export type Player = typeof players.$inferSelect;
export type PlayerRankedinAlias = typeof playerRankedinAliases.$inferSelect;
export type Stage = typeof stages.$inferSelect;
export type StageDivision = typeof stageDivisions.$inferSelect;
export type Result = typeof results.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchGame = typeof matchGames.$inferSelect;
export type NewMatchGame = typeof matchGames.$inferInsert;
export type PlayerStatsAggregateRow = typeof playerStatsAggregate.$inferSelect;
export type NewPlayerStatsAggregate = typeof playerStatsAggregate.$inferInsert;
export type PlayerRatingHistoryRow = typeof playerRatingHistory.$inferSelect;
export type NewPlayerRatingHistory = typeof playerRatingHistory.$inferInsert;
export type PlayerOpponentStatsRow = typeof playerOpponentStats.$inferSelect;
export type NewPlayerOpponentStats = typeof playerOpponentStats.$inferInsert;
export type PlayerMetricSeriesPointRow = typeof playerMetricSeriesPoint.$inferSelect;
export type NewPlayerMetricSeriesPoint = typeof playerMetricSeriesPoint.$inferInsert;
export type PointsTableEntry = typeof pointsTable.$inferSelect;
