import { getDiaryHtml } from '../api/_get-diary-html';
import { html } from '../helpers/html.js';
import { nanoid } from 'nanoid';

export async function onRequestPost(context) {
  const db = context.env.curling_league;
  const formData = await context.request.formData();
  const fields = await parseAndValidateScorecard(formData);

  const seasonYear = '2026';
  const { name, kind, reserves = '' } = fields;
  const compId = fields.id || nanoid(12);

  const { teams: teamsMap } = fields;
  const statements = [];
  const activeTeamIds = Array.from(teamsMap.keys());

  // 1. Pre-compile statements outside of loops
  const compUpsertSql = db.prepare(`
    INSERT INTO syllabus_competitions (id, season_year, name, kind, reserves)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = EXCLUDED.name, kind = EXCLUDED.kind,
      season_year = EXCLUDED.season_year, reserves = EXCLUDED.reserves
  `);

  const teamUpsertSql = db.prepare(`
    INSERT INTO syllabus_teams (id, competition_id, team_index, team_name)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      team_name = EXCLUDED.team_name, team_index = EXCLUDED.team_index
  `);

  const playerUpsertSql = db.prepare(`
    INSERT INTO syllabus_team_players (id, team_id, name, role)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
  `);

  const poolUpsertSql = db.prepare(`
    INSERT INTO syllabus_team_pool_players (id, team_id, name)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = EXCLUDED.name
  `);

  // 2. Queue Competition Upsert
  statements.push(compUpsertSql.bind(compId, seasonYear, name, kind, reserves));

  // 3. Garbage Collect Stale Teams (Scoped strictly to this competition)
  // If a team is deleted here, its players will auto-cascade delete via the DB!
  if (activeTeamIds.length > 0) {
    const placeholders = activeTeamIds.map(() => '?').join(',');
    statements.push(
      db
        .prepare(`DELETE FROM syllabus_teams WHERE competition_id = ? AND id NOT IN (${placeholders})`)
        .bind(compId, ...activeTeamIds),
    );
  } else {
    statements.push(db.prepare(`DELETE FROM syllabus_teams WHERE competition_id = ?`).bind(compId));
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
          .prepare(`DELETE FROM syllabus_team_players WHERE team_id = ? AND id NOT IN (${placeholders})`)
          .bind(teamId, ...savedPlayerIds),
      );
    } else {
      statements.push(db.prepare(`DELETE FROM syllabus_team_players WHERE team_id = ?`).bind(teamId));
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
          .prepare(`DELETE FROM syllabus_team_pool_players WHERE team_id = ? AND id NOT IN (${placeholders})`)
          .bind(teamId, ...savedPoolPlayerIds),
      );
    } else {
      statements.push(db.prepare(`DELETE FROM syllabus_team_pool_players WHERE team_id = ?`).bind(teamId));
    }
  }

  // 5. Execute batch transaction
  try {
    await db.batch(statements);
    const diaryHtml = await getDiaryHtml(db);
    return new Response(html`<div id="diary-preview">${diaryHtml}</div>`, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (e) {
    return new Response(`Syllabus Save Error: ${e.message}`, { status: 500 });
  }
}

async function parseAndValidateScorecard(formData) {
  const competition = {};

  ['id', 'name', 'kind', 'reserves'].forEach(key => {
    competition[key] = formData.get(`competition[${key}]`);
  });

  const teamsMap = new Map();

  const getOrCreateTeam = teamId => {
    if (!teamsMap.has(teamId)) {
      teamsMap.set(teamId, { name: '', players: new Map(), poolPlayers: new Map() });
    }
    return teamsMap.get(teamId);
  };

  // Convert the iterator to an array and use the native loop index argument
  Array.from(formData.entries()).forEach(([fieldName, value], loopIndex) => {
    const stringVal = value.toString().trim();

    // 1. Check for Team Name: team[TEAM_ID].name
    const teamMatch = fieldName.match(/^team\[([^\]]+)\]\.name$/);
    if (teamMatch) {
      const teamId = teamMatch[1];
      const team = getOrCreateTeam(teamId);
      team.name = stringVal;

      // We still selectively track the rendering order position here
      team.index = loopIndex;
      return; // Acts like 'continue' inside a .forEach loop
    }

    // 2. Combined Match for Player OR Poolplayer
    const playerMatch = fieldName.match(/^team\[([^\]]+)\]\.(player|poolplayer)\[([^\]]+)\]\.(name|role)$/);
    if (playerMatch) {
      const [_, teamId, playerType, playerId, property] = playerMatch;
      const team = getOrCreateTeam(teamId);

      const isPool = playerType === 'poolplayer';
      const targetMap = isPool ? team.poolPlayers : team.players;

      if (!targetMap.has(playerId)) {
        const defaultObject = isPool ? { id: playerId, name: '' } : { id: playerId, name: '', role: 'regular' };
        targetMap.set(playerId, defaultObject);
      }

      targetMap.get(playerId)[property] = stringVal;
    }
  });

  competition.teams = teamsMap;
  return competition;
}
