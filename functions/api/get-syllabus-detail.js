import { html } from '../helpers/html.js';

export async function onRequestGet(context) {
  const db = context.env.curling_league;
  const url = new URL(context.request.url);
  const compId = url.searchParams.get('id');

  if (!compId) {
    return new Response(html`<p>Missing identifier.</p>`, { status: 400 });
  }

  try {
    // 1. Fetch Competition Meta Details
    const comp = await db.prepare(`SELECT * FROM syllabus_competitions WHERE id = ?`).bind(compId).first();

    // 2. Fetch Competition Reserves
    const { results: reserves } = await db
      .prepare(
        `
      SELECT player_name FROM syllabus_competition_reserves WHERE competition_id = ? ORDER BY player_name ASC
    `,
      )
      .bind(compId)
      .all();

    // 3. Fetch Teams, Players, and Pool Players data arrays
    const { results: teams } = await db
      .prepare(`SELECT id, team_name, team_index FROM syllabus_teams WHERE competition_id = ? ORDER BY team_index ASC`)
      .bind(compId)
      .all();
    const { results: players } = await db
      .prepare(
        `SELECT p.* FROM syllabus_team_players p JOIN syllabus_teams t ON p.team_id = t.id WHERE t.competition_id = ?`,
      )
      .bind(compId)
      .all();
    const { results: pools } = await db
      .prepare(
        `SELECT p.* FROM syllabus_team_pool_players p JOIN syllabus_teams t ON p.team_id = t.id WHERE t.competition_id = ?`,
      )
      .bind(compId)
      .all();

    // 4. Fetch FIXTURES for this specific competition, joining team name strings
    const { results: fixtures } = await db
      .prepare(
        `
      SELECT
        f.fixture_date, f.fixture_time, f.sheet, f.external_versus, f.team_a_index, f.team_b_index,
        tA.team_name AS team_a_name, tB.team_name AS team_b_name
      FROM syllabus_fixtures f
      LEFT JOIN syllabus_teams tA ON f.competition_id = tA.competition_id AND f.team_a_index = tA.team_index
      LEFT JOIN syllabus_teams tB ON f.competition_id = tB.competition_id AND f.team_b_index = tB.team_index
      WHERE f.competition_id = ?
      ORDER BY f.fixture_date ASC, f.fixture_time ASC, f.sheet ASC
    `,
      )
      .bind(compId)
      .all();

    // ==========================================
    // RENDER SECTION A: Rinks & Lineups
    // ==========================================
    const teamsHtml = teams
      .map(team => {
        const teamRoster = players.filter(p => p.team_id === team.id);
        const teamPool = pools.filter(p => p.team_id === team.id);

        const skipName = teamRoster.find(p => p.role === 'skip')?.player_name || 'Unassigned';
        const regularPlayers = teamRoster.filter(p => p.role !== 'skip').map(p => p.player_name);

        const regularList = regularPlayers.length > 0 ? regularPlayers.join(', ') : 'No additional players listed';
        const poolList = teamPool.length > 0 ? teamPool.map(p => p.player_name).join(', ') : 'None';

        return html`
          <div
            style="background: var(--surface-2); padding: var(--size-3); border-radius: var(--radius-1); border-left: 4px solid var(--brand);"
          >
            <strong
              style="font-size: var(--font-size-1); display: block; margin-bottom: var(--size-1); color: var(--text-1);"
              >${team.team_name}</strong
            >
            <ul
              style="list-style: none; padding: 0; margin: 0; font-size: var(--font-size-0); color: var(--text-2); line-height: var(--font-lineheight-2);"
            >
              <li><strong>Skip:</strong> ${skipName}</li>
              <li><strong>Roster Pool:</strong> ${regularList}</li>
              <li><strong>Sub Pool:</strong> ${poolList}</li>
            </ul>
          </div>
        `;
      })
      .join('');

    // ==========================================
    // RENDER SECTION B: Full Fixtures Schedule Grid
    // ==========================================
    let fixturesHtml = '';
    if (fixtures.length === 0) {
      fixturesHtml = html`<p style="color: var(--text-3); font-style: italic;">
        No fixtures scheduled for this competition yet.
      </p>`;
    } else {
      // Group fixtures by Date locally
      const fixturesByDate = {};
      fixtures.forEach(f => {
        const dateKey = f.fixture_date || 'Date to be Confirmed (TBD)';
        if (!fixturesByDate[dateKey]) fixturesByDate[dateKey] = [];
        fixturesByDate[dateKey].push(f);
      });

      // Construct a tight schedule overview timeline
      fixturesHtml = Object.keys(fixturesByDate)
        .map(date => {
          const gamesList = fixturesByDate[date]
            .map(g => {
              let matchupStr = '';

              if (g.external_versus) {
                matchupStr = `Letham Grange vs <strong>${g.external_versus}</strong>`;
              } else if (g.team_a_name && g.team_b_name) {
                matchupStr = `<strong>${g.team_a_name}</strong> vs <strong>${g.team_b_name}</strong>`;
              } else if (g.team_a_name && !g.team_b_name) {
                // Synthesise the Bye automatically if one side is null!
                matchupStr = `<strong>${g.team_a_name}</strong> <span style="color: var(--text-3); font-style: italic;">(BYE)</span>`;
              } else {
                matchupStr = `<em>Individual Session</em>`;
              }

              const timeString = g.fixture_time ? `@ ${g.fixture_time}` : '';
              const sheetString = g.sheet
                ? html` —
                    <span
                      style="background: var(--surface-3); padding: 1px 5px; border-radius: var(--radius-1); font-size: var(--font-size-0);"
                      >Sheet ${g.sheet}</span
                    >`
                : '';

              return html`<li style="padding: var(--size-1) 0; border-bottom: 1px dashed var(--border);">
                ${matchupStr} ${timeString} ${sheetString}
              </li>`;
            })
            .join('');

          return html`
            <div
              style="margin-bottom: var(--size-2); border: 1px solid var(--border); padding: var(--size-2); border-radius: var(--radius-1); background: var(--surface-2);"
            >
              <div
                style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border); padding-bottom: 4px; margin-bottom: var(--size-2);"
              >
                <strong style="color: var(--brand); font-size: var(--font-size-1);">📅 ${date}</strong>

                <!-- Targeted Round Deletion Trigger -->
                <button
                  hx-delete="/admin/delete-fixture-round?compId=${comp.id}&date=${encodeURIComponent(date)}&time=${encodeURIComponent(fixturesByDate[date][0].fixture_time || '')}"
                  hx-target="#diary-preview"
                  hx-swap="outerHTML"
                  hx-confirm="Are you sure you want to completely cancel and delete this entire draw round for ${date}?"
                  style="background: none; border: none; color: var(--red-6); font-size: var(--font-size-0); cursor: pointer; font-weight: bold;"
                >
                  ✕ Cancel Draw Round
                </button>
              </div>

              <ul
                style="list-style: none; padding: 0 0 0 var(--size-2); margin: 0; font-size: var(--font-size-1); color: var(--text-2);"
              >
                ${gamesList}
              </ul>
            </div>
          `;
        })
        .join('');
    }

    // Combine league overview data arrays together into final component payload
    const reservesText =
      reserves.length > 0 ? reserves.map(r => r.player_name).join(', ') : 'No competition-specific reserves listed.';

    const detailHtml = html`
      <div
        class="syllabus-card detailed-view"
        style="border: 2px solid var(--brand); padding: var(--size-3); margin-bottom: var(--size-3); border-radius: var(--radius-2); background: var(--surface-1);"
      >
        <header
          style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: var(--size-2); margin-bottom: var(--size-3);"
        >
          <h3 style="margin: 0; font-size: var(--font-size-3); color: var(--brand);">${comp.name}</h3>
          <span style="font-weight: bold; color: var(--text-3);">${comp.season_year}</span>
        </header>

        <!-- League Wide Reserves Banner -->
        <div
          style="background: var(--surface-3); padding: var(--size-2); border-radius: var(--radius-1); margin-bottom: var(--size-3); font-size: var(--font-size-1);"
        >
          <strong>League Reserves:</strong> <span style="color: var(--text-2);">${reservesText}</span>
        </div>

        <!-- Section 1: Teams Grid -->
        <h4 style="margin: 0 0 var(--size-2) 0; color: var(--text-1); font-size: var(--font-size-2);">
          Registered Lineups / Rinks
        </h4>
        <div
          style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--size-2); margin-bottom: var(--size-4);"
        >
          ${teamsHtml}
        </div>

        <!-- Section 2: Fixtures Timeline -->
        <h4 style="margin: 0 0 var(--size-2) 0; color: var(--text-1); font-size: var(--font-size-2);">
          Competition Draw Schedule
        </h4>
        <div
          class="syllabus-fixtures-grid"
          style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--size-3); margin-bottom: var(--size-3);"
        >
          ${fixturesHtml}
        </div>

        <!-- Trigger Controls Dashboard Footer -->
        <div
          style="display: flex; justify-content: flex-end; gap: var(--size-2); border-top: 1px solid var(--border); padding-top: var(--size-2);"
        >
          <button
            hx-delete="/admin/delete-syllabus?id=${comp.id}"
            hx-target="#syllabus-viewer"
            hx-swap="outerHTML"
            hx-confirm="⚠️ CRITICAL WARNING:

Are you sure you want to permanently delete '${comp.name}'?

This will purge the league, all registered team rinks, all player rosters, and the entire draw calendar from the system."
            style="background: var(--red-1); color: var(--red-7); border: 1px solid var(--red-3); padding: var(--size-1) var(--size-2); border-radius: var(--radius-1); cursor: pointer; font-weight: bold;"
          >
            Delete Entire Competition 🗑️
          </button>
          <button
            type="button"
            onclick="window.location.href='/admin/syllabus?id=${comp.id}'"
            style="background: var(--surface-3); border: 1px solid var(--border); padding: var(--size-1) var(--size-2); border-radius: var(--radius-1); cursor: pointer; font-weight: bold;"
          >
            Edit Profile ✏️
          </button>
          <button
            hx-get="/api/get-syllabus"
            hx-target="#syllabus-viewer"
            hx-swap="outerHTML"
            style="background: var(--surface-3); color: var(--text-1); border: 1px solid var(--border); padding: var(--size-1) var(--size-2); border-radius: var(--radius-1); cursor: pointer;"
          >
            Close Details ▴
          </button>
        </div>
      </div>
    `;

    return new Response(detailHtml, { headers: { 'Content-Type': 'text/html' } });
  } catch (error) {
    return new Response(html`<p style="color:var(--red-6)">Error loading detail summary: ${error.message}</p>`, {
      status: 500,
    });
  }
}
