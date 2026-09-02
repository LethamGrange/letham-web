export async function onRequestGet(context) {
  const db = context.env.curling_league;

  // 1. Independent, targeted queries
  const compQuery = db.prepare(`SELECT id, name, season_year, kind, sub_kind, reserves FROM competitions`);

  try {
    // 2. Fire together in a single network round-trip
    const [compRes] = await db.batch([compQuery]);
    const competitions = compRes.results;
    return new Response(JSON.stringify(competitions), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
