export async function onRequestGet(context) {
  const db = context.env.curling_league;

  try {
    // 1. Fetch raw rows containing all 8 player names per match
    // This uses a single standard SELECT statement - completely avoiding the UNION limit!
    const { results } = await db
      .prepare(
        `
      SELECT
        team_a_skip, team_a_third, team_a_second, team_a_lead,
        team_b_skip, team_b_third, team_b_second, team_b_lead
      FROM matches
    `,
      )
      .all();

    // 2. Use a native JavaScript 'Set' to organically extract distinct names
    const uniqueNames = new Set();

    results.forEach(match => {
      if (match.team_a_skip) uniqueNames.add(match.team_a_skip.trim());
      if (match.team_a_third) uniqueNames.add(match.team_a_third.trim());
      if (match.team_a_second) uniqueNames.add(match.team_a_second.trim());
      if (match.team_a_lead) uniqueNames.add(match.team_a_lead.trim());

      if (match.team_b_skip) uniqueNames.add(match.team_b_skip.trim());
      if (match.team_b_third) uniqueNames.add(match.team_b_third.trim());
      if (match.team_b_second) uniqueNames.add(match.team_b_second.trim());
      if (match.team_b_lead) uniqueNames.add(match.team_b_lead.trim());
    });

    // 3. Remove any stray empty strings and sort alphabetically
    const sortedPlayers = Array.from(uniqueNames)
      .filter(name => name !== '')
      .sort((a, b) => a.localeCompare(b));

    return new Response(JSON.stringify(sortedPlayers), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify([]), { status: 500 });
  }
}
