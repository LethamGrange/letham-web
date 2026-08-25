export async function onRequestGet(context) {
  const db = context.env.curling_league;
  const url = new URL(context.request.url);
  const matchId = url.searchParams.get('id');

  if (!matchId) {
    return new Response(JSON.stringify({ error: 'Missing ID' }), { status: 400 });
  }

  try {
    // 1. Prepare both SELECT statements
    const matchQuery = db
      .prepare(
        `
      SELECT m.*, tA.name AS team_a_name, tB.name AS team_b_name
      FROM matches m
      JOIN clubs_or_rinks tA ON m.team_a_id = tA.id
      JOIN clubs_or_rinks tB ON m.team_b_id = tB.id
      WHERE m.id = ?
    `,
      )
      .bind(matchId);

    const endsQuery = db
      .prepare(
        `
      SELECT end_number, score_a, score_b
      FROM match_ends
      WHERE match_id = ?
    `,
      )
      .bind(matchId);

    // 2. Execute both queries simultaneously in a single D1 trip
    const [matchResult, endsResult] = await db.batch([matchQuery, endsQuery]);

    // Extract the singular match object
    const match = matchResult.results[0];
    if (!match) {
      return new Response(JSON.stringify({ error: 'Match not found' }), { status: 404 });
    }

    // Extract the ends array
    const ends = endsResult.results;

    const payload = {
      id: match.id,
      date: match.match_date,
      time: match.match_time,
      hasExtraEnds: match.match_has_extra_ends,
      sheet: match.sheet,
      competitionName: match.competition_name,
      team: {},
      ends: [],
    };

    for (let key of ['a', 'b']) {
      payload.team[key] = {
        name: match[`team_${key}_name`] ?? '',
        skip: match[`team_${key}_skip`] ?? '',
        third: match[`team_${key}_third`] ?? '',
        second: match[`team_${key}_third`] ?? '',
        lead: match[`team_${key}_lead}`] ?? '',
      };
    }

    let team_a_ends = match.team_a_ends;
    let team_b_ends = match.team_b_ends;

    if ((team_a_ends ?? '') === '') {
      const TOTAL_ENDS = 8;

      const teamA = Array.from({ length: TOTAL_ENDS }, () => '');
      const teamB = Array.from({ length: TOTAL_ENDS }, () => '');

      for (const end of ends) {
        const index = end.end_number - 1;
        teamA[index] = end.score_a;
        teamB[index] = end.score_b;
      }

      team_a_ends = teamA.join(',');
      team_b_ends = teamB.join(',');
    }

    const aEnds = team_a_ends.split(',');
    const bEnds = team_b_ends.split(',');

    // Dynamically match whatever the string length provides (8 or 12 slots)
    const totalSlots = Math.max(aEnds.length, bEnds.length);

    for (let i = 0; i < totalSlots; i++) {
      // Keep the raw strings exactly as they are ('0', '1', or '')
      payload.ends.push({
        a: aEnds[i],
        b: bEnds[i],
      });
    }

    return new Response(JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
