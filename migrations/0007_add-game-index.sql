-- Migration number: 0007 	 2026-09-02T09:58:27.509Z
ALTER TABLE syllabus_games DROP COLUMN Sheet;
ALTER TABLE syllabus_games ADD COLUMN sequence INTEGER DEFAULT 0;



