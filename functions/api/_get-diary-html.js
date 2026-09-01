import { html } from '../helpers/html.js';

export async function getDiaryHtml(db) {
  const { results } = await db
    .prepare(
      `
      SELECT
        id, season_year, name, kind
      FROM syllabus_competitions
    `,
    )
    .all();

  if (!results || results.length === 0) {
    const responseHtml = html` <p style="color: var(--text-3);">The games diary is currently empty.</p> `;

    return responseHtml;
  }

  const syllabusCompetitionsHtml = results
    .map(row => {
      const competition = html`<div
        id="competition-diary-${row.id}"
        data-id="${row.id}"
        style="display: flex;gap: 10px; border: 1px solid var(--gray-12)"
      >
        <div>${row.name}</div>
        <div>${row.kind}</div>
        <button
          type="button"
          class=" edit-action"
          onclick="this.dispatchEvent(new CustomEvent('edit-competition-request', { bubbles: true, detail: { id: '${row.id}' } }))"
        >
          <span>✏️</span> <span>Edit Competition</span>
        </button>
        <button
          class="delete-action"
          hx-delete="/admin/delete-syllabus?id=${row.id}"
          hx-target="#competition-diary-${row.id}"
          hx-swap="outerHTML"
          hx-confirm="⚠️ CRITICAL WARNING:

Are you completely sure you want to permanently delete this competition?"
        >
          <span>🗑️</span> <span>Delete Competition</span>
        </button>
      </div>`;
      return competition;
    })
    .join('');
  // Group rows by Date in JavaScript to build a clean structural diary timeline
  const diaryGrouped = {};
  results.forEach(row => {
    // Handle missing or TBD dates gracefully
    const dateKey = row.fixture_date || 'Date to be Confirmed (TBD)';
    if (!diaryGrouped[dateKey]) diaryGrouped[dateKey] = [];
    diaryGrouped[dateKey].push(row);
  });

  // Render out beautiful diary card blocks
  const diaryHtml = Object.keys(diaryGrouped)
    .map(date => {
      const dailyGames = diaryGrouped[date]
        .map((g = '') => {
          let matchUp = '';

          if (g.external_versus) {
            // Friendly or partial league style match
            matchUp = html`Letham Grange vs <strong>${g.external_versus}</strong>`;
          } else if (g.team_a && g.team_b) {
            // Standard league game
            matchUp = html`<strong>${g.team_a}</strong> vs <strong>${g.team_b}</strong>`;
          } else if (g.team_a && !g.team_b) {
            // A team has a bye night
            matchUp = html`<strong>${g.team_a}</strong>
              <span style="color: var(--text-3); font-style: italic;">(BYE)</span>`;
          } else {
            // Points competition or open session
            matchUp = html`<em>Club Session / Individual Points Entry</em>`;
          }

          const timeString = g.fixture_time ? `[${g.fixture_time}]` : `[Time TBD]`;
          const sheetBadge = g.sheet
            ? html`<span
                style="background: var(--surface-3); padding: var(--size-1) var(--size-2); border-radius: var(--radius-1); font-size: var(--font-size-0);"
                >Sheet ${g.sheet}</span
              >`
            : '';

          return html`
            <div
              style="display: flex; justify-content: space-between; align-items: center; padding: var(--size-2) 0; border-bottom: 1px dashed var(--border);"
            >
              <div>
                <span style="color: var(--text-2); font-size: var(--font-size-0); margin-right: var(--size-2);"
                  >${timeString}</span
                >
                <strong style="color: var(--brand);">${g.competition_name}</strong>: ${matchUp}
              </div>
              ${sheetBadge}
            </div>
          `;
        })
        .join('');

      return html`
        <div class="competitions">${syllabusCompetitionsHtml}</div>
        <div
          class="diary-day-card"
          style="border: 1px solid var(--border); border-radius: var(--radius-2); padding: var(--size-3); margin-bottom: var(--size-3); background: var(--surface-1);"
        >
          <h3
            style="margin: 0 0 var(--size-2) 0; font-size: var(--font-size-1); color: var(--text-1); border-bottom: 2px solid var(--brand); padding-bottom: 4px;"
          >
            📅 ${date}
          </h3>
          ${dailyGames}
        </div>
      `;
    })
    .join('');

  return diaryHtml;
}
