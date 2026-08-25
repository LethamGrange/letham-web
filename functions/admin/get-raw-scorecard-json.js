export async function onRequestGet(context) {
  const db = context.env.curling_league;
  const url = new URL(context.request.url);
  const matchId = url.searchParams.get('id');

  if (!matchId) {
    return new Response(JSON.stringify({ error: 'Missing ID' }), { status: 400 });
  }

  try {
    // 1. Prepare both SELECT statements
    const matchResult = await db
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
      .run();

    // Extract the singular match object
    const match = matchResult.results[0];
    if (!match) {
      return new Response(JSON.stringify({ error: 'Match not found' }), { status: 404 });
    }

    const payload = {
      id: match.id,
      date: match.match_date,
      time: match.match_time,
      has_extra_ends: match.match_has_extra_ends,
      sheet: match.sheet,
      competition_name: match.competition_name,
      team: {},
    };

    for (let key of ['a', 'b']) {
      payload.team[key] = {
        name: match[`team_${key}_name`] ?? '',
        players: {
          skip: match[`team_${key}_skip`] ?? '',
          third: match[`team_${key}_third`] ?? '',
          second: match[`team_${key}_third`] ?? '',
          lead: match[`team_${key}_lead}`] ?? '',
        },
      };
    }

    const endsArray = [];
    const aArray = match.team_a_ends.split(','); // ["1", "1", "0", ""]
    const bArray = match.team_b_ends.split(','); // ["0", "0", "2", ""]

    for (let i = 0; i < aArray.length; i++) {
      endsArray.push({ a: aArray[i], b: bArray[i] });
    }
    payload.ends = endsArray;

    return new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
