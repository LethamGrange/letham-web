import { renderUpdatedResultsList } from '../api/_render.js';
// Note: Adjust the import path relative to your project structure to find your shared utility file

// ==========================================
// 1. HANDLES CREATION (POST)
// ==========================================
export async function onRequestPost(context) {
  const db = context.env.curling_league;

  try {
    const formData = await context.request.formData();

    // Parse structural data fields
    const { matchDate, matchTime, sheet, competitionName, teamAId, teamBId, concededEarly, endsToInsert } =
      await parseAndValidateScorecard(formData, db);

    // Save Master Match Record to D1 (INSERTION)
    const masterInsertStmt = db
      .prepare(
        `
      INSERT INTO matches (
        match_date, match_time, sheet, competition_name, team_a_id, team_b_id,
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
        teamBId,
        formData.get('team_a_skip'),
        formData.get('team_a_third'),
        formData.get('team_a_second'),
        formData.get('team_a_lead'),
        formData.get('team_b_skip'),
        formData.get('team_b_third'),
        formData.get('team_b_second'),
        formData.get('team_b_lead'),
        endsToInsert.reduce((sum, e) => sum + e.score_a, 0), // final_score_a
        endsToInsert.reduce((sum, e) => sum + e.score_b, 0), // final_score_b
        concededEarly,
      );

    const masterResult = await masterInsertStmt.first();
    const newMatchId = masterResult.id;

    // Save individual end records in a safe batch transaction
    await saveMatchEndsBatch(db, newMatchId, endsToInsert);

    // Return the fresh centralized HTML results fragment
    return await renderUpdatedResultsList(db);
  } catch (error) {
    return new Response(error.message, { status: error.status || 500 });
  }
}

// ==========================================
// 2. HANDLES MODIFICATIONS (PUT)
// ==========================================
export async function onRequestPut(context) {
  const db = context.env.curling_league;

  try {
    const formData = await context.request.formData();
    const matchId = parseInt(formData.get('match_id'));

    if (!matchId) {
      return new Response('Missing match identifier tracking for modification transaction.', { status: 400 });
    }

    // Parse structural data fields using the exact same logic rules
    const { matchDate, matchTime, sheet, competitionName, teamAId, teamBId, concededEarly, endsToInsert } =
      await parseAndValidateScorecard(formData, db);

    const finalScoreA = endsToInsert.reduce((sum, e) => sum + e.score_a, 0);
    const finalScoreB = endsToInsert.reduce((sum, e) => sum + e.score_b, 0);

    // Update the Master Match Record in D1 (MODIFICATION)
    await db
      .prepare(
        `
      UPDATE matches SET
        match_date = ?, match_time = ?, sheet = ?, competition_name = ?, team_a_id = ?, team_b_id = ?,
        team_a_skip = ?, team_a_third = ?, team_a_second = ?, team_a_lead = ?,
        team_b_skip = ?, team_b_third = ?, team_b_second = ?, team_b_lead = ?,
        final_score_a = ?, final_score_b = ?, conceded_early = ?
      WHERE id = ?
    `,
      )
      .bind(
        matchDate,
        matchTime,
        sheet,
        competitionName,
        teamAId,
        teamBId,
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
        matchId,
      )
      .run();

    // Rebuild linescore rows: delete old reference rows, then overwrite with fresh ones
    await db.prepare(`DELETE FROM match_ends WHERE match_id = ?`).bind(matchId).run();
    await saveMatchEndsBatch(db, matchId, endsToInsert);

    // Return the fresh centralized HTML results fragment smoothly
    return await renderUpdatedResultsList(db);
  } catch (error) {
    return new Response(error.message, { status: error.status || 500 });
  }
}

// ==========================================
// SHARED BACKEND UTILITIES (Keeps things DRY)
// ==========================================

async function parseAndValidateScorecard(formData, db) {
  const matchDate = formData.get('match_date');
  const matchTime = formData.get('match_time');
  const sheet = formData.get('sheet');
  const concededEarly = formData.get('conceded') ? 1 : 0;

  // Resolve competition selection logic
  const selectValue = formData.get('competition_select');
  const customValue = formData.get('custom_competition_name');
  const competitionName = selectValue === 'Other' ? customValue?.trim() : selectValue;

  const teamAName = formData.get('team_a_name')?.trim();
  const teamBName = formData.get('team_b_name')?.trim();

  if (!teamAName || !teamBName || teamAName === teamBName) {
    throw createError('Invalid or identical team names submitted.', 400);
  }

  // Get or Create Rink Records utility helper
  const getOrCreateTeamId = async name => {
    const type = name.toLowerCase().includes('club') || name.toLowerCase().includes('cc') ? 'external' : 'internal';
    await db
      .prepare(`INSERT INTO clubs_or_rinks (name, type) VALUES (?, ?) ON CONFLICT(name) DO NOTHING`)
      .bind(name, type)
      .run();
    const record = await db.prepare(`SELECT id FROM clubs_or_rinks WHERE name = ?`).bind(name).first();
    return record.id;
  };

  const teamAId = await getOrCreateTeamId(teamAName);
  const teamBId = await getOrCreateTeamId(teamBName);

  // Accumulate linescores loop array
  const endsToInsert = [];
  for (let i = 1; i <= 8; i++) {
    const valA = formData.get(`e${i}_a`);
    const valB = formData.get(`e${i}_b`);

    if (valA === '' && valB === '') continue;

    const scoreA = parseInt(valA) || 0;
    const scoreB = parseInt(valB) || 0;

    if (scoreA > 0 && scoreB > 0) {
      throw createError(`Curling Error: Both teams logged scores in End ${i}.`, 400);
    }
    endsToInsert.push({ end_number: i, score_a: scoreA, score_b: scoreB });
  }

  return { matchDate, matchTime, sheet, competitionName, teamAId, teamBId, concededEarly, endsToInsert };
}

async function saveMatchEndsBatch(db, matchId, endsToInsert) {
  const batchStatements = endsToInsert.map(end =>
    db
      .prepare(`INSERT INTO match_ends (match_id, end_number, score_a, score_b) VALUES (?, ?, ?, ?)`)
      .bind(matchId, end.end_number, end.score_a, end.score_b),
  );
  if (batchStatements.length > 0) {
    await db.batch(batchStatements);
  }
}

function createError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}
