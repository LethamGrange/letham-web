// functions/api/_render.js

export async function renderUpdatedResultsList(db) {
  try {
    // 1. Query D1 to fetch matches with resolved club/rink names
    const { results } = await db
      .prepare(
        `
      SELECT
        m.id, m.match_date, m.match_time, m.sheet, m.competition_name, m.final_score_a, m.final_score_b, m.conceded_early,
        tA.name AS team_a_name, tB.name AS team_b_name
      FROM matches m
      JOIN clubs_or_rinks tA ON m.team_a_id = tA.id
      JOIN clubs_or_rinks tB ON m.team_b_id = tB.id
      ORDER BY m.match_date DESC, m.match_time DESC, m.id DESC
      LIMIT 10
    `,
      )
      .all();

    // 2. Handle empty database state gracefully
    if (!results || results.length === 0) {
      return new Response(
        `<div id="recent-results" class="empty-state">
          <p>No matches have been recorded for this season yet.</p>
         </div>`,
        { headers: { 'Content-Type': 'text/html' } },
      );
    }

    // 3. Map database rows to clean HTML markup using Open Props layout preferences
    const matchCards = results
      .map(match => {
        const isConceded = match.conceded_early
          ? ' <span class="badge conceded" style="background: var(--red-2); color: var(--red-9); padding: var(--size-1); border-radius: var(--radius-1); font-size: var(--font-size-0);">Conceded</span>'
          : '';

        return `
        <div class="match-card summary-view"
             hx-get="/api/get-scorecard-detail?id=${match.id}"
             hx-target="this"
             hx-swap="outerHTML"
             style="border: 1px solid var(--border); padding: var(--size-3); margin-bottom: var(--size-3); border-radius: var(--radius-2); cursor: pointer; transition: background 0.2s;"
             onmouseover="this.style.background='var(--surface-2)'"
             onmouseout="this.style.background='none'">

          <header style="display: flex; justify-content: space-between; font-size: var(--font-size-0); color: var(--text-2); margin-bottom: var(--size-2);">
            <span><strong>${match.competition_name}</strong></span>
            <span>${match.match_date} @ ${match.match_time} — <strong>Sheet ${match.sheet}</strong></span>
          </header>

          <div class="match-score-row" style="display: flex; justify-content: space-between; align-items: center; font-size: var(--font-size-2);">
            <div class="team-line">
              <span style="${match.final_score_a > match.final_score_b ? 'font-weight: bold;' : ''}">${match.team_a_name}</span>
              <strong>${match.final_score_a}</strong>
            </div>
            <div class="vs-divider" style="color: var(--text-3); font-size: var(--font-size-0);">vs</div>
            <div class="team-line">
              <strong>${match.final_score_b}</strong>
              <span style="${match.final_score_b > match.final_score_a ? 'font-weight: bold;' : ''}">${match.team_b_name}</span>
            </div>
          </div>
          <div style="margin-top: var(--size-2); font-size: var(--font-size-0); color: var(--text-3); text-align: center;">
            Click to view full line score & rosters ▾ ${isConceded}
          </div>
        </div>
      `;
      })
      .join('');

    // 4. Return the complete container block that htmx will swap in
    return new Response(`<div id="recent-results" class="results-list">${matchCards}</div>`, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    // Return error container if D1 query fails
    return new Response(
      `<div id="recent-results" style="color: var(--red-6); padding: var(--size-3); border: 1px solid var(--red-3); border-radius: var(--radius-2);">
        <p><strong>Error loading scores:</strong> ${error.message}</p>
       </div>`,
      { headers: { 'Content-Type': 'text/html' }, status: 500 },
    );
  }
}
