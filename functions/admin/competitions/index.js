import { html } from '../../helpers/html.js';
import { nanoid } from 'nanoid';

export async function onRequestPost(context) {
  const db = context.env.curling_league;
  const formData = await context.request.formData();
  const fields = await parseAndValidateScorecard(formData);
  const seasonYear = '2026';
  const { name, kind, reserves = '' } = fields;
  const compId = fields.id || nanoid(12);

  const { teams: teamsMap, fixtures: fixturesMap } = fields;
  const statements = [];
  const activeTeamIds = Array.from(teamsMap.keys());
  const activeFixtureIds = Array.from(fixturesMap.keys());

  // 1. Pre-compile statements outside of loops
  const compUpsertSql = db.prepare(`
    INSERT INTO competitions (id, season_year, name, kind, reserves)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = EXCLUDED.name, kind = EXCLUDED.kind,
      season_year = EXCLUDED.season_year, reserves = EXCLUDED.reserves
  `);

  const teamUpsertSql = db.prepare(`
    INSERT INTO competition_teams (id, competition_id, team_index, team_name)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      team_name = EXCLUDED.team_name, team_index = EXCLUDED.team_index
  `);

  const playerUpsertSql = db.prepare(`
    INSERT INTO team_players (id, team_id, name, role)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
  `);

  const poolUpsertSql = db.prepare(`
    INSERT INTO pool_players (id, team_id, name)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = EXCLUDED.name
  `);

  const fixtureUpsertSql = db.prepare(`
    INSERT INTO fixtures (id, competition_id, fixture_date, fixture_time)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      fixture_date = EXCLUDED.fixture_date, fixture_time = EXCLUDED.fixture_time
  `);

  const gameUpsertSql = db.prepare(`
    INSERT INTO games (id, fixture_id, sequence, team_a, team_b)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      team_a = EXCLUDED.team_a,
      team_b = EXCLUDED.team_b,
      sequence = EXCLUDED.sequence
  `);

  // 2. Queue Competition Upsert
  statements.push(compUpsertSql.bind(compId, seasonYear, name, kind, reserves));

  // 3. Garbage Collect Stale Teams (Scoped strictly to this competition)
  // If a team is deleted here, its players will auto-cascade delete via the DB!
  if (activeTeamIds.length > 0) {
    const placeholders = activeTeamIds.map(() => '?').join(',');
    statements.push(
      db
        .prepare(`DELETE FROM competition_teams WHERE competition_id = ? AND id NOT IN (${placeholders})`)
        .bind(compId, ...activeTeamIds),
    );
  } else {
    statements.push(db.prepare(`DELETE FROM competition_teams WHERE competition_id = ?`).bind(compId));
  }

  // 4. Process Teams and individual Player changes
  for (const [teamId, teamData] of teamsMap.entries()) {
    statements.push(teamUpsertSql.bind(teamId, compId, teamData.index, teamData.name));

    const savedPlayerIds = Array.from(teamData.players.keys());
    const savedPoolPlayerIds = Array.from(teamData.poolPlayers.keys());

    // Process Regular Players
    for (const [playerId, playerData] of teamData.players.entries()) {
      statements.push(playerUpsertSql.bind(playerId, teamId, playerData.name, playerData.role));
    }

    // Programmatic Player GC for surviving teams
    if (savedPlayerIds.length > 0) {
      const placeholders = savedPlayerIds.map(() => '?').join(',');
      statements.push(
        db
          .prepare(`DELETE FROM team_players WHERE team_id = ? AND id NOT IN (${placeholders})`)
          .bind(teamId, ...savedPlayerIds),
      );
    } else {
      statements.push(db.prepare(`DELETE FROM team_players WHERE team_id = ?`).bind(teamId));
    }

    // Process Pool Players
    for (const [playerId, playerData] of teamData.poolPlayers.entries()) {
      statements.push(poolUpsertSql.bind(playerId, teamId, playerData.name));
    }

    // Programmatic Pool Player GC for surviving teams
    if (savedPoolPlayerIds.length > 0) {
      const placeholders = savedPoolPlayerIds.map(() => '?').join(',');
      statements.push(
        db
          .prepare(`DELETE FROM pool_players WHERE team_id = ? AND id NOT IN (${placeholders})`)
          .bind(teamId, ...savedPoolPlayerIds),
      );
    } else {
      statements.push(db.prepare(`DELETE FROM pool_players WHERE team_id = ?`).bind(teamId));
    }
  }

  // 5. Garbage Collect Stale Fixtures (Scoped strictly to this competition)
  if (activeFixtureIds.length > 0) {
    const placeholders = activeFixtureIds.map(() => '?').join(',');
    statements.push(
      db
        .prepare(`DELETE FROM fixtures WHERE competition_id = ? AND id NOT IN (${placeholders})`)
        .bind(compId, ...activeFixtureIds),
    );
  } else {
    statements.push(db.prepare(`DELETE FROM fixtures WHERE competition_id = ?`).bind(compId));
  }

  // 6. Process Fixtures and inner Game changes
  for (const [fixtureId, fixtureData] of fixturesMap.entries()) {
    statements.push(fixtureUpsertSql.bind(fixtureId, compId, fixtureData.date, fixtureData.time));

    const savedGameIds = Array.from(fixtureData.games.keys());

    // Process games sequentially to capture track rendering index position
    for (const [sequence, [gameId, gameData]] of Array.from(fixtureData.games.entries()).entries()) {
      statements.push(gameUpsertSql.bind(gameId, fixtureId, sequence, gameData.team_a, gameData.team_b));
    }

    // Programmatic Game GC for surviving fixtures
    if (savedGameIds.length > 0) {
      const placeholders = savedGameIds.map(() => '?').join(',');
      statements.push(
        db
          .prepare(`DELETE FROM games WHERE fixture_id = ? AND id NOT IN (${placeholders})`)
          .bind(fixtureId, ...savedGameIds),
      );
    } else {
      statements.push(db.prepare(`DELETE FROM games WHERE fixture_id = ?`).bind(fixtureId));
    }
  }

  // 5. Execute batch transaction
  try {
    await db.batch(statements);
    // Convert your internal working Map models into clean JSON layout arrays
    const formattedData = serializeCompetitionMapsToArrays(fields);

    return new Response(
      JSON.stringify({
        success: true,
        competitionSummary: { id: compId, name, kind, season_year: seasonYear }, // For the sidebar list
        fullModel: formattedData, // 👈 Passed directly to this.savedModelBackup and hydrate()!
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (e) {
    return new Response(`Syllabus Save Error: ${e.message}`, { status: 500 });
  }
}

function serializeCompetitionMapsToArrays(competition) {
  // Convert teams Map to an Array
  const teamsArray = Array.from(competition.teams.values()).map(team => {
    return {
      ...team,
      players: Array.from(team.players.values()),
      pool_players: Array.from(team.poolPlayers.values()), // Fixes poolPlayers camelCase mismatch!
    };
  });

  // Convert fixtures Map to an Array
  const fixturesArray = Array.from(competition.fixtures.values()).map(fixture => {
    return {
      ...fixture,
      games: Array.from(fixture.games.values()),
    };
  });

  return {
    id: competition.id,
    name: competition.name,
    kind: competition.kind,
    reserves: competition.reserves,
    teams: teamsArray,
    fixtures: fixturesArray,
  };
}

async function parseAndValidateScorecard(formData) {
  const competition = {};

  ['id', 'name', 'kind', 'reserves'].forEach(key => {
    competition[key] = formData.get(`competition[${key}]`);
  });

  const teamsMap = new Map();
  const fixturesMap = new Map();

  const getOrCreateTeam = teamId => {
    if (!teamsMap.has(teamId)) {
      teamsMap.set(teamId, { name: '', players: new Map(), poolPlayers: new Map() });
    }
    return teamsMap.get(teamId);
  };

  const getOrCreateFixture = fixtureId => {
    if (!fixturesMap.has(fixtureId)) {
      fixturesMap.set(fixtureId, { date: '', time: '', games: new Map() });
    }
    return fixturesMap.get(fixtureId);
  };

  Array.from(formData.entries()).forEach(([fieldName, value], loopIndex) => {
    const stringVal = value.toString().trim();

    // 1. Team Name Match
    const teamMatch = fieldName.match(/^team\[([^\]]+)\]\.name$/);
    if (teamMatch) {
      const teamId = teamMatch[1];
      const team = getOrCreateTeam(teamId);
      team.name = stringVal;
      team.index = loopIndex;
      return;
    }

    // 2. Player / Poolplayer Match
    const playerMatch = fieldName.match(/^team\[([^\]]+)\]\.(player|poolplayer)\[([^\]]+)\]\.(name|role)$/);
    if (playerMatch) {
      const [_, teamId, playerType, playerId, property] = playerMatch;

      // Defensive: skip role assignment for pool players to keep objects clean
      if (playerType === 'poolplayer' && property === 'role') return;

      const team = getOrCreateTeam(teamId);
      const isPool = playerType === 'poolplayer';
      const targetMap = isPool ? team.poolPlayers : team.players;

      if (!targetMap.has(playerId)) {
        const defaultObject = isPool ? { id: playerId, name: '' } : { id: playerId, name: '', role: 'regular' };
        targetMap.set(playerId, defaultObject);
      }

      targetMap.get(playerId)[property] = stringVal;
      return;
    }

    // 3. Fixture Metadata Match (Date/Time)
    const fixtureMatch = fieldName.match(/^draw\[([^\]]+)\]\.(date|time)$/);
    if (fixtureMatch) {
      const [_, fixtureId, property] = fixtureMatch;
      const fixture = getOrCreateFixture(fixtureId);
      fixture[property] = stringVal;
      return;
    }

    // 4. Game Match (Teams inside a fixture draw)
    const gameMatch = fieldName.match(/^draw\[([^\]]+)\]\.game\[([^\]]+)\]\.(team_a|team_b)$/);
    if (gameMatch) {
      const [_, fixtureId, gameId, property] = gameMatch;
      const fixture = getOrCreateFixture(fixtureId);
      const gamesMap = fixture.games;

      if (!gamesMap.has(gameId)) {
        gamesMap.set(gameId, { id: gameId, team_a: '', team_b: '' });
      }
      gamesMap.get(gameId)[property] = stringVal;
      return;
    }
  });

  competition.teams = teamsMap;
  competition.fixtures = fixturesMap;

  return competition;
}
