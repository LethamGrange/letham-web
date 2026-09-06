export async function onRequestGet(context) {
  const db = context.env.curling_league;
  const url = new URL(context.request.url);
  const season = url.searchParams.get('season') || new Date().getFullYear().toString();

  // 1. Gather all data rows for the WHOLE season in flat tables
  const compsQuery = db
    .prepare(
      `SELECT id, name, season_year, kind, sub_kind, reserves FROM competitions WHERE season_year = ? ORDER BY name ASC`,
    )
    .bind(season);

  const teamsQuery = db
    .prepare(
      `
      SELECT t.id, t.competition_id, t.team_index, t.team_name
      FROM competition_teams t
      JOIN competitions c ON t.competition_id = c.id
      WHERE c.season_year = ?
      ORDER BY t.team_index ASC
    `,
    )
    .bind(season);

  const playersQuery = db
    .prepare(
      `
      SELECT p.id, p.team_id, p.name, p.role
      FROM team_players p
      JOIN competition_teams t ON p.team_id = t.id
      JOIN competitions c ON t.competition_id = c.id
      WHERE c.season_year = ?
    `,
    )
    .bind(season);

  const poolPlayersQuery = db
    .prepare(
      `
      SELECT pool.id, pool.team_id, pool.name
      FROM pool_players pool
      JOIN competition_teams t ON pool.team_id = t.id
      JOIN competitions c ON t.competition_id = c.id
      WHERE c.season_year = ?
    `,
    )
    .bind(season);

  const fixturesQuery = db
    .prepare(
      `
      SELECT f.id, f.competition_id, f.fixture_date AS date, f.fixture_time AS time
      FROM fixtures f
      JOIN competitions c ON f.competition_id = c.id
      WHERE c.season_year = ?
      ORDER BY f.fixture_date ASC
    `,
    )
    .bind(season);

  const gamesQuery = db
    .prepare(
      `
      SELECT g.id, g.fixture_id, g.team_a, g.team_b
      FROM games g
      JOIN fixtures f ON g.fixture_id = f.id
      JOIN competitions c ON f.competition_id = c.id
      WHERE c.season_year = ?
      ORDER BY g.sequence ASC
    `,
    )
    .bind(season);

  try {
    // 2. Fire together in exactly ONE database network round-trip
    const [compsRes, teamsRes, playersRes, poolRes, fixturesRes, gamesRes] = await db.batch([
      compsQuery,
      teamsQuery,
      playersQuery,
      poolPlayersQuery,
      fixturesQuery,
      gamesQuery,
    ]);

    const competitions = compsRes.results;

    // 3. Build Pre-grouping Dictionary Maps
    const playersByTeam = new Map();
    playersRes.results.forEach(p => {
      if (!playersByTeam.has(p.team_id)) playersByTeam.set(p.team_id, []);
      playersByTeam.get(p.team_id).push(p);
    });

    const poolPlayersByTeam = new Map();
    poolRes.results.forEach(p => {
      if (!poolPlayersByTeam.has(p.team_id)) poolPlayersByTeam.set(p.team_id, []);
      poolPlayersByTeam.get(p.team_id).push(p);
    });

    const teamsByComp = new Map();
    teamsRes.results.forEach(t => {
      t.name = t.team_name;
      t.index = t.team_index;
      t.players = playersByTeam.get(t.id) ?? [];
      t.pool_players = poolPlayersByTeam.get(t.id) ?? [];

      if (!teamsByComp.has(t.competition_id)) teamsByComp.set(t.competition_id, []);
      teamsByComp.get(t.competition_id).push(t);
    });

    const gamesByFixture = new Map();
    gamesRes.results.forEach(g => {
      if (!gamesByFixture.has(g.fixture_id)) gamesByFixture.set(g.fixture_id, []);
      gamesByFixture.get(g.fixture_id).push(g);
    });

    const fixturesByComp = new Map();
    fixturesRes.results.forEach(f => {
      f.games = gamesByFixture.get(f.id) ?? [];

      if (!fixturesByComp.has(f.competition_id)) fixturesByComp.set(f.competition_id, []);
      fixturesByComp.get(f.competition_id).push(f);
    });

    // 4. Thread everything together into a neat nested list
    competitions.forEach(comp => {
      // Grab the teams assigned to this specific competition
      const compTeams = teamsByComp.get(comp.id) ?? [];
      comp.teams = compTeams;

      // Create a quick True O(1) lookup dictionary for THIS competition's teams
      const teamNameMap = new Map(compTeams.map(t => [t.id, t.team_name]));

      // Grab the fixtures assigned to this specific competition
      const compFixtures = fixturesByComp.get(comp.id) ?? [];

      // Loop through the fixtures and map team IDs to names inside the games array
      compFixtures.forEach(fixture => {
        fixture.games.forEach(game => {
          // Look up names, falling back to 'TBD' or an abstract placeholder if empty
          game.team_a_name = teamNameMap.get(game.team_a) || 'TBD';
          game.team_b_name = teamNameMap.get(game.team_b) || 'TBD';
        });
      });

      comp.fixtures = compFixtures;
    });
    return new Response(JSON.stringify(competitions), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
