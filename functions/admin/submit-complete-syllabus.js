import { getDiaryHtml } from '../api/_get-diary-html';
export async function onRequestPost(context) {
  const db = context.env.curling_league;
  const formData = await context.request.formData();

  try {
    const compName = formData.get('competition_name');
    const compKind = formData.get('competition_kind');

    // 1. Log overarching competition
    await db
      .prepare(`INSERT INTO syllabus_competitions (season_year, name, kind) VALUES ('2025/2026', ?, ?)`)
      .bind(compName, compKind)
      .run();
    const comp = await db.prepare(`SELECT id FROM syllabus_competitions WHERE name = ?`).bind(compName).first();
    const compId = comp.id;

    // A. Right after saving the core competition row, process Competition Reserves:
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

    // B. Inside your existing team processing while loop:
    let t = 1;
    while (formData.has(`team_name_${t}`)) {
      let teamName = formData.get(`team_name_${t}`)?.trim();
      if (!teamName) teamName = `Team ${t}`;

      // Save base team row and grab last inserted row ID
      const teamInsert = await db
        .prepare(`INSERT INTO syllabus_teams (competition_id, team_index, team_name) VALUES (?, ?, ?) RETURNING id`)
        .bind(compId, t, teamName)
        .first();
      const teamId = teamInsert.id;

      // 1. Process and save the 4 primary roster positions
      const positions = ['skip', 'third', 'second', 'lead'];
      for (const pos of positions) {
        const pName = formData.get(`team_${t}_player_${pos}`)?.trim();
        if (pName) {
          await db
            .prepare(`INSERT INTO syllabus_team_players (team_id, player_name, role) VALUES (?, ?, ?)`)
            .bind(teamId, pName, pos)
            .run();
        }
      }

      // Inside your team processing while loop on the backend:
      const rosterStr = formData.get(`team_${t}_roster`); // Pull the single comma-separated text string

      if (rosterStr) {
        // 1. Split the string by commas to get individual player entries
        const playersArray = rosterStr
          .split(',')
          .map(p => p.trim())
          .filter(Boolean);

        for (const playerEntry of playersArray) {
          let name = playerEntry;
          let role = 'regular'; // Default role state

          // 2. Check if the entry contains the skip flag string "(s)"
          if (name.toLowerCase().includes('(s)')) {
            role = 'skip';
            // Clean up the name string by stripping out the "(s)" or "(S)" tag and cleaning spaces
            name = name.replace(/\([sS]\)/g, '').trim();
          }

          // 3. Save to D1 using the dynamically parsed properties!
          await db
            .prepare(
              `
      INSERT INTO syllabus_team_players (team_id, player_name, role)
      VALUES (?, ?, ?)
    `,
            )
            .bind(teamId, name, role)
            .run();
        }
      }
      t++;
    }
    // 3. Process Draw rounds array (Matches your existing nested structure perfectly)
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

    // Return the fresh public diary view html component seamlessly
    const diaryHtml = await getDiaryHtml(db);
    return new Response(`<div id="diary-preview">${diaryHtml}</div>`, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (e) {
    return new Response(`Syllabus Save Error: ${e.message}`, { status: 500 });
  }
}

export async function onRequestPut(context) {
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
    return new Response(`<div id="diary-preview">${diaryHtml}</div>`, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    return new Response(`Modification Overwrite Failure: ${error.message}`, { status: 500 });
  }
}
