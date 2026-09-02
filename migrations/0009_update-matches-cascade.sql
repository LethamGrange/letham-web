-- Migration number: 0009 	 2026-09-02T10:42:27.863Z
-- 1. Create the new table structure with explicit table-level Foreign Keys
CREATE TABLE matches_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_date TEXT NOT NULL,
    match_time TEXT NOT NULL,
    sheet TEXT CHECK(sheet IN ('A', 'B', 'C', 'D', 'E', 'F')) NOT NULL,
    competition_name TEXT NOT NULL,
    team_a_id INTEGER,
    team_b_id INTEGER,
    team_a_skip TEXT,
    team_a_third TEXT,
    team_a_second TEXT,
    team_a_lead TEXT,
    team_b_skip TEXT,
    team_b_third TEXT,
    team_b_second TEXT,
    team_b_lead TEXT,
    final_score_a INTEGER DEFAULT 0,
    final_score_b INTEGER DEFAULT 0,
    team_a_ends TEXT,
    team_b_ends TEXT,

    -- Explicit table-level constraints with safe deletion cascade
    FOREIGN KEY(team_a_id) REFERENCES clubs_or_rinks(id) ON DELETE SET NULL,
    FOREIGN KEY(team_b_id) REFERENCES clubs_or_rinks(id) ON DELETE SET NULL
);

-- 2. Safely migrate all existing data over to the new table
INSERT INTO matches_new (
    id, match_date, match_time, sheet, competition_name,
    team_a_id, team_b_id,
    team_a_skip, team_a_third, team_a_second, team_a_lead,
    team_b_skip, team_b_third, team_b_second, team_b_lead,
    final_score_a, final_score_b, team_a_ends, team_b_ends
)
SELECT
    id, match_date, match_time, sheet, competition_name,
    team_a_id, team_b_id,
    team_a_skip, team_a_third, team_a_second, team_a_lead,
    team_b_skip, team_b_third, team_b_second, team_b_lead,
    final_score_a, final_score_b, team_a_ends, team_b_ends
FROM matches;

-- 3. Drop the old table completely
DROP TABLE matches;

-- 4. Rename the new table to replace the original
ALTER TABLE matches_new RENAME TO matches;

