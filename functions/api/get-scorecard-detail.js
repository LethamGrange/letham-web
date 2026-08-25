import { getSessionRole } from '../helpers/auth.js';
import { html } from '../helpers/html.js';

export async function onRequestGet(context) {
  const {
    env: { curling_league: db },
    data: { role },
    request: { url: requestUrl },
  } = context;

  const url = new URL(requestUrl);
  const matchId = url.searchParams.get('id');

  if (!matchId) {
    return new Response('<p>Missing scorecard identifier.</p>', { status: 400 });
  }

  const userRole = role ?? (await getSessionRole(context));
  const isAdmin = userRole === 'admin';

  try {
    const matchQuery = db
      .prepare(
        `
      SELECT m.*, tA.name AS team_a_name, tB.name AS team_b_name
      FROM matches m
      LEFT OUTER JOIN clubs_or_rinks tA ON m.team_a_id = tA.id
      LEFT OUTER JOIN clubs_or_rinks tB ON m.team_b_id = tB.id
      WHERE m.id = ?
    `,
      )
      .bind(matchId);

    const endsQuery = db
      .prepare(
        `
      SELECT end_number, score_a, score_b
      FROM match_ends
      WHERE match_id = ?
      ORDER BY end_number ASC
    `,
      )
      .bind(matchId);

    // Send both queries to D1 in parallel
    const [matchResult, endsResult] = await db.batch([matchQuery, endsQuery]);

    const match = matchResult.results[0];
    if (!match) {
      return new Response('<p>Scorecard details not found.</p>', { status: 404 });
    }

    const ends = endsResult.results;

    // Determine how many columns to print (default to 8, but scale if extra ends exist)
    const maxEndRecorded = ends.reduce((max, e) => Math.max(max, e.end_number), 8);

    let tableHeaders = html`<th style="text-align: left; padding: var(--size-2);">Team Rink</th>`;
    let teamARows = '';
    let teamBRows = '';

    for (let i = 1; i <= maxEndRecorded; i++) {
      let endLabel = i.toString();
      if (i === 11) endLabel = 'EE';
      if (i === 12) endLabel = 'EEE';
      if (i > 12) endLabel = `EE<sup>${i - 10}</sup>`;

      tableHeaders += `<th>${endLabel}</th>`;

      const activeEnd = ends.find(e => e.end_number === i);
      if (activeEnd) {
        teamARows += html`<td style="padding: var(--size-2); font-weight: bold;">${activeEnd.score_a}</td>`;
        teamBRows += html`<td style="padding: var(--size-2); font-weight: bold;">${activeEnd.score_b}</td>`;
      } else {
        const filler = i <= 8 ? 'X' : '-';
        const color = i <= 8 ? 'var(--text-3)' : 'var(--text-4)';
        teamARows += html`<td style="color: ${color}; padding: var(--size-2);">${filler}</td>`;
        teamBRows += html`<td style="color: ${color}; padding: var(--size-2);">${filler}</td>`;
      }
    }
    tableHeaders += html`<th style="padding: var(--size-2);">Total</th>`;

    const adminButtons = isAdmin
      ? html`
          <div class="scorecard-admin-actions" style="--anchor-id: --menu-${match.id};">
            <button class="popover-trigger" popovertarget="menu-${match.id}" title="Scorecard Actions">⋮</button>
            <div id="menu-${match.id}" class="popover-menu" popover>
              <button
                type="button"
                class="popover-item edit-action"
                popovertarget="menu-${match.id}"
                popovertargetaction="hide"
                onclick="this.dispatchEvent(new CustomEvent('edit-scorecard-request', { bubbles: true, detail: { matchId: ${match.id} } }))"
              >
                <span>✏️</span> <span>Edit Scorecard</span>
              </button>
              <hr class="popover-divider" />
              <button
                class="popover-item delete-action"
                hx-delete="/admin/delete-scorecard?id=${match.id}"
                hx-target="#expanded-scorecard-${match.id}"
                hx-swap="outerHTML"
                hx-confirm="⚠️ CRITICAL WARNING:

Are you completely sure you want to permanently delete this scorecard?"
              >
                <span>🗑️</span> <span>Delete Scorecard</span>
              </button>
            </div>
          </div>
        `
      : '';

    const detailHtml = html`
      <div
        id="expanded-scorecard-${match.id}"
        class="match-card detailed-view"
        style="border: 2px solid var(--brand, var(--link)); padding: var(--size-3); margin-bottom: var(--size-3); border-radius: var(--radius-2); background: var(--surface-default);"
      >
        <header
          style="display: flex; justify-content: space-between; font-size: var(--font-size-0); color: var(--text-2); margin-bottom: var(--size-3); border-bottom: 1px solid var(--border); padding-bottom: var(--size-1);"
        >
          <span><strong>${match.competition_name}</strong></span>
          <span>${match.match_date} @ ${match.match_time} — <strong>Sheet ${match.sheet}</strong></span>
        </header>
        <div class="scorecard-scroll-wrapper" style="width: 100%; overflow-x: auto; margin-bottom: var(--size-3);">
          <table
            border="1"
            style="border-collapse: collapse; width: 100%; text-align: center; min-width: 500px; border: 1px solid var(--border);"
          >
            <thead style="background: var(--surface-2);">
              <tr>
                ${tableHeaders}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  style="text-align: left; padding: var(--size-2); font-weight: ${match.final_score_a > match.final_score_b ? 'bold' : 'normal'};"
                >
                  ${match.team_a_name}
                </td>
                ${teamARows}
                <td
                  style="background: var(--surface-2); font-weight: bold; padding: var(--size-2); font-size: var(--font-size-2); color: var(--brand);"
                >
                  ${match.final_score_a}
                </td>
              </tr>
              <tr>
                <td
                  style="text-align: left; padding: var(--size-2); font-weight: ${match.final_score_b > match.final_score_a ? 'bold' : 'normal'};"
                >
                  ${match.team_b_name}
                </td>
                ${teamBRows}
                <td
                  style="background: var(--surface-2); font-weight: bold; padding: var(--size-2); font-size: var(--font-size-2); color: var(--brand);"
                >
                  ${match.final_score_b}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          class="rosters-grid"
          style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--size-3); font-size: var(--font-size-1); background: var(--surface-2); padding: var(--size-3); border-radius: var(--radius-1);"
        >
          <div>
            <strong style="color: var(--text-1);">${match.team_a_name} Lineup:</strong>
            <ul style="list-style: none; padding: 0; margin: var(--size-1) 0 0 0; color: var(--text-2);">
              <li><strong>Skip:</strong> ${match.team_a_skip || ''}</li>
              <li><strong>Third:</strong> ${match.team_a_third || ''}</li>
              <li><strong>Second:</strong> ${match.team_a_second || ''}</li>
              <li><strong>Lead:</strong> ${match.team_a_lead || ''}</li>
            </ul>
          </div>
          <div>
            <strong style="color: var(--text-1);">${match.team_b_name} Lineup:</strong>
            <ul style="list-style: none; padding: 0; margin: var(--size-1) 0 0 0; color: var(--text-2);">
              <li><strong>Skip:</strong> ${match.team_b_skip || ''}</li>
              <li><strong>Third:</strong> ${match.team_b_third || ''}</li>
              <li><strong>Second:</strong> ${match.team_b_second || ''}</li>
              <li><strong>Lead:</strong> ${match.team_b_lead || ''}</li>
            </ul>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--size-3);">
          ${adminButtons}
          <button
            hx-get="/api/get-scores"
            hx-target="#recent-results"
            hx-swap="innerHTML"
            style="background: var(--surface-3); color: var(--text-1); border: 1px solid var(--border); padding: var(--size-1) var(--size-2); border-radius: var(--radius-1); cursor: pointer;"
          >
            Close Details ▴
          </button>
        </div>
      </div>
    `;

    return new Response(detailHtml, { headers: { 'Content-Type': 'text/html' } });
  } catch (error) {
    return new Response(
      html`<p style="color:var(--red-6);">Error loading scorecard line detail: ${error.message}</p>`,
      {
        status: 500,
      },
    );
  }
}
