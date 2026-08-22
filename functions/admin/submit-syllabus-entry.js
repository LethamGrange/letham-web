export async function onRequestPost(context) {
  const db = context.env.curling_league;

  try {
    const formData = await context.request.formData();

    const seasonYear = formData.get('season_year');
    const compName = formData.get('competition_name')?.trim();
    const compKind = formData.get('competition_kind');
    const compSubKind = formData.get('competition_sub_kind') || 'full';

    // Extract our permissive layout keys
    const fixDate = formData.get('fixture_date') || null;
    const fixTime = formData.get('fixture_time') || null;
    const sheet = formData.get('sheet') || null;

    const teamAVal = formData.get('team_a_index');
    const teamBVal = formData.get('team_b_index');
    const externalVersus = formData.get('external_versus')?.trim() || null;

    const teamAIndex = teamAVal !== '' ? parseInt(teamAVal) : null;
    const teamBIndex = teamBVal !== '' ? parseInt(teamBVal) : null;

    if (!compName) {
      return new Response('Validation Error: Competition Name is mandatory.', { status: 400 });
    }

    // 1. GET OR CREATE THE MASTER SYLLABUS COMPETITION ENTRY
    // Uses ON CONFLICT DO NOTHING to guarantee safety if it's already registered
    await db
      .prepare(
        `
      INSERT INTO syllabus_competitions (season_year, name, kind, sub_kind)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(name) DO NOTHING
    `,
      )
      .bind(seasonYear, compName, compKind, compSubKind)
      .run();

    // Fetch the primary key ID for that competition reference row
    const compRecord = await db.prepare(`SELECT id FROM syllabus_competitions WHERE name = ?`).bind(compName).first();
    const competitionId = compRecord.id;

    // 2. INSERT THE LIVE FIXTURE ROW INTO THE DIARY LOG
    await db
      .prepare(
        `
      INSERT INTO syllabus_fixtures (
        competition_id, fixture_date, fixture_time, sheet, team_a_index, team_b_index, external_versus
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .bind(competitionId, fixDate, fixTime, sheet, teamAIndex, teamBIndex, externalVersus)
      .run();

    // 3. SEAMLESS REFETCH: Reach out to your public diary list renderer to rebuild the screen preview view!
    // For convenience, we can run a fetch to the dynamic diary api directly
    const diaryUrl = new URL(context.request.url);
    diaryUrl.pathname = '/api/get-diary'; // Directs to the timeline renderer we built earlier

    const response = await context.env.ASSETS.fetch(diaryUrl);
    return new Response(await response.text(), { headers: { 'Content-Type': 'text/html' } });
  } catch (error) {
    return new Response(`Database Syllabus Error: ${error.message}`, { status: 500 });
  }
}
