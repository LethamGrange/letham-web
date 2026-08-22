import { getDiaryHtml } from './_get-diary-html';

export async function onRequestGet(context) {
  const db = context.env.curling_league;
  try {
    const diaryHtml = await getDiaryHtml(db);
    // Wrap in our exact matching container so htmx swaps it perfectly
    return new Response(`<div id="diary-preview">${diaryHtml}</div>`, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    return new Response(`<div id="diary-preview" style="color:var(--red-6)">Query Error: ${error.message}</div>`, {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
