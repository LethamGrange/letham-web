-- Migration number: 0004 	 2026-08-28T09:37:50.976Z
-- 1. Drop the old problematic table
DROP TABLE IF EXISTS syllabus_fixtures;

-- 2. Create the clean, normalized Fixtures table
CREATE TABLE syllabus_fixtures (
    id TEXT PRIMARY KEY,
    competition_id TEXT NOT NULL,
    fixture_date TEXT,                 -- YYYY-MM-DD
    fixture_time TEXT,                 -- HH:MM
    FOREIGN KEY(competition_id) REFERENCES syllabus_competitions(id) ON DELETE CASCADE
);

-- 3. Create the new Games table linked to both Fixtures and Teams
CREATE TABLE syllabus_games (
    id TEXT PRIMARY KEY,
    fixture_id TEXT NOT NULL,          -- Fixed typo from 'fixtures_id' to singular
    sheet TEXT CHECK(sheet IN ('A', 'B', 'C', 'D', 'E', 'F')),
    team_a_id TEXT,                    -- Now links directly to the text-based team ID
    team_b_id TEXT,                    -- Now links directly to the text-based team ID
    FOREIGN KEY(fixture_id) REFERENCES syllabus_fixtures(id) ON DELETE CASCADE,
    FOREIGN KEY(team_a_id) REFERENCES syllabus_teams(id) ON DELETE SET NULL,
    FOREIGN KEY(team_b_id) REFERENCES syllabus_teams(id) ON DELETE SET NULL
);
