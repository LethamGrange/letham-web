import { renderUpdatedResultsList } from '../api/_render.js';

// ==========================================
// 1. HANDLES CREATION (POST)
// ==========================================
export async function onRequestPost(context) {
  const db = context.env.curling_league;

  try {
    const formData = await context.request.formData();

    // Parse structural data fields
    const { matchDate, matchTime, sheet, competitionName, teamAId, teamBId, endsToInsert } =
      await parseAndValidateScorecard(formData, db);

    const finalScoreA = endsToInsert.reduce((sum, e) => sum + e.score_a, 0);
    const finalScoreB = endsToInsert.reduce((sum, e) => sum + e.score_b, 0);

    // 1. Step A: Insert the Master Match Record first and return its actual generated ID
    const masterResult = await db
      .prepare(
        `
        INSERT INTO matches (
          match_date, match_time, sheet, competition_name, team_a_id, team_b_id,
          team_a_skip, team_a_third, team_a_second, team_a_lead,
          team_b_skip, team_b_third, team_b_second, team_b_lead,
          final_score_a, final_score_b
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        finalScoreA,
        finalScoreB,
      )
      .first();

    const newMatchId = masterResult.id; // Now we have the definitive, real ID!

    // 2. Step B: Batch insert all the child linescore rows using the concrete newMatchId
    if (endsToInsert.length > 0) {
      const statements = [];
      for (const end of endsToInsert) {
        statements.push(
          db
            .prepare(
              `
            INSERT INTO match_ends (match_id, end_number, score_a, score_b)
            VALUES (?, ?, ?, ?)
          `,
            )
            .bind(newMatchId, end.end_number, end.score_a, end.score_b),
        );
      }
      // Execute all child rows together in one batch
      await db.batch(statements);
    }

    // Return the fresh centralized HTML results fragment smoothly
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

  return await renderUpdatedResultsList(db);

  try {
    const formData = await context.request.formData();
    const matchId = parseInt(formData.get('match_id'));

    if (!matchId) {
      return new Response('Missing match identifier tracking for modification transaction.', { status: 400 });
    }

    const { matchDate, matchTime, sheet, competitionName, teamAId, teamBId, endsToInsert } =
      await parseAndValidateScorecard(formData, db);

    const finalScoreA = endsToInsert.reduce((sum, e) => sum + e.score_a, 0);
    const finalScoreB = endsToInsert.reduce((sum, e) => sum + e.score_b, 0);

    // 1. Prepare array of transaction statements
    const statements = [
      db
        .prepare(
          `
        UPDATE matches SET
          match_date = ?, match_time = ?, sheet = ?, competition_name = ?, team_a_id = ?, team_b_id = ?,
          team_a_skip = ?, team_a_third = ?, team_a_second = ?, team_a_lead = ?,
          team_b_skip = ?, team_b_third = ?, team_b_second = ?, team_b_lead = ?,
          final_score_a = ?, final_score_b = ?
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
          matchId,
        ),

      // Clear Old Ends
      db.prepare(`DELETE FROM match_ends WHERE match_id = ?`).bind(matchId),
    ];

    // Append fresh linescore inserts dynamically up to end 12
    for (const end of endsToInsert) {
      statements.push(
        db
          .prepare(
            `
          INSERT INTO match_ends (match_id, end_number, score_a, score_b)
          VALUES (?, ?, ?, ?)
        `,
          )
          .bind(matchId, end.end_number, end.score_a, end.score_b),
      );
    }

    await db.batch(statements);

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

  const competitionName = formData.get('competition_name');

  const teamAName = formData.get('team_a_name')?.trim();
  const teamBName = formData.get('team_b_name')?.trim();

  if (!teamAName || !teamBName || teamAName === teamBName) {
    throw createError('Invalid or identical team names submitted.', 400);
  }

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

  const hasExtraEnds = formData.get('');

  // Accumulate linescores loop array - ITERATING UP TO 12 ENDS 🥌
  const endsToInsert = [];
  for (let i = 1; i <= 12; i++) {
    const valA = formData.get(`e${i}_a`);
    const valB = formData.get(`e${i}_b`);

    if (valA === '' && valB === '') continue;

    const scoreA = parseInt(valA) || 0;
    const scoreB = parseInt(valB) || 0;

    if (scoreA > 0 && scoreB > 0) {
      let endLabel = i <= 10 ? `End ${i}` : i === 11 ? 'EE' : 'EEE';
      throw createError(`Curling Error: Both teams logged scores in ${endLabel}.`, 400);
    }
    endsToInsert.push({ end_number: i, score_a: scoreA, score_b: scoreB });
  }

  return { matchDate, matchTime, sheet, competitionName, teamAId, teamBId, endsToInsert };
}

function createError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}
