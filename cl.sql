PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_name TEXT UNIQUE NOT NULL
);
CREATE TABLE clubs_or_rinks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL, 
    type TEXT CHECK(type IN ('internal', 'external')) NOT NULL
);
CREATE TABLE matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_date TEXT NOT NULL,         
    match_time TEXT NOT NULL,         
    sheet TEXT CHECK(sheet IN ('A', 'B', 'C', 'D', 'E', 'F')) NOT NULL,
    competition_name TEXT NOT NULL,   

    
    team_a_id INTEGER REFERENCES clubs_or_rinks(id),
    team_b_id INTEGER REFERENCES clubs_or_rinks(id),

    
    team_a_skip TEXT, team_a_third TEXT, team_a_second TEXT, team_a_lead TEXT,
    team_b_skip TEXT, team_b_third TEXT, team_b_second TEXT, team_b_lead TEXT,

    final_score_a INTEGER DEFAULT 0,
    final_score_b INTEGER DEFAULT 0, team_a_ends TEXT, team_b_ends TEXT);
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user'
);
CREATE TABLE sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE syllabus_competition_reserves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competition_id INTEGER REFERENCES syllabus_competitions(id) ON DELETE CASCADE,
    player_name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE IF NOT EXISTS "syllabus_competitions" (
    id TEXT PRIMARY KEY,               
    season_year TEXT NOT NULL,
    name TEXT UNIQUE NOT NULL,
    kind TEXT NOT NULL,
    sub_kind TEXT DEFAULT 'full'
, reserves TEXT);
CREATE TABLE IF NOT EXISTS "syllabus_teams" (
    id TEXT PRIMARY KEY,               
    competition_id TEXT,               
    team_index INTEGER NOT NULL,
    team_name TEXT NOT NULL,
    FOREIGN KEY(competition_id) REFERENCES "syllabus_competitions"(id) ON DELETE CASCADE
);
CREATE TABLE syllabus_fixtures (
    id TEXT PRIMARY KEY,
    competition_id TEXT NOT NULL,
    fixture_date TEXT,                 
    fixture_time TEXT,                 
    FOREIGN KEY(competition_id) REFERENCES syllabus_competitions(id) ON DELETE CASCADE
);
CREATE TABLE syllabus_games (
    id TEXT PRIMARY KEY,
    fixture_id TEXT NOT NULL,          
    team_a_id TEXT,                    
    team_b_id TEXT, sequence INTEGER DEFAULT 0,                    
    FOREIGN KEY(fixture_id) REFERENCES syllabus_fixtures(id) ON DELETE CASCADE,
    FOREIGN KEY(team_a_id) REFERENCES syllabus_teams(id) ON DELETE SET NULL,
    FOREIGN KEY(team_b_id) REFERENCES syllabus_teams(id) ON DELETE SET NULL
);
CREATE TABLE syllabus_team_players (
    id TEXT PRIMARY KEY,
    team_id TEXT,
    name TEXT NOT NULL,
    role TEXT CHECK(role IN ('skip', 'third', 'second', 'lead', 'regular')) DEFAULT 'regular',
    FOREIGN KEY(team_id) REFERENCES syllabus_teams(id) ON DELETE CASCADE
);
CREATE TABLE syllabus_team_pool_players (
    id TEXT PRIMARY KEY,
    team_id TEXT,
    name TEXT NOT NULL,
    FOREIGN KEY(team_id) REFERENCES syllabus_teams(id) ON DELETE CASCADE
);
DELETE FROM sqlite_sequence;