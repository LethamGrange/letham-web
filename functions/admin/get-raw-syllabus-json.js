export async function onRequestGet(context) {
  const db = context.env.curling_league;
  const url = new URL(context.request.url);
  const compId = url.searchParams.get('id');

  if (!compId) {
    return new Response(JSON.stringify({ error: 'Missing identity' }), { status: 400 });
  }

  try {
    // 1. Grab Core Competition Parameter Details
    const comp = await db.prepare(`SELECT * FROM syllabus_competitions WHERE id = ?`).bind(compId).first();
    if (!comp) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    //
    // // 2. Gather Reserves
    // const { results: reserves } = await db
    //   .prepare(`SELECT player_name FROM syllabus_competition_reserves WHERE competition_id = ?`)
    //   .bind(compId)
    //   .all();
    //
    // // 3. Gather Teams and reconstruct their players/pools strings
    // const { results: teams } = await db
    //   .prepare(`SELECT id, team_name, team_index FROM syllabus_teams WHERE competition_id = ? ORDER BY team_index ASC`)
    //   .bind(compId)
    //   .all();
    // const { results: players } = await db
    //   .prepare(
    //     `SELECT * FROM syllabus_team_players WHERE team_id IN (SELECT id FROM syllabus_teams WHERE competition_id = ?)`,
    //   )
    //   .bind(compId)
    //   .all();
    // const { results: pools } = await db
    //   .prepare(
    //     `SELECT * FROM syllabus_team_pool_players WHERE team_id IN (SELECT id FROM syllabus_teams WHERE competition_id = ?)`,
    //   )
    //   .bind(compId)
    //   .all();
    //
    // const formattedTeams = teams.map(t => {
    //   const teamPlayers = players.filter(p => p.team_id === t.id);
    //   const teamPool = pools.filter(p => p.team_id === t.id);
    //
    //   // Reconstruct the comma-separated text roster line, appending (s) to the skip
    //   const rosterList = teamPlayers.map(p => (p.role === 'skip' ? `${p.player_name} (s)` : p.player_name));
    //
    //   return {
    //     team_index: t.team_index,
    //     team_name: t.team_name,
    //     roster_string: rosterList.join(', '),
    //     pool_string: teamPool.map(p => p.player_name).join(', '),
    //   };
    // });
    //
    // // 4. Gather Fixtures grouped by distinct Draw rounds
    // const { results: fixtures } = await db
    //   .prepare(
    //     `SELECT * FROM syllabus_fixtures WHERE competition_id = ? ORDER BY fixture_date ASC, fixture_time ASC, sheet ASC`,
    //   )
    //   .bind(compId)
    //   .all();
    //
    // Group individual games by matching Date and Time into discrete draws
    // const drawsMap = new Map();
    // fixtures.forEach(f => {
    //   const key = `${f.fixture_date}_${f.fixture_time}`;
    //   if (!drawsMap.has(key)) {
    //     drawsMap.set(key, { date: f.fixture_date, time: f.fixture_time, games: [] });
    //   }
    //   drawsMap.get(key).games.push({ sheet: f.sheet, team_a: f.team_a_index, team_b: f.team_b_index });
    // });

    const payload = {
      competition: {
        ...comp,
        reserves: '', //reserves.map(r => r.player_name).join(', '),
      },
      teams: [], // formattedTeams,
      draws: [], //Array.from(drawsMap.values()),
    };

    return new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
