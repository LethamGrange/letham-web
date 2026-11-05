export async function onRequestGet(context) {
  const db = context.env.curling_league;
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60',
  };

  try {
    // 1. Fetch the master chronological timeline layout rows (Query 1)
    const { results: timeline } = await db
      .prepare(
        `
      SELECT
        f.fixture_date AS rawDate,
        f.fixture_time AS rawTime,
        c.id AS compId,
        c.name AS competitionName,
        c.kind AS competitionKind
      FROM fixtures f
      JOIN competitions c ON f.competition_id = c.id
      JOIN games g ON g.fixture_id = f.id
      GROUP BY f.fixture_date, f.fixture_time, c.name
      ORDER BY f.fixture_date ASC, f.fixture_time ASC
    `,
      )
      .all();

    if (!timeline || timeline.length === 0) {
      return new Response(JSON.stringify({ success: true, diary: [] }), { status: 200, headers });
    }

    // 2. Extract unique competition IDs out of the timeline (very small array)
    const uniqueCompIds = [...new Set(timeline.map(row => row.compId))];
    const placeholders = uniqueCompIds.map(() => '?').join(',');

    // 3. FETCH THE WHOLE WORLD BATCHED BY UNIQUE COMPETITION ID
    // By joining parent tables, we bind only uniqueCompIds and completely bypass variable limits!

    // Query 2: All relevant competition teams
    const { results: allTeams } = await db
      .prepare(
        `SELECT id, competition_id, team_name AS name, team_index FROM competition_teams WHERE competition_id IN (${placeholders}) ORDER BY team_index ASC`,
      )
      .bind(...uniqueCompIds)
      .all();

    // Query 3: All relevant team players (Joined against competition_id)
    const { results: allPlayers } = await db
      .prepare(
        `
        SELECT p.team_id, p.name, p.role
        FROM team_players p
        JOIN competition_teams t ON p.team_id = t.id
        WHERE t.competition_id IN (${placeholders})
      `,
      )
      .bind(...uniqueCompIds)
      .all();

    // Query 4: All relevant pool substitutes (Joined against competition_id)
    const { results: allPools } = await db
      .prepare(
        `
        SELECT p.team_id, p.name
        FROM pool_players p
        JOIN competition_teams t ON p.team_id = t.id
        WHERE t.competition_id IN (${placeholders})
      `,
      )
      .bind(...uniqueCompIds)
      .all();

    // Query 5: All relevant fixtures
    const { results: allFixtures } = await db
      .prepare(
        `SELECT id, competition_id, fixture_date AS date, fixture_time AS time FROM fixtures WHERE competition_id IN (${placeholders}) ORDER BY fixture_date ASC`,
      )
      .bind(...uniqueCompIds)
      .all();

    // Query 6: All relevant matchups (Joined against fixtures table to use competition_id, sheet column removed)
    const { results: allGames } = await db
      .prepare(
        `
        SELECT g.id, g.fixture_id, g.team_a, g.team_b
        FROM games g
        JOIN fixtures f ON g.fixture_id = f.id
        WHERE f.competition_id IN (${placeholders})
      `,
      )
      .bind(...uniqueCompIds)
      .all();

    // Query 7: All competition pool reserves
    const { results: allReserves } = await db
      .prepare(
        `SELECT competition_id, player_name AS name FROM competition_reserves WHERE competition_id IN (${placeholders})`,
      )
      .bind(...uniqueCompIds)
      .all();

    // 4. JAVASCRIPT MEMORY STITCHER: Maps raw rows into nested component trees
    const diaryEntries = timeline.map(row => {
      const compTeams = allTeams
        .filter(t => t.competition_id === row.compId)
        .map(team => ({
          ...team,
          players: allPlayers.filter(p => p.team_id === team.id),
          pool_players: allPools.filter(p => p.team_id === team.id),
        }));

      const compFixtures = allFixtures
        .filter(f => f.competition_id === row.compId)
        .map(fix => ({
          ...fix,
          games: allGames.filter(g => g.fixture_id === fix.id),
        }));

      const compReserves = allReserves.filter(r => r.competition_id === row.compId);

      const formattedDate = new Date(row.rawDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      let formattedTime = '';
      if (row.rawTime) {
        const [hours, minutes] = row.rawTime.split(':');
        const h = parseInt(hours, 10);
        const ampm = h >= 12 ? 'pm' : 'am';
        const displayHours = h % 12 === 0 ? 12 : h % 12;
        formattedTime = `${displayHours}.${minutes}${ampm}`;
      }

      return {
        rawDate: row.rawDate,
        rawTime: row.rawTime,
        date: formattedDate,
        time: formattedTime,
        game: row.competitionName,
        kind: row.competitionKind,
        fullCompData: {
          id: row.compId,
          name: row.competitionName,
          type: row.competitionKind,
          teams: compTeams,
          fixtures: compFixtures,
          reserves: compReserves,
        },
      };
    });

    return new Response(JSON.stringify({ success: true, diary: diaryEntries }), {
      status: 200,
      headers,
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers,
    });
  }
}
