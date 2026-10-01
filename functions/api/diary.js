export async function onRequestGet(context) {
  const db = context.env.curling_league;
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=60', // Optional short cache for performance
  };

  try {
    // Collapses multiple sheet games down into single timeline rows
    const { results } = await db
      .prepare(
        `
      SELECT
        f.fixture_date AS rawDate,
        f.fixture_time AS rawTime,
        c.name AS competitionName,
        c.kind AS competitionKind
      FROM fixtures f
      JOIN competitions c ON f.competition_id = c.id
      JOIN games g ON g.fixture_id = f.id
      GROUP BY f.fixture_date, f.fixture_time, c.name
      ORDER BY f.fixture_date ASC, f.fixture_time ASC
    `,
      )
      .all();

    // Map and transform raw data into reader-ready strings
    const diaryEntries = results.map(row => {
      // Formats '2026-09-09' -> '9 Sep 2026'
      const formattedDate = new Date(row.rawDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      // Formats '18:00' -> '6.00pm' to match your physical syllabus style
      let formattedTime = '';
      if (row.rawTime) {
        const [hours, minutes] = row.rawTime.split(':');
        const h = parseInt(hours, 10);
        const ampm = h >= 12 ? 'pm' : 'am';
        const displayHours = h % 12 === 0 ? 12 : h % 12;
        formattedTime = `${displayHours}.${minutes}${ampm}`;
      }

      return {
        rawDate: row.rawDate,
        rawTime: row.rawTime,
        date: formattedDate,
        time: formattedTime,
        game: row.competitionName,
        kind: row.competitionKind,
      };
    });

    return new Response(JSON.stringify({ success: true, diary: diaryEntries }), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Diary API Exception:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers,
    });
  }
}
