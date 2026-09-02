export async function onRequestGet(context) {
  const db = context.env.curling_league;

  const compId = context.params.id;

  if (!compId) {
    return new Response(JSON.stringify({ error: 'Missing identity' }), { status: 400 });
  }

  // 1. Independent, targeted queries
  const compQuery = db
    .prepare(`SELECT id, name, season_year, kind, sub_kind, reserves FROM syllabus_competitions WHERE id = ?`)
    .bind(compId);

  try {
    // 2. Fire together in a single network round-trip
    const [compRes] = await db.batch([compQuery]);

    const competition = compRes.results[0];
    if (!competition) {
      return new Response(JSON.stringify({ error: 'Competition not found' }), { status: 404 });
    }
    return new Response(JSON.stringify(competition), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
