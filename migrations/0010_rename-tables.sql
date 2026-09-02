-- Migration number: 0010 	 2026-09-02T16:15:10.540Z
ALTER TABLE syllabus_competitions          RENAME TO competitions;
ALTER TABLE syllabus_competition_reserves  RENAME TO competition_reserves;
ALTER TABLE syllabus_teams                 RENAME TO competition_teams;
ALTER TABLE syllabus_team_players      RENAME TO team_players;
ALTER TABLE syllabus_team_pool_players RENAME TO pool_players;
ALTER TABLE syllabus_fixtures RENAME TO fixtures;
ALTER TABLE syllabus_games RENAME TO games;

