import { html } from '../helpers/html.js';

export async function onRequestGet(context) {
  const db = context.env.curling_league;

  try {
    const { results } = await db
      .prepare(
        `
      SELECT id, name, kind, sub_kind, season_year
      FROM syllabus_competitions
      ORDER BY name ASC
    `,
      )
      .all();

    if (!results || results.length === 0) {
      return new Response(
        html`<div id="syllabus-viewer" class="empty-state">
          <p>No competitions have been configured in the syllabus yet.</p>
        </div>`,
        { headers: { 'Content-Type': 'text/html' } },
      );
    }

    const compCards = results
      .map(comp => {
        // Capitalise the kind for cleaner presentation strings
        const displayKind = comp.kind.charAt(0).toUpperCase() + comp.kind.slice(1);

        return html`
          <div
            class="syllabus-card summary-view"
            hx-get="/api/get-syllabus-detail?id=${comp.id}"
            hx-target="this"
            hx-swap="outerHTML"
            style="border: 1px solid var(--border); padding: var(--size-3); margin-bottom: var(--size-3); border-radius: var(--radius-2); cursor: pointer; transition: background 0.2s;"
            onmouseover="this.style.background='var(--surface-2)'"
            onmouseout="this.style.background='none'"
          >
            <header style="display: flex; justify-content: space-between; align-items: center;">
              <h3 style="margin: 0; font-size: var(--font-size-2); color: var(--brand);">${comp.name}</h3>
              <span style="font-size: var(--font-size-0); color: var(--text-3); font-weight: bold;"
                >${comp.season_year}</span
              >
            </header>

            <div
              style="margin-top: var(--size-2); font-size: var(--font-size-1); color: var(--text-2); display: flex; gap: var(--size-3);"
            >
              <span><strong>Format:</strong> ${displayKind}</span>
              <span><strong>Tracking:</strong> ${comp.sub_kind === 'full' ? 'All Teams' : 'Partial (Us Only)'}</span>
            </div>

            <div
              style="margin-top: var(--size-2); font-size: var(--font-size-0); color: var(--text-3); text-align: center; border-top: 1px dashed var(--border); padding-top: var(--size-1);"
            >
              Click to view registered teams, rosters & reserves ▾
            </div>
          </div>
        `;
      })
      .join('');

    return new Response(html`<div id="syllabus-viewer" class="syllabus-list">${compCards}</div>`, {
      headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' },
    });
  } catch (error) {
    return new Response(html`<div id="syllabus-viewer" style="color:var(--red-6)">Error: ${error.message}</div>`, {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
