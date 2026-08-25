-- Migration number: 0001 	 2026-08-25T11:20:08.253Z
ALTER TABLE matches ADD COLUMN team_a_ends TEXT;
ALTER TABLE matches ADD COLUMN team_b_ends TEXT;


