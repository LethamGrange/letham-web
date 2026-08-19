export async function onRequestPost(context) {
  const db = context.env.curling_league;

  try {
    const formData = await context.request.formData();

    const selectValue = formData.get('competition_select');
    const customValue = formData.get('custom_competition_name');

    // If they picked 'Other', use the text box string. Otherwise, grab the strict dropdown value.
    const competitionName = selectValue === 'Other' ? customValue?.trim() : selectValue;

    if (!competitionName) {
      return new Response("<p style='color:var(--red-6);'>Error: Competition name is required.</p>", { status: 400 });
    }

    const matchDate = formData.get('match_date');
    const matchTime = formData.get('match_time');
    const sheet = formData.get('sheet');
    const concededEarly = formData.get('conceded') ? 1 : 0;

    // 1. GET THE NAMES FROM THE UI INSTEAD OF DIRECT IDS
    const teamAName = formData.get('team_a_name')?.trim();
    const teamBName = formData.get('team_b_name')?.trim();

    // Simple verification
    if (!teamAName || !teamBName || teamAName === teamBName) {
      return new Response(`<p style="color:var(--red-6);">Error: Invalid or identical team names.</p>`, {
        status: 400,
      });
    }

    // 2. DEFINE AUTOMATIC "GET OR CREATE" HELPER FOR THE STRINGS
    // Internal rinks are usually just named "Team Smith", external clubs have "CC" or "Club"
    const getOrCreateTeamId = async name => {
      const type = name.toLowerCase().includes('club') || name.toLowerCase().includes('cc') ? 'external' : 'internal';

      // Try inserting. If the name is already in the database, "ON CONFLICT DO NOTHING" skips it safely
      await db
        .prepare(
          `
        INSERT INTO clubs_or_rinks (name, type)
        VALUES (?, ?)
        ON CONFLICT(name) DO NOTHING
      `,
        )
        .bind(name, type)
        .run();

      // Retrieve the valid ID (whether it was just created or already existed)
      const record = await db.prepare(`SELECT id FROM clubs_or_rinks WHERE name = ?`).bind(name).first();
      return record.id;
    };

    // Resolve both names to real database integers safely
    const teamAId = await getOrCreateTeamId(teamAName);
    const teamBId = await getOrCreateTeamId(teamBName);

    // 3. THE RECOVERY PROCESS CONTINUES EXACTLY THE SAME
    let finalScoreA = 0;
    let finalScoreB = 0;
    const endsToInsert = [];

    for (let endNum = 1; endNum <= 8; endNum++) {
      const valA = formData.get(`e${endNum}_a`);
      const valB = formData.get(`e${endNum}_b`);

      if (valA === '' && valB === '') continue;

      const scoreA = parseInt(valA) || 0;
      const scoreB = parseInt(valB) || 0;

      finalScoreA += scoreA;
      finalScoreB += scoreB;

      endsToInsert.push({ end_number: endNum, score_a: scoreA, score_b: scoreB });
    }

    // 4. INSERT MASTER RECORD USING VALID FOREIGN KEY NUMBERS
    const masterInsertStmt = db
      .prepare(
        `
      INSERT INTO matches (
        match_date, match_time, sheet, competition_name,
        team_a_id, team_b_id,
        team_a_skip, team_a_third, team_a_second, team_a_lead,
        team_b_skip, team_b_third, team_b_second, team_b_lead,
        final_score_a, final_score_b, conceded_early
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
      )
      .bind(
        matchDate,
        matchTime,
        sheet,
        competitionName,
        teamAId,
        teamBId, // Storing verified integers!
        formData.get('team_a_skip'),
        formData.get('team_a_third'),
        formData.get('team_a_second'),
        formData.get('team_a_lead'),
        formData.get('team_b_skip'),
        formData.get('team_b_third'),
        formData.get('team_b_second'),
        formData.get('team_b_lead'),
        finalScoreA,
        finalScoreB,
        concededEarly,
      );

    const masterResult = await masterInsertStmt.first();
    const newMatchId = masterResult.id;

    // Batch end scores
    const batchStatements = endsToInsert.map(end =>
      db
        .prepare(`INSERT INTO match_ends (match_id, end_number, score_a, score_b) VALUES (?, ?, ?, ?)`)
        .bind(newMatchId, end.end_number, end.score_a, end.score_b),
    );

    if (batchStatements.length > 0) {
      await db.batch(batchStatements);
    }

    // Return the fresh view HTML component to htmx
    return await renderUpdatedResultsList(db);
  } catch (error) {
    return new Response(`<p style="color: var(--red-6);">Database Error: ${error.message}</p>`, { status: 500 });
  }
}

// Reusable helper to generate the fresh results list block to return to htmx
async function renderUpdatedResultsList(db) {
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

  const matchCards = results
    .map(match => {
      const isConceded = match.conceded_early ? ' <span class="badge conceded">Conceded</span>' : '';
      return `
      <div class="match-card" style="border: 1px solid var(--border); padding: var(--size-3); margin-bottom: var(--size-3); border-radius: var(--radius-2);">
        <header style="display: flex; justify-content: space-between; font-size: var(--font-size-0); color: var(--text-2); margin-bottom: var(--size-2);">
          <span><strong>${match.competition_name}</strong></span>
          <span>${match.match_date} @ ${match.match_time} — <strong>Sheet ${match.sheet}</strong></span>
        </header>
        <div class="match-score-row" style="display: flex; justify-content: space-between; align-items: center; font-size: var(--font-size-2);">
          <div class="team-line"><span class="${match.final_score_a > match.final_score_b ? 'winner' : ''}">${match.team_a_name}</span> <strong>${match.final_score_a}</strong></div>
          <div style="color: var(--text-3); font-size: var(--font-size-0);">vs</div>
          <div class="team-line"><strong>${match.final_score_b}</strong> <span class="${match.final_score_b > match.final_score_a ? 'winner' : ''}">${match.team_b_name}</span></div>
        </div>
        ${isConceded}
      </div>
    `;
    })
    .join('');
  const successMessage = `<p style="color: var(--green-6); font-weight: bold; margin-bottom: var(--size-2);">✓ Scorecard recorded successfully!</p>`;

  return new Response(`${successMessage}${matchCards}`, {
    headers: { 'Content-Type': 'text/html' },
  });
}
