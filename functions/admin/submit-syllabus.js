import { getDiaryHtml } from '../api/_get-diary-html';
import { html } from '../helpers/html.js';
import { nanoid } from 'nanoid';

export async function onRequestPost(context) {
  const db = context.env.curling_league;
  const formData = await context.request.formData();
  const fields = await parseAndValidateScorecard(formData, db);

  const seasonYear = '2026';

  console.log(fields);

  const { id, name, kind, reserves = '' } = fields;

  if (!id) id == nanoid(12);

  const statements = [];
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
      .bind(id, seasonYear, name, kind, reserves),
  );

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

export async function onRequestPutX(context) {
  const db = context.env.curling_league;
  const formData = await context.request.formData();
  const compId = parseInt(formData.get('competition_id'));

  if (!compId) {
    return new Response('Missing modification identity tracking variable.', { status: 400 });
  }

  try {
    const compName = formData.get('competition_name');
    const compKind = formData.get('competition_kind');

    // 1. Update Overarching Master parameters
    await db
      .prepare(`UPDATE syllabus_competitions SET name = ?, kind = ? WHERE id = ?`)
      .bind(compName, compKind, compId)
      .run();

    // 2. Cascade WIPE dependent historic child relationships to prepare a fresh rewrite path
    await db.prepare(`DELETE FROM syllabus_competition_reserves WHERE competition_id = ?`).bind(compId).run();
    await db.prepare(`DELETE FROM syllabus_fixtures WHERE competition_id = ?`).bind(compId).run();
    // This wipe naturally triggers cascading deletions on player child tables via your SQL schema rules!
    await db.prepare(`DELETE FROM syllabus_teams WHERE competition_id = ?`).bind(compId).run();

    // ========================================================
    // REWRITE PATHWAY: Re-run your standard extraction loops
    // ========================================================

    // Save Reserves
    const compReservesStr = formData.get('competition_reserves');
    if (compReservesStr) {
      const reserves = compReservesStr
        .split(',')
        .map(name => name.trim())
        .filter(Boolean);
      for (const name of reserves) {
        await db
          .prepare(`INSERT INTO syllabus_competition_reserves (competition_id, player_name) VALUES (?, ?)`)
          .bind(compId, name)
          .run();
      }
    }

    // Save Teams and split-string player structures
    let t = 1;
    while (formData.has(`team_name_${t}`)) {
      let teamName = formData.get(`team_name_${t}`)?.trim();
      if (!teamName) teamName = `Team ${t}`;

      const teamInsert = await db
        .prepare(`INSERT INTO syllabus_teams (competition_id, team_index, team_name) VALUES (?, ?, ?) RETURNING id`)
        .bind(compId, t, teamName)
        .first();
      const teamId = teamInsert.id;

      // Process string-parsed Roster
      const rosterStr = formData.get(`team_${t}_roster`);
      if (rosterStr) {
        const playersArray = rosterStr
          .split(',')
          .map(p => p.trim())
          .filter(Boolean);
        for (const playerEntry of playersArray) {
          let name = playerEntry;
          let role = 'regular';
          if (name.toLowerCase().includes('(s)')) {
            role = 'skip';
            name = name.replace(/\([sS]\)/g, '').trim();
          }
          await db
            .prepare(`INSERT INTO syllabus_team_players (team_id, player_name, role) VALUES (?, ?, ?)`)
            .bind(teamId, name, role)
            .run();
        }
      }

      // Process string-parsed Pool
      const poolStr = formData.get(`team_${t}_pool`);
      if (poolStr) {
        const poolPlayers = poolStr
          .split(',')
          .map(name => name.trim())
          .filter(Boolean);
        for (const name of poolPlayers) {
          await db
            .prepare(`INSERT INTO syllabus_team_pool_players (team_id, player_name) VALUES (?, ?)`)
            .bind(teamId, name)
            .run();
        }
      }
      t++;
    }

    // Process Draw fixtures matrix loop
    let d = 1;
    while (formData.has(`draw_date_${d}`)) {
      const drawDate = formData.get(`draw_date_${d}`);
      const drawTime = formData.get(`draw_time_${d}`);

      let g = 0;
      while (formData.has(`draw_${d}_game_${g}_team_a`)) {
        const sheet = formData.get(`draw_${d}_game_${g}_sheet`);
        const teamA = formData.get(`draw_${d}_game_${g}_team_a`);
        const teamB = formData.get(`draw_${d}_game_${g}_team_b`);

        if (teamA && teamB) {
          await db
            .prepare(
              `
            INSERT INTO syllabus_fixtures (competition_id, fixture_date, fixture_time, sheet, team_a_index, team_b_index)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
            )
            .bind(compId, drawDate, drawTime, sheet, parseInt(teamA), parseInt(teamB))
            .run();
        }
        g++;
      }
      d++;
    }

    // Return the fresh public diary overview HTML fragment
    const diaryHtml = await getDiaryHtml(db);
    return new Response(html`<div id="diary-preview">${diaryHtml}</div>`, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    return new Response(`Modification Overwrite Failure: ${error.message}`, { status: 500 });
  }
}

async function parseAndValidateScorecard(formData, db) {
  const competition = {};

  ['id', 'name', 'kind', 'reserves'].forEach(key => {
    competition[`${key}`] = formData.get(`competition[${key}]`);
  });

  // // 1. Scan keys to find all active team indexes sent by the browser
  // const teamIndexes = Array.from(formData.keys())
  //   .filter(key => key.startsWith('team[') && key.endsWith('.name'))
  //   .map(key => {
  //     // Extracts the number inside the brackets, e.g., "team[3].name" -> 3
  //     const match = key.match(/team\[(\d+)\]/);
  //     return match ? parseInt(match[1], 10) : null;
  //   })
  //   .filter(index => index !== null)
  //   .sort((a, b) => a - b); // Keep them ordered
  //
  const teams = [];
  // for (const i of teamIndexes) {
  //   teams.push({
  //     name: formData.get(`team[${i}].name`),
  //     players: formData.get(`team[${i}].players`) || '',
  //     pool: formData.get(`team[${i}].pool`) || '',
  //   });
  // }

  competition.teams = teams;

  try {
    return competition;
  } catch (e) {
    console.log(e.toString());
  }
}
