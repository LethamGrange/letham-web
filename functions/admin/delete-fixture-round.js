import { getDiaryHtml } from '../api/_get-diary-html.js';
import { html } from '../helpers/html.js';

export async function onRequestDelete(context) {
  const db = context.env.curling_league;
  const url = new URL(context.request.url);

  const compId = url.searchParams.get('compId');
  const date = url.searchParams.get('date');
  const time = url.searchParams.get('time');

  if (!compId || !date) {
    return new Response('Missing fixture identifiers.', { status: 400 });
  }

  try {
    // Purges all simultaneous sheet games for this competition draw round
    await db
      .prepare(
        `
      DELETE FROM fixtures
      WHERE competition_id = ?
        AND fixture_date = ?
        AND (fixture_time = ? OR (fixture_time IS NULL AND ? IS NULL))
    `,
      )
      .bind(compId, date, time, time)
      .run();

    // Re-render the fresh calendar feed instantly to the user interface
    const diaryHtml = await getDiaryHtml(db);
    const responseHtml = html`<div id="diary-preview">${diaryHtml}</div>`;

    return new Response(responseHtml, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    return new Response(`Fixture deletion failed: ${error.message}`, { status: 500 });
  }
}
