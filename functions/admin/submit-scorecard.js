import { renderUpdatedResultsList } from '../api/_render.js';

// ==========================================
// 1. HANDLES CREATION (POST)
// ==========================================
export async function onRequestPost(context) {
  const db = context.env.curling_league;

  try {
    const formData = await context.request.formData();
    const fields = await parseAndValidateScorecard(formData, db);

    await db
      .prepare(
        `
        INSERT INTO matches (
          match_date, match_time, sheet, competition_name, team_a_id, team_b_id,
          team_a_skip, team_a_third, team_a_second, team_a_lead,
          team_b_skip, team_b_third, team_b_second, team_b_lead,
          team_a_ends , team_b_ends,
          final_score_a, final_score_b
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

      `,
      )
      .bind(...Object.values(fields))
      .run();

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

  try {
    const formData = await context.request.formData();
    const matchId = parseInt(formData.get('match[id]'));

    if (!matchId) {
      return new Response('Missing match identifier tracking for modification transaction.', { status: 400 });
    }
    const fields = await parseAndValidateScorecard(formData, db);
    await db
      .prepare(
        `
        UPDATE matches SET
          match_date = ?, match_time = ?, sheet = ?, competition_name = ?, team_a_id = ?, team_b_id = ?,
          team_a_skip = ?, team_a_third = ?, team_a_second = ?, team_a_lead = ?,
          team_b_skip = ?, team_b_third = ?, team_b_second = ?, team_b_lead = ?,
          team_a_ends = ?, team_b_ends = ?,
          final_score_a = ?, final_score_b = ?
        WHERE id = ?
      `,
      )
      .bind(...Object.values(fields), matchId)
      .run();

    return await renderUpdatedResultsList(db);
  } catch (error) {
    return new Response(error.message, { status: error.status || 500 });
  }
}

// ==========================================
// SHARED BACKEND UTILITIES (Keeps things DRY)
// ==========================================
async function parseAndValidateScorecard(formData, db) {
  const matchDate = formData.get('match[date]');
  const matchTime = formData.get('match[time]');
  const sheet = formData.get('match[sheet]'); // From match[sheet] or flat sheet select
  const competitionName = formData.get('match[competition_name]');

  // 2. Extract explicit team names
  const teamAName = formData.get('team[a][name]')?.trim();
  const teamBName = formData.get('team[b][name]')?.trim();
  try {
    const teamplayers = {};
    for (let key of ['a', 'b']) {
      for (let player of ['skip', 'third', 'second', 'lead']) {
        teamplayers[`team_${key}_${player}`] = formData.get(`team[${key}][players][${player}]`);
      }
    }

    if (!teamAName || !teamBName || teamAName === teamBName) {
      throw createError('Invalid or identical team names submitted.', 400);
    }
    const teamAId = await getOrCreateTeamId(db, teamAName);
    const teamBId = await getOrCreateTeamId(db, teamBName);

    // 3. Process Linescore strings up to 12 ends 🥌
    const scoresA = [];
    const scoresB = [];

    const hasExtraEnds = formData.get('match[has_extra_ends]') === 'true';

    const numberOfEnds = hasExtraEnds ? 12 : 8;

    // Accumulate linescores loop array - ITERATING UP TO 12 ENDS 🥌
    const endsToInsert = [];
    for (let i = 0; i < numberOfEnds; i++) {
      const valA = formData.get(`ends[${i + 1}][a]`);
      const valB = formData.get(`ends[${i + 1}][b]`);

      const sA = valA && valA.trim() !== '' ? parseInt(valA, 10) : '';
      const sB = valB && valB.trim() !== '' ? parseInt(valB, 10) : '';

      // Validation mirror check matches frontend safety rules
      if (typeof sA === 'number' && sA > 0 && typeof sB === 'number' && sB > 0) {
        let endLabel = i <= 10 ? `End ${i}` : i === 11 ? 'EE' : 'EEE';
        throw createError(`Curling Error: Both teams logged scores in ${endLabel}.`, 400);
      }

      scoresA.push(sA);
      scoresB.push(sB);
    }

    // Join down to predictable database text strings (e.g., "1,2,0,0,4,,,,")
    const teamAEndsString = scoresA.join(',');
    const teamBEndsString = scoresB.join(',');
    return {
      matchDate,
      matchTime,
      sheet,
      competitionName,
      teamAId,
      teamBId,

      ...teamplayers, // 👈 Merges teamplayers keys directly into the object

      teamAEndsString,
      teamBEndsString,
      finalScoreA: scoresA.reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0),
      finalScoreB: scoresB.reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0),
    };
  } catch (e) {
    console.log(e.toString());
  }
}

async function getOrCreateTeamId(db, name) {
  const type = name.toLowerCase().includes('club') || name.toLowerCase().includes('cc') ? 'external' : 'internal';
  await db
    .prepare(`INSERT INTO clubs_or_rinks (name, type) VALUES (?, ?) ON CONFLICT(name) DO NOTHING`)
    .bind(name, type)
    .run();
  const record = await db.prepare(`SELECT id FROM clubs_or_rinks WHERE name = ?`).bind(name).first();
  return record.id;
}

function createError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}
