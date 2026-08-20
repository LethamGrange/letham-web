export async function onRequestGet(context) {
  const db = context.env.curling_league;
  const url = new URL(context.request.url);
  const matchId = url.searchParams.get('id');

  if (!matchId) {
    return new Response(JSON.stringify({ error: 'Missing ID' }), { status: 400 });
  }

  try {
    // 1. Fetch main match records
    const match = await db
      .prepare(
        `
      SELECT m.*, tA.name AS team_a_name, tB.name AS team_b_name
      FROM matches m
      JOIN clubs_or_rinks tA ON m.team_a_id = tA.id
      JOIN clubs_or_rinks tB ON m.team_b_id = tB.id
      WHERE m.id = ?
    `,
      )
      .bind(matchId)
      .first();

    if (!match) {
      return new Response(JSON.stringify({ error: 'Match not found' }), { status: 404 });
    }

    // 2. Fetch the completed end linescores
    const { results: ends } = await db
      .prepare(
        `
      SELECT end_number, score_a, score_b
      FROM match_ends
      WHERE match_id = ?
    `,
      )
      .bind(matchId)
      .all();

    // 3. Flatten everything into a single dictionary object matching your form 'name' attributes
    const payload = {
      match_id: match.id,
      match_date: match.match_date,
      match_time: match.match_time,
      sheet: match.sheet,
      competition_select: match.competition_name, // Hooks into your select logic
      team_a_name: match.team_a_name,
      team_b_name: match.team_b_name,
      team_a_skip: match.team_a_skip,
      team_a_third: match.team_a_third,
      team_a_second: match.team_a_second,
      team_a_lead: match.team_a_lead,
      team_b_skip: match.team_b_skip,
      team_b_third: match.team_b_third,
      team_b_second: match.team_b_second,
      team_b_lead: match.team_b_lead,
      conceded: match.conceded_early,
    };

    // Dynamically inject the individual end keys: e1_a, e1_b, up to e8_b
    ends.forEach(end => {
      payload[`e${end.end_number}_a`] = end.score_a;
      payload[`e${end.end_number}_b`] = end.score_b;
    });

    return new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
