export async function onRequestGet(context) {
  const db = context.env.curling_league;
  const url = new URL(context.request.url);
  const compId = url.searchParams.get('id');

  if (!compId) {
    return new Response(JSON.stringify({ error: 'Missing identity' }), { status: 400 });
  }

  // 1. Prepare the 4 independent, highly targeted queries
  const compQuery = db
    .prepare(`SELECT id, name, season_year, kind, sub_kind, reserves  FROM syllabus_competitions WHERE id = ?`)
    .bind(compId);

  const teamsQuery = db
    .prepare(`SELECT id, team_index, team_name FROM syllabus_teams WHERE competition_id = ? ORDER BY team_index ASC`)
    .bind(compId);

  // Grab all regular players belonging to any team in this competition
  const playersQuery = db
    .prepare(
      `SELECT p.id, p.team_id, p.name, p.role
     FROM syllabus_team_players p
     JOIN syllabus_teams t ON p.team_id = t.id
     WHERE t.competition_id = ?`,
    )
    .bind(compId);

  // Grab all pool players belonging to any team in this competition
  const poolPlayersQuery = db
    .prepare(
      `SELECT pool.id, pool.team_id, pool.name
     FROM syllabus_team_pool_players pool
     JOIN syllabus_teams t ON pool.team_id = t.id
     WHERE t.competition_id = ?`,
    )
    .bind(compId);

  const fixturesQuery = db
    .prepare(
      `SELECT id, fixture_date, fixture_time FROM syllabus_fixtures WHERE competition_id = ? ORDER BY fixture_date ASC`,
    )
    .bind(compId);

  // Grab all games
  const gamesQuery = db
    .prepare(
      `SELECT g.id,g.fixture_id,  g.team_a_id, g.team_b_id
     FROM syllabus_games g
     JOIN syllabus_fixtures f ON g.fixture_id = f.id
     WHERE f.competition_id = ?`,
    )
    .bind(compId);

  try {
    // 2. Fire them together in a single network round-trip
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

    const teams = teamsRes.results;
    const allPlayers = playersRes.results;
    const allPoolPlayers = poolRes.results;
    const fixtures = fixturesRes.results;
    const allGames = gamesRes.results;

    // 3. Nest the players cleanly into their respective teams using O(1) matching
    teams.forEach(team => {
      team.name = team.team_name;
      team.index = team.team_index;
      team.players = allPlayers.filter(p => p.team_id === team.id);
      team.pool_players = allPoolPlayers.filter(p => p.team_id === team.id);
    });

    // Attach the fully populated teams array to the root competition object
    competition.teams = teams;
    console.log(allGames);
    fixtures.forEach(fixture => {
      fixture.date = fixture.fixture_date;
      fixture.time = fixture.fixture_time;
      fixture.games = allGames
        .filter(g => g.fixture_id === fixture.id)
        .map(g => {
          g.team_a = g.team_a_id;
          g.team_b = g.team_b_id;
          return g;
        });
    });
    competition.fixtures = fixtures;

    return new Response(JSON.stringify(competition), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
