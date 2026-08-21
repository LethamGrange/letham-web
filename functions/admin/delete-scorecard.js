import { renderUpdatedResultsList } from '../api/_render.js';

// functions/admin/delete-scorecard.js
export async function onRequestDelete(context) {
  const {
    env: { curling_league: db },
    request: { url: requestUrl },
  } = context;

  const url = new URL(requestUrl);
  const matchId = url.searchParams.get('id');

  if (!matchId) {
    return new Response('Missing match ID', { status: 400 });
  }

  try {
    // Safely execute the deletion query
    await db.prepare('DELETE FROM matches WHERE id = ?').bind(matchId).run();

    // Return empty string so htmx smoothly swaps/removes the element
    return new Response('', { status: 200 });
  } catch (error) {
    return new Response('Database error', { status: 500 });
  }
}
