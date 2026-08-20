import { renderUpdatedResultsList } from '../api/_render.js';

export async function onRequestDelete(context) {
  const db = context.env.curling_league;
  const url = new URL(context.request.url);
  const matchId = url.searchParams.get('id');

  try {
    await db.prepare(`DELETE FROM matches WHERE id = ?`).bind(matchId).run();
    return await renderUpdatedResultsList(db);
  } catch (error) {
    // If the database fails to delete, return a targeted 500 error block
    return new Response(`Failed to delete match record: ${error.message}`, { status: 500 });
  }
}
