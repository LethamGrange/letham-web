// functions/api/diary.js
export async function onRequestGet(context) {
  const db = context.env.curling_league;
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60',
  };

  try {
    // 1. Fetch the master timeline chronology rows
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

    // 2. Parallel compilation loop resolves all deep child arrays natively
    const diaryEntries = await Promise.all(
      timeline.map(async row => {
        // A. Resolve Teams alongside their child player arrays
        const { results: rawTeams } = await db
          .prepare(
            `SELECT id, team_name AS name, team_index FROM competition_teams WHERE competition_id = ? ORDER BY team_index ASC`,
          )
          .bind(row.compId)
          .all();

        const fullyHydratedTeams = await Promise.all(
          rawTeams.map(async team => {
            const { results: players } = await db
              .prepare(`SELECT  name, role FROM team_players WHERE team_id = ?`)
              .bind(team.id)
              .all();
            const { results: pools } = await db
              .prepare(`SELECT name FROM pool_players WHERE team_id = ?`)
              .bind(team.id)
              .all();
            return {
              ...team,
              players: players || [],
              pool_players: pools || [],
            };
          }),
        );

        // B. Resolve Fixtures alongside their specific sheet games allocations
        const { results: rawFixtures } = await db
          .prepare(
            `SELECT id, fixture_date AS date, fixture_time AS time FROM fixtures WHERE competition_id = ? ORDER BY fixture_date ASC`,
          )
          .bind(row.compId)
          .all();

        const fullyHydratedFixtures = await Promise.all(
          rawFixtures.map(async fix => {
            const { results: games } = await db
              .prepare(`SELECT id,  team_a, team_b FROM games WHERE fixture_id = ?`)
              .bind(fix.id)
              .all();
            return {
              ...fix,
              games: games || [],
            };
          }),
        );

        // C. Fetch global competition pool reserves
        const { results: reserves } = await db
          .prepare(`SELECT player_name AS name FROM competition_reserves WHERE competition_id = ?`)
          .bind(row.compId)
          .all();

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
            teams: fullyHydratedTeams,
            fixtures: fullyHydratedFixtures,
            reserves: reserves || [],
          },
        };
      }),
    );

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
