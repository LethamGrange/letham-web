-- Migration number: 0008 	 2026-09-02T10:32:38.140Z

ALTER TABLE syllabus_games RENAME COLUMN team_a_id TO team_a;
ALTER TABLE syllabus_games RENAME COLUMN team_b_id TO team_b;
