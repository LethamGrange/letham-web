import { html } from '../helpers/html.js';

export async function onRequestGet(context) {
  const db = context.env.curling_league;
  const url = new URL(context.request.url);

  // Default to Bank of Scotland if no specific league parameter is clicked yet
  const targetLeague = url.searchParams.get('league') || 'Bank of Scotland';

  // Hardcoded for the upcoming 2026/2027 curling window
  const seasonStart = '2026-07-01';
  const seasonEnd = '2027-03-31';

  try {
    const { results } = await db
      .prepare(
        `
      SELECT
          t.name AS team_name,
          COUNT(m.id) AS played,
          SUM(CASE WHEN m.my_score > m.opp_score THEN 1 ELSE 0 END) AS won,
          SUM(CASE WHEN m.my_score = m.opp_score THEN 1 ELSE 0 END) AS drawn,
          SUM(CASE WHEN m.my_score < m.opp_score THEN 1 ELSE 0 END) AS lost,
          SUM(m.my_score) AS shots_for,
          SUM(m.opp_score) AS shots_against,
          SUM(m.my_score - m.opp_score) AS shots_up,
          SUM(CASE
              WHEN m.my_score > m.opp_score THEN 2
              WHEN m.my_score = m.opp_score THEN 1
              ELSE 0
          END) AS points
      FROM clubs_or_rinks t
      JOIN (
          SELECT team_a_id AS team_id, final_score_a AS my_score, final_score_b AS opp_score, competition_name, match_date, id FROM matches
          UNION ALL
          SELECT team_b_id AS team_id, final_score_b AS my_score, final_score_a AS opp_score, competition_name, match_date, id FROM matches
      ) m ON t.id = m.team_id
      WHERE m.competition_name = ?
        AND m.match_date BETWEEN ? AND ?
      GROUP BY t.id
      ORDER BY points DESC, shots_up DESC, shots_for DESC
    `,
      )
      .bind(targetLeague, seasonStart, seasonEnd)
      .all();

    if (!results || results.length === 0) {
      return new Response(
        html`<p style="color: var(--text-3); padding: var(--size-2);">
          No matches have been logged for the ${targetLeague} this season.
        </p>`,
        { headers: { 'Content-Type': 'text/html' } },
      );
    }

    // Build the structural HTML table markup
    let tableRows = results
      .map(
        (row, index) => html`
          <tr>
            <td style="font-weight: bold; text-align: center;">${index + 1}</td>
            <td style="text-align: left; font-weight: var(--font-weight-6);">${row.team_name}</td>
            <td>${row.played}</td>
            <td>${row.won}</td>
            <td>${row.drawn}</td>
            <td>${row.lost}</td>
            <td>${row.shots_for}</td>
            <td>${row.shots_against}</td>
            <td style="color: ${row.shots_up >= 0 ? 'var(--green-7)' : 'var(--red-7)'};">
              ${row.shots_up > 0 ? '+' : ''}${row.shots_up}
            </td>
            <td style="font-weight: bold; color: var(--brand); font-size: var(--font-size-2);">${row.points}</td>
          </tr>
        `,
      )
      .join('');

    const tableHtml = html`
      <div class="scorecard-scroll-wrapper" style="width: 100%; overflow-x: auto;">
        <table
          border="1"
          style="border-collapse: collapse; width: 100%; text-align: center; min-width: 600px; border: 1px solid var(--border);"
        >
          <thead style="background: var(--surface-2);">
            <tr>
              <th style="width: 40px;">Pos</th>
              <th style="text-align: left;">Rink / Skip Name</th>
              <th>P</th>
              <th>W</th>
              <th>D</th>
              <th>L</th>
              <th>F</th>
              <th>A</th>
              <th>+/-</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `;

    return new Response(tableHtml, { headers: { 'Content-Type': 'text/html' } });
  } catch (error) {
    return new Response(html`<p style="color:var(--red-6);">Error calculating league table: ${error.message}</p>`, {
      status: 500,
    });
  }
}
