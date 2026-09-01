import { getDiaryHtml } from '../api/_get-diary-html';
import { html } from '../helpers/html.js';
import { nanoid } from 'nanoid';

export async function onRequestPost(context) {
  const db = context.env.curling_league;
  const formData = await context.request.formData();
  const fields = await parseAndValidateScorecard(formData, db);

  const seasonYear = '2026';

  console.log(fields);

  const { name, kind, reserves = '' } = fields;
  const compId = fields.id || nanoid(12);

  const statements = [];
  const activeTeamIds = [];

  statements.push(
    db
      .prepare(
        `
      INSERT INTO syllabus_competitions (id, season_year, name, kind, reserves)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = EXCLUDED.name,
        kind = EXCLUDED.kind,
        season_year = EXCLUDED.season_year,
        reserves = EXCLUDED.reserves
    `,
      )
      .bind(compId, seasonYear, name, kind, reserves),
  );

  const { teams: teamsMap } = fields;

  for (const [teamId, teamData] of teamsMap.entries()) {
    // A. Unified Team Upsert (Insert if new, Update name if it already exists)
    statements.push(
      db
        .prepare(
          `
    INSERT INTO syllabus_teams (id, competition_id, team_index, team_name)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      team_name = excluded.team_name,
      team_index = excluded.team_index
  `,
        )
        .bind(teamId, compId, teamData.index, teamData.name),
    );
    activeTeamIds.push(teamId);

    // B. Unified Player Upsert for this Team
    const savedPlayerIds = [];

    for (const [playerId, playerData] of teamData.players.entries()) {
      statements.push(
        db
          .prepare(
            `
        INSERT INTO syllabus_team_players (id, team_id, name, role)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, role = excluded.role
      `,
          )
          .bind(playerId, teamId, playerData.name, playerData.role),
      );
      savedPlayerIds.push(playerId);
    }

    // C. Garbage Collect Deleted Players for this team
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

    // B. Unified Player Upsert for this Team
    const savedPoolPlayerIds = [];

    for (const [playerId, playerData] of teamData.poolPlayers.entries()) {
      statements.push(
        db
          .prepare(
            `
        INSERT INTO syllabus_team_pool_players (id, team_id, name)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name
      `,
          )
          .bind(playerId, teamId, playerData.name),
      );
      savedPoolPlayerIds.push(playerId);
    }

    // C. Garbage Collect Deleted Players for this team
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

  // D. Garbage Collect Completely Deleted Teams
  if (activeTeamIds.length > 0) {
    const placeholders = activeTeamIds.map(() => '?').join(',');
    statements.push(db.prepare(`DELETE FROM syllabus_teams WHERE id NOT IN (${placeholders})`).bind(...activeTeamIds));
  }

  try {
    // console.log(statements);
    const results = await db.batch(statements);
    // Return the fresh public diary view html component seamlessly
    const diaryHtml = await getDiaryHtml(db);
    return new Response(html`<div id="diary-preview">${diaryHtml}</div>`, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (e) {
    return new Response(`Syllabus Save Error: ${e.message}`, { status: 500 });
  }
}

async function parseAndValidateScorecard(formData, db) {
  const competition = {};

  ['id', 'name', 'kind', 'reserves'].forEach(key => {
    competition[`${key}`] = formData.get(`competition[${key}]`);
  });
  // Create a structured map of our teams and their players
  const teamsMap = new Map();
  let index = 0;
  // 1. Loop through all fields sequentially
  for (const [fieldName, value] of formData.entries()) {
    const stringVal = value.toString().trim();

    // Check for Team Name: team[TEAM_ID].name
    const teamMatch = fieldName.match(/^team\[([^\]]+)\]\.name$/);
    if (teamMatch) {
      const teamId = teamMatch[1];
      if (!teamsMap.has(teamId)) teamsMap.set(teamId, { name: stringVal, players: new Map(), poolPlayers: new Map() });
      teamsMap.get(teamId).name = stringVal;
      teamsMap.get(teamId).index = index++;
      continue;
    }

    // Check for Player Attributes: team[TEAM_ID].player[PLAYER_ID].PROPERTY
    const playerMatch = fieldName.match(/^team\[([^\]]+)\]\.player\[([^\]]+)\]\.(name|role)$/);
    if (playerMatch) {
      const [_, teamId, playerId, property] = playerMatch;

      if (!teamsMap.has(teamId)) teamsMap.set(teamId, { name: '', players: new Map(), poolPlayers: new Map() });
      const team = teamsMap.get(teamId);

      if (!team.players.has(playerId)) {
        team.players.set(playerId, { id: playerId, name: '', role: 'regular' });
      }
      team.players.get(playerId)[property] = stringVal;
    }

    // Check for Player Attributes: team[TEAM_ID].player[PLAYER_ID].PROPERTY
    const poolPlayerMatch = fieldName.match(/^team\[([^\]]+)\]\.poolplayer\[([^\]]+)\]\.(name|role)$/);
    if (poolPlayerMatch) {
      const [_, teamId, playerId, property] = poolPlayerMatch;

      if (!teamsMap.has(teamId)) teamsMap.set(teamId, { name: '', players: new Map(), poolPlayers: new Map() });
      const team = teamsMap.get(teamId);

      if (!team.poolPlayers.has(playerId)) {
        team.poolPlayers.set(playerId, { id: playerId, name: '' });
      }
      team.poolPlayers.get(playerId)[property] = stringVal;
    }
  }

  console.log(teamsMap);

  // 1. Scan keys to find all active team indexes sent by the browser
  const teamIndexes = Array.from(formData.keys())
    .filter(key => key.startsWith('team[') && key.endsWith('.name'))
    .map(key => {
      // Extracts the number inside the brackets, e.g., "team[3].name" -> 3
      const match = key.match(/team\[([\w\d-_]+)\]/);
      return match[1];
    })
    .filter(index => index !== null);

  const teams = [];
  for (const [index, key] of teamIndexes.entries()) {
    teams.push({
      id: key,
      index: index + 1,
      name: formData.get(`team[${key}].name`),
      players: formData.get(`team[${key}].players`) || '',
      pool: formData.get(`team[${key}].pool`) || '',
    });
  }

  competition.teams = teamsMap;

  try {
    return competition;
  } catch (e) {
    console.log(e.toString());
  }
}
