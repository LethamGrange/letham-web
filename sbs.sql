PRAGMA foreign_keys = ON;

-- 1. The Master Syllabus Competitions Tracker
CREATE TABLE IF NOT EXISTS syllabus_competitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_year TEXT NOT NULL,         -- e.g., "2025/2026"
    name TEXT UNIQUE NOT NULL,         -- e.g., "Bank of Scotland", "Super League Div 2"
    kind TEXT NOT NULL,                -- e.g., "league", "friendly", "points", "bonspiel", "match"
    sub_kind TEXT DEFAULT 'full'       -- e.g., 'full' or 'partial'
);

-- 2. Official Internal Teams/Rinks registered for a specific competition
CREATE TABLE IF NOT EXISTS syllabus_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competition_id INTEGER REFERENCES syllabus_competitions(id) ON DELETE CASCADE,
    team_index INTEGER NOT NULL,       -- Matches the index numbers (1, 2, 3) in your JSON fixtures array
    team_name TEXT NOT NULL            -- e.g., "Team 1", "Kirriemuir CC", "Forfar Gateway"
);

-- 3. The Live Games Diary (Syllabus Fixtures with complete nuancing support)
CREATE TABLE IF NOT EXISTS syllabus_fixtures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competition_id INTEGER REFERENCES syllabus_competitions(id) ON DELETE CASCADE,

    -- Nullable fields accommodate unconfirmed slots seamlessly
    fixture_date TEXT,                 -- YYYY-MM-DD (NULL if date is TBD)
    fixture_time TEXT,                 -- HH:MM (NULL if draw time is TBD)
    sheet TEXT CHECK(sheet IN ('A', 'B', 'C', 'D', 'E', 'F')), -- (NULL if sheet unassigned)

    -- Track matchups flexibly
    team_a_index INTEGER,              -- Points to team_index in syllabus_teams (NULL if bye)
    team_b_index INTEGER,              -- Points to team_index in syllabus_teams (NULL if bye)

    external_versus TEXT               -- e.g., "Dun" (NULL if it's an internal league match)
);
-- 1. Regular Rostered Players for a specific team
CREATE TABLE IF NOT EXISTS syllabus_team_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER REFERENCES syllabus_teams(id) ON DELETE CASCADE,
    player_name TEXT NOT NULL,
    role TEXT CHECK(role IN ('skip', 'third', 'second', 'lead', 'regular')) DEFAULT 'regular'
);

-- 2. Pool Players tied to a specific team (substitute pool)
CREATE TABLE IF NOT EXISTS syllabus_team_pool_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER REFERENCES syllabus_teams(id) ON DELETE CASCADE,
    player_name TEXT NOT NULL
);

-- 3. Competition-Wide Reserves (Available to any team in that league)
CREATE TABLE IF NOT EXISTS syllabus_competition_reserves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competition_id INTEGER REFERENCES syllabus_competitions(id) ON DELETE CASCADE,
    player_name TEXT NOT NULL
);

