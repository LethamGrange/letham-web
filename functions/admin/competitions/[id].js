export async function onRequestDelete(context) {
  const db = context.env.curling_league;
  const compId = context.params.id;

  if (!compId) {
    return new Response('Missing competition tracking identifier.', { status: 400 });
  }

  try {
    // Purges the master row. Cascading rules instantly sweep children entries cleanly!
    await db.prepare(`DELETE FROM syllabus_competitions WHERE id = ?`).bind(compId).run();

    return new Response(JSON.stringify({ success: true, id: compId }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
