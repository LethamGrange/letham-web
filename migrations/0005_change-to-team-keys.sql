-- Migration number: 0005 	 2026-08-28T14:03:05.453Z
DROP TABLE IF EXISTS syllabus_team_players;

CREATE TABLE syllabus_team_players (
    id TEXT PRIMARY KEY,
    team_id TEXT,
    name TEXT NOT NULL,
    role TEXT CHECK(role IN ('skip', 'third', 'second', 'lead', 'regular')) DEFAULT 'regular',
    FOREIGN KEY(team_id) REFERENCES syllabus_teams(id) ON DELETE CASCADE
);


DROP TABLE IF EXISTS syllabus_team_pool_players;

CREATE TABLE syllabus_team_pool_players (
    id TEXT PRIMARY KEY,
    team_id TEXT,
    name TEXT NOT NULL,
    FOREIGN KEY(team_id) REFERENCES syllabus_teams(id) ON DELETE CASCADE
);

