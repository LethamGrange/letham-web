export async function onRequestGet(context) {
  const db = context.env.curling_league;
  const url = new URL(context.request.url);
  const matchId = url.searchParams.get('id');

  if (!matchId) {
    return new Response('<p>Missing scorecard identifier.</p>', { status: 400 });
  }

  try {
    // 1. Fetch the master match details
    const match = await db
      .prepare(
        `
      SELECT m.*, tA.name AS team_a_name, tB.name AS team_b_name
      FROM matches m
      JOIN clubs_or_rinks tA ON m.team_a_id = tA.id
      JOIN clubs_or_rinks tB ON m.team_b_id = tB.id
      WHERE m.id = ?
    `,
      )
      .bind(matchId)
      .first();

    // 2. Fetch all completed ends for this match
    const { results: ends } = await db
      .prepare(
        `
      SELECT end_number, score_a, score_b
      FROM match_ends
      WHERE match_id = ?
      ORDER BY end_number ASC
    `,
      )
      .bind(matchId)
      .all();

    // 3. Build out the curling board columns (Ends 1-8)
    let teamARows = '';
    let teamBRows = '';

    for (let i = 1; i <= 8; i++) {
      const activeEnd = ends.find(e => e.end_number === i);
      if (activeEnd) {
        teamARows += `<td style="padding: var(--size-2); font-weight: bold;">${activeEnd.score_a}</td>`;
        teamBRows += `<td style="padding: var(--size-2); font-weight: bold;">${activeEnd.score_b}</td>`;
      } else {
        // Traditional Curling X for unplayed/conceded ends
        teamARows += `<td style="color: var(--text-3); padding: var(--size-2);">X</td>`;
        teamBRows += `<td style="color: var(--text-3); padding: var(--size-2);">X</td>`;
      }
    }

    // 4. Combine into an expanded Open Props card block
    const detailHtml = `
      <div class="match-card detailed-view"
           style="border: 2px solid var(--brand, var(--link)); padding: var(--size-3); margin-bottom: var(--size-3); border-radius: var(--radius-2); background: var(--surface-1);">

        <header style="display: flex; justify-content: space-between; font-size: var(--font-size-0); color: var(--text-2); margin-bottom: var(--size-3); border-bottom: 1px solid var(--border); padding-bottom: var(--size-1);">
          <span><strong>${match.competition_name}</strong></span>
          <span>${match.match_date} @ ${match.match_time} — <strong>Sheet ${match.sheet}</strong></span>
        </header>

        <!-- Curling Scoreboard Layout -->
        <div class="scorecard-scroll-wrapper" style="width: 100%; overflow-x: auto; margin-bottom: var(--size-3);">
          <table border="1" style="border-collapse: collapse; width: 100%; text-align: center; min-width: 500px; border: 1px solid var(--border);">
            <thead style="background: var(--surface-2);">
              <tr>
                <th style="text-align: left; padding: var(--size-2);">Team Rink</th>
                <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th>
                <th style="padding: var(--size-2);">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align: left; padding: var(--size-2); font-weight: ${match.final_score_a > match.final_score_b ? 'bold' : 'normal'};">${match.team_a_name}</td>
                ${teamARows}
                <td style="background: var(--surface-2); font-weight: bold; padding: var(--size-2); font-size: var(--font-size-2); color: var(--brand);">${match.final_score_a}</td>
              </tr>
              <tr>
                <td style="text-align: left; padding: var(--size-2); font-weight: ${match.final_score_b > match.final_score_a ? 'bold' : 'normal'};">${match.team_b_name}</td>
                ${teamBRows}
                <td style="background: var(--surface-2); font-weight: bold; padding: var(--size-2); font-size: var(--font-size-2); color: var(--brand);">${match.final_score_b}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Roster Lineups Side by Side -->
        <div class="rosters-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--size-3); font-size: var(--font-size-1); background: var(--surface-2); padding: var(--size-3); border-radius: var(--radius-1);">
          <div>
            <strong style="color: var(--text-1);">${match.team_a_name} Lineup:</strong>
            <ul style="list-style: none; padding: 0; margin: var(--size-1) 0 0 0; color: var(--text-2);">
              <li><strong>Skip:</strong> ${match.team_a_skip || 'Unlisted'}</li>
              <li><strong>Third:</strong> ${match.team_a_third || 'Unlisted'}</li>
              <li><strong>Second:</strong> ${match.team_a_second || 'Unlisted'}</li>
              <li><strong>Lead:</strong> ${match.team_a_lead || 'Unlisted'}</li>
            </ul>
          </div>
          <div>
            <strong style="color: var(--text-1);">${match.team_b_name} Lineup:</strong>
            <ul style="list-style: none; padding: 0; margin: var(--size-1) 0 0 0; color: var(--text-2);">
              <li><strong>Skip:</strong> ${match.team_b_skip || 'Unlisted'}</li>
              <li><strong>Third:</strong> ${match.team_b_third || 'Unlisted'}</li>
              <li><strong>Second:</strong> ${match.team_b_second || 'Unlisted'}</li>
              <li><strong>Lead:</strong> ${match.team_b_lead || 'Unlisted'}</li>
            </ul>
          </div>
        </div>

        <!-- Collapse Action Trigger Button -->
        <div style="text-align: right; margin-top: var(--size-3);">
          <button hx-get="/api/get-scores"
                  hx-target="#recent-results"
                  hx-swap="outerHTML"
                  style="background: var(--surface-3); color: var(--text-1); border: 1px solid var(--border); padding: var(--size-1) var(--size-2); border-radius: var(--radius-1); cursor: pointer;">
            Close Details ▴
          </button>
        </div>
      </div>
    `;

    return new Response(detailHtml, { headers: { 'Content-Type': 'text/html' } });
  } catch (error) {
    return new Response(`<p style="color:var(--red-6);">Error loading scorecard line detail: ${error.message}</p>`, {
      status: 500,
    });
  }
}
