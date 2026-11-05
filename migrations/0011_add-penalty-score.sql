-- Migration number: 0011 	 2026-11-05T15:18:05.881Z

ALTER TABLE matches ADD COLUMN penalty_score_a INTEGER DEFAULT 0;
ALTER TABLE matches ADD COLUMN penalty_score_b INTEGER DEFAULT 0;
