-- Migration number: 0003 	 2026-08-28T09:22:10.747Z
-- PRAGMA foreign_keys = OFF is handled automatically by D1 migrations,
-- but we write clean independent definitions just in case.

-- ====================================================================
-- STEP 1: CREATE ALL THE NEW TEXT-BASED TABLES
-- ====================================================================

CREATE TABLE syllabus_competitions_new (
    id TEXT PRIMARY KEY,               -- Changed to TEXT
    season_year TEXT NOT NULL,
    name TEXT UNIQUE NOT NULL,
    kind TEXT NOT NULL,
    sub_kind TEXT DEFAULT 'full'
);

CREATE TABLE syllabus_teams_new (
    id TEXT PRIMARY KEY,               -- Changed to TEXT
    competition_id TEXT,               -- Changed to TEXT
    team_index INTEGER NOT NULL,
    team_name TEXT NOT NULL,
    FOREIGN KEY(competition_id) REFERENCES syllabus_competitions_new(id) ON DELETE CASCADE
);

CREATE TABLE syllabus_fixtures_new (
    id TEXT PRIMARY KEY,               -- Changed to TEXT
    competition_id TEXT,               -- Changed to TEXT
    fixture_date TEXT,
    fixture_time TEXT,
    sheet TEXT CHECK(sheet IN ('A', 'B', 'C', 'D', 'E', 'F')),
    team_a_index INTEGER,
    team_b_index INTEGER,
    external_versus TEXT,
    FOREIGN KEY(competition_id) REFERENCES syllabus_competitions_new(id) ON DELETE CASCADE
);

-- ====================================================================
-- STEP 2: COPY AND CAST EXISTING DATA
-- ====================================================================

-- Move Competitions
INSERT INTO syllabus_competitions_new (id, season_year, name, kind, sub_kind)
SELECT CAST(id AS TEXT), season_year, name, kind, sub_kind
FROM syllabus_competitions;

-- Move Teams (Casting both its own ID and the Parent Competition ID)
INSERT INTO syllabus_teams_new (id, competition_id, team_index, team_name)
SELECT CAST(id AS TEXT), CAST(competition_id AS TEXT), team_index, team_name
FROM syllabus_teams;

-- Move Fixtures
INSERT INTO syllabus_fixtures_new (id, competition_id, fixture_date, fixture_time, sheet, team_a_index, team_b_index, external_versus)
SELECT CAST(id AS TEXT), CAST(competition_id AS TEXT), fixture_date, fixture_time, sheet, team_a_index, team_b_index, external_versus
FROM syllabus_fixtures;

-- ====================================================================
-- STEP 3: DROP THE OLD TABLES (Order matters here due to dependencies)
-- ====================================================================

DROP TABLE syllabus_fixtures;
DROP TABLE syllabus_teams;
DROP TABLE syllabus_competitions;

-- ====================================================================
-- STEP 4: RENAME THE NEW TABLES TO THEIR OFFICIAL NAMES
-- ====================================================================

ALTER TABLE syllabus_competitions_new RENAME TO syllabus_competitions;
ALTER TABLE syllabus_teams_new RENAME TO syllabus_teams;
ALTER TABLE syllabus_fixtures_new RENAME TO syllabus_fixtures;
