import { getDiaryHtml } from '../api/_get-diary-html.js';
import html from 'html-template-tag';

export async function onRequestDelete(context) {
  const db = context.env.curling_league;
  const url = new URL(context.request.url);
  const compId = url.searchParams.get('id');

  if (!compId) {
    return new Response('Missing competition tracking identifier.', { status: 400 });
  }

  try {
    // Purges the master row. Cascading rules instantly sweep children entries cleanly!
    await db.prepare(`DELETE FROM syllabus_competitions WHERE id = ?`).bind(compId).run();

    // Re-render the fresh diary grid instantly to reflect the drop
    const diaryHtml = await getDiaryHtml(db);

    return new Response(
      `
      <div id="diary-preview">
        <p style="color: var(--green-6); font-weight: bold; margin-bottom: var(--size-2);">✓ Competition permanently deleted.</p>
        ${diaryHtml}
      </div>
    `,
      { headers: { 'Content-Type': 'text/html' } },
    );
  } catch (error) {
    return new Response(`Purge operation failed: ${error.message}`, { status: 500 });
  }
}
