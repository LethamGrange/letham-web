-- 1. Competing Entities (Can be internal rinks or external clubs)
-- Ensure this is the first line of your schema.sql file
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS clubs_or_rinks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL, -- UNIQUE is vital for our auto-creation logic
    type TEXT CHECK(type IN ('internal', 'external')) NOT NULL
);

-- 2. Master Match Record with all curling metadata
CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_date TEXT NOT NULL,         -- YYYY-MM-DD
    match_time TEXT NOT NULL,         -- e.g., "18:00" or "20:15"
    sheet TEXT CHECK(sheet IN ('A', 'B', 'C', 'D', 'E', 'F')) NOT NULL,
    competition_name TEXT NOT NULL,   -- e.g., "Club League", "Autumn Trophy", "Friendly"

    -- References to the teams/clubs playing
    team_a_id INTEGER REFERENCES clubs_or_rinks(id),
    team_b_id INTEGER REFERENCES clubs_or_rinks(id),

    -- Dynamic rosters for this specific game
    team_a_skip TEXT, team_a_third TEXT, team_a_second TEXT, team_a_lead TEXT,
    team_b_skip TEXT, team_b_third TEXT, team_b_second TEXT, team_b_lead TEXT,

    final_score_a INTEGER DEFAULT 0,
    final_score_b INTEGER DEFAULT 0
);

-- 3. Linescore (End-by-end details remain identical)
CREATE TABLE IF NOT EXISTS match_ends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
    end_number INTEGER NOT NULL,
    score_a INTEGER NOT NULL,
    score_b INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
