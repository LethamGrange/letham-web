// functions/admin/create-recurring.js

export async function onRequestPost(context) {
  try {
    const formData = await context.request.formData();
    const name = formData.get('name')?.trim();
    const dayOfWeek = parseInt(formData.get('day_of_week'), 10);
    const startDate = formData.get('start_date'); // This maps to our standard 'date' field as the activation anchor
    const endDate = formData.get('end_date') || null;

    if (!name || isNaN(dayOfWeek) || !startDate) {
      return new Response("<p style='color:#e53e3e;'>⚠️ Missing required creation fields.</p>", { status: 400 });
    }

    // Insert directly as an approved recurring schedule pattern block
    await context.env.DB.prepare(
      `
        INSERT INTO bookings (date, name, email, status, is_recurring, day_of_week, end_date)
        VALUES (?, ?, 'admin-override@westmuir.internal', 'approved', 1, ?, ?)
      `,
    )
      .bind(startDate, name, dayOfWeek, endDate)
      .run();

    // Return a neat inline message to the dashboard form box with a reload link
    return new Response(
      `
      <div style="background: #f0fff4; border: 1px solid #38a169; padding: 1rem; border-radius: 6px; color: #22543d;">
        <strong>✅ Success!</strong> "${name}" has been permanently approved as a weekly block slot.
        <br><small><a href="/admin" style="color: #2f855a; font-weight:bold;">Refresh dashboard queue</a> to view or modify elements.</small>
      </div>
    `,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  } catch (error) {
    console.error('Failed to commit recurring template structure:', error);
    return new Response("<p style='color:#e53e3e;'>⚠️ DB Error: Unable to complete schedule lock.</p>", {
      status: 500,
    });
  }
}
