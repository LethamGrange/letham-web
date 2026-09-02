export async function onRequestGet(context) {
  const db = context.env.curling_league;
  const url = new URL(context.request.url);
  const compId = url.searchParams.get('id');

  if (!compId) {
    return new Response(JSON.stringify({ error: 'Missing identity' }), { status: 400 });
  }

  // 1. Independent, targeted queries
  const compQuery = db
    .prepare(`SELECT id, name, season_year, kind, sub_kind, reserves FROM syllabus_competitions WHERE id = ?`)
    .bind(compId);

  const teamsQuery = db
    .prepare(`SELECT id, team_index, team_name FROM syllabus_teams WHERE competition_id = ? ORDER BY team_index ASC`)
    .bind(compId);

  const playersQuery = db
    .prepare(
      `
      SELECT p.id, p.team_id, p.name, p.role
      FROM syllabus_team_players p
      JOIN syllabus_teams t ON p.team_id = t.id
      WHERE t.competition_id = ?
    `,
    )
    .bind(compId);

  const poolPlayersQuery = db
    .prepare(
      `
      SELECT pool.id, pool.team_id, pool.name
      FROM syllabus_team_pool_players pool
      JOIN syllabus_teams t ON pool.team_id = t.id
      WHERE t.competition_id = ?
    `,
    )
    .bind(compId);

  const fixturesQuery = db
    .prepare(
      `SELECT id, fixture_date AS date, fixture_time AS time
       FROM syllabus_fixtures WHERE competition_id = ? ORDER BY fixture_date ASC`,
    )
    .bind(compId);

  const gamesQuery = db
    .prepare(
      `
      SELECT g.id, g.fixture_id, g.team_a, g.team_b
      FROM syllabus_games g
      JOIN syllabus_fixtures f ON g.fixture_id = f.id
      WHERE f.competition_id = ? ORDER BY g.sequence ASC
    `,
    )
    .bind(compId);

  try {
    // 2. Fire together in a single network round-trip
    const [compRes, teamsRes, playersRes, poolRes, fixturesRes, gamesRes] = await db.batch([
      compQuery,
      teamsQuery,
      playersQuery,
      poolPlayersQuery,
      fixturesQuery,
      gamesQuery,
    ]);

    const competition = compRes.results[0];
    if (!competition) {
      return new Response(JSON.stringify({ error: 'Competition not found' }), { status: 404 });
    }

    // 3. True O(1) Pre-grouping Maps
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

    const gamesByFixture = new Map();
    gamesRes.results.forEach(g => {
      if (!gamesByFixture.has(g.fixture_id)) gamesByFixture.set(g.fixture_id, []);
      gamesByFixture.get(g.fixture_id).push(g);
    });

    // 4. Map the components together natively in linear O(N) execution time
    const teams = teamsRes.results;
    teams.forEach(team => {
      team.name = team.team_name;
      team.index = team.team_index;
      team.players = playersByTeam.get(team.id) ?? [];
      team.pool_players = poolPlayersByTeam.get(team.id) ?? [];
    });
    competition.teams = teams;

    const fixtures = fixturesRes.results;
    fixtures.forEach(fixture => {
      fixture.games = gamesByFixture.get(fixture.id) ?? [];
    });
    competition.fixtures = fixtures;

    return new Response(JSON.stringify(competition), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
