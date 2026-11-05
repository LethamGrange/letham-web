import { html } from '../helpers/html.js';

export async function onRequestGet(context) {
  const db = context.env.curling_league;
  const url = new URL(context.request.url);

  const targetLeague = url.searchParams.get('league') || 'Bank of Scotland';
  const seasonStart = '2026-07-01';
  const seasonEnd = '2027-03-31';

  try {
    // 1. Fetch raw matches for the targeted league filter frame
    const { results: matches } = await db
      .prepare(
        `
      SELECT
        m.id, m.final_score_a, m.final_score_b, m.team_a_ends, m.team_b_ends,
        m.penalty_score_a, m.penalty_score_b,
        tA.name AS team_a_name, tB.name AS team_b_name
      FROM matches m
      JOIN clubs_or_rinks tA ON m.team_a_id = tA.id
      JOIN clubs_or_rinks tB ON m.team_b_id = tB.id
      WHERE m.competition_name = ?
        AND m.match_date BETWEEN ? AND ?
    `,
      )
      .bind(targetLeague, seasonStart, seasonEnd)
      .all();

    // 2. Process records inside a structured lookup dictionary
    const standings = {};

    const initTeam = name => {
      if (!standings[name]) {
        standings[name] = {
          name,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          ends_won: 0,
          shots_for: 0,
          shots_against: 0,
          shots_up: 0,
          points: 0,
        };
      }
    };

    matches.forEach(m => {
      initTeam(m.team_a_name);
      initTeam(m.team_b_name);

      const teamA = standings[m.team_a_name];
      const teamB = standings[m.team_b_name];

      // Calculate true dynamic total score factoring in shorthand adjustments
      const totalScoreA = m.final_score_a + (m.penalty_score_a || 0);
      const totalScoreB = m.final_score_b + (m.penalty_score_b || 0);

      // Parse and compute structural Ends Won parameters from comma strings
      const endsA = m.team_a_ends ? m.team_a_ends.split(',') : [];
      const endsB = m.team_b_ends ? m.team_b_ends.split(',') : [];

      let matchEndsWonA = 0;
      let matchEndsWonB = 0;

      for (let i = 0; i < Math.max(endsA.length, endsB.length); i++) {
        const valA = parseInt(endsA[i], 10) || 0;
        const valB = parseInt(endsB[i], 10) || 0;
        if (valA > 0) matchEndsWonA++;
        if (valB > 0) matchEndsWonB++;
      }

      // Aggregate Team A numbers
      teamA.played++;
      teamA.shots_for += totalScoreA;
      teamA.shots_against += totalScoreB;
      teamA.ends_won += matchEndsWonA;

      // Aggregate Team B numbers
      teamB.played++;
      teamB.shots_for += totalScoreB;
      teamB.shots_against += totalScoreA;
      teamB.ends_won += matchEndsWonB;

      // Assign Win / Draw / Loss allocation points matrix rules
      if (totalScoreA > totalScoreB) {
        teamA.won++;
        teamA.points += 2;
        teamB.lost++;
      } else if (totalScoreB > totalScoreA) {
        teamB.won++;
        teamB.points += 2;
        teamA.lost++;
      } else {
        teamA.drawn++;
        teamA.points += 1;
        teamB.drawn++;
        teamB.points += 1;
      }
    });

    // 3. Convert dictionary object map into a clean sorted array
    // OFFICIAL TIE BREAKER ORDER: Points -> Ends Won -> Shots Up -> Shots For
    const sortedStandings = Object.values(standings).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.ends_won !== a.ends_won) return b.ends_won - a.ends_won; // ⚡️ Ends Won is priority tie-breaker
      const shotsUpA = a.shots_for - a.shots_against;
      const shotsUpB = b.shots_for - b.shots_against;
      if (shotsUpB !== shotsUpA) return shotsUpB - shotsUpA;
      return b.shots_for - a.shots_for;
    });

    if (sortedStandings.length === 0) {
      return new Response(
        html`<p style="color: var(--text-3); padding: var(--size-2);">
          No matches have been logged for ${targetLeague} this season.
        </p>`,
        { headers: { 'Content-Type': 'text/html' } },
      );
    }

    // Build the structural HTML table markup including Ends Won (EW) column
    let tableRows = sortedStandings
      .map((row, index) => {
        const shotsUp = row.shots_for - row.shots_against;
        return html`
          <tr>
            <td style="font-weight: bold; text-align: center;">${index + 1}</td>
            <td style="text-align: left; font-weight: var(--font-weight-6);">${row.name}</td>
            <td>${row.played}</td>
            <td>${row.won}</td>
            <td>${row.drawn}</td>
            <td>${row.lost}</td>
            <td style="font-weight: var(--font-weight-6); color: var(--text-1);">${row.ends_won}</td>
            <!-- EW cell -->
            <td>${row.shots_for}</td>
            <td>${row.shots_against}</td>
            <td style="color: ${shotsUp >= 0 ? 'var(--green-7)' : 'var(--red-7)'};">
              ${shotsUp > 0 ? '+' : ''}${shotsUp}
            </td>
            <td style="font-weight: bold; color: var(--brand); font-size: var(--font-size-2);">${row.points}</td>
          </tr>
        `;
      })
      .join('');

    const tableHtml = html`
      <div class="scorecard-scroll-wrapper" style="width: 100%; overflow-x: auto;">
        <table
          border="1"
          style="border-collapse: collapse; width: 100%; text-align: center; min-width: 650px; border: 1px solid var(--border);"
        >
          <thead style="background: var(--surface-2);">
            <tr>
              <th style="width: 40px;">Pos</th>
              <th style="text-align: left;">Rink / Skip Name</th>
              <th>P</th>
              <th>W</th>
              <th>D</th>
              <th>L</th>
              <th title="Ends Won" style="color: var(--brand);">EW</th>
              <!-- Column Header -->
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
