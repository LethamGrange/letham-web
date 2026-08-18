// functions/api/book.js

export async function onRequestPost(context) {
  try {
    const request = context.request;

    // 1. Parse the incoming standard HTML form data submitted via HTMX
    const formData = await request.formData();
    const date = formData.get('date');
    const name = formData.get('name')?.trim();
    const email = formData.get('email')?.trim();
    const turnstileToken = formData.get('cf-turnstile-response');

    const turnstileSecret = context.env.TURNSTILE_SECRET || '1x00000000000000000000000000000000AA';
    // 2. Simple server-side validation check
    if (!date || !name || !email) {
      return new Response("<p class='error-msg'>⚠️ Missing required form fields. Please fill out all entries.</p>", {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    const verifyResult = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${turnstileSecret}&response=${turnstileToken}`,
    });

    const outcome = await verifyResult.json();
    if (!outcome.success) {
      return new Response("<p class='error-msg'>⚠️ Security verification failed. Please try again.</p>", {
        status: 400,
      });
    }

    // 1. Calculate the day of the week for the user's requested date
    // e.g., "2026-06-09" becomes day 2 (Tuesday)
    const requestedDateObj = new Date(date);
    const requestedDayOfWeek = requestedDateObj.getDay();

    // 2. Scan for a conflicting SINGLE booking on that exact date
    const singleConflict = await context.env.DB.prepare(
      "SELECT id FROM bookings WHERE date = ? AND status = 'approved' AND is_recurring = 0",
    )
      .bind(date)
      .first();

    // 3. Scan for a conflicting RECURRING booking that matches this day of the week
    // It must match the day of the week, be approved, and the requested date must fall within its start/end range
    const recurringConflict = await context.env.DB.prepare(
      `
    SELECT name FROM bookings
    WHERE is_recurring = 1
      AND status = 'approved'
      AND day_of_week = ?
      AND date <= ?
      AND (end_date IS NULL OR end_date >= ?)
  `,
    )
      .bind(requestedDayOfWeek, date, date)
      .first();

    // 4. Block submission if either conflict exists
    if (singleConflict || recurringConflict) {
      const conflictName = recurringConflict ? recurringConflict.name : 'another reservation';
      return new Response(
        `
    <div class="booking-error-message" style="border: 2px solid #e53e3e; padding: 1rem; background: #fff5f5; border-radius: 6px;">
      <h4 style="color: #c53030; margin-top:0;">🚫 Date Unavailable</h4>
      <p>Sorry, <strong>${date}</strong> is unavailable because it conflicts with an approved slot (${conflictName}).</p>
      <button class="btn-submit" onclick="window.location.reload()">Choose a Different Date</button>
    </div>
  `,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      );
    }

    // 3. Insert the incoming booking safely using SQL parameterized variables (?)
    // This entirely blocks malicious SQL-injection attacks automatically
    await context.env.DB.prepare("INSERT INTO bookings (date, name, email, status) VALUES (?, ?, ?, 'tentative')")
      .bind(date, name, email)
      .run();

    // 4. Return a clean confirmation message fragment back to the browser
    // HTMX replaces the whole form window with this successful block
    return new Response(
      `
  <div class="booking-success-message" style="border: var(--border-size-2) solid var(--cyan-7); padding: var(--size-4); background: var(--surface-2); border-radius: var(--radius-2);">
    <h4 style="color: var(--text-1); margin-top:0;">🎉 Request Logged Successfully!</h4>
    <p style="color: var(--text-2);">Thank you, <strong>${name}</strong>. Your hold for <strong>${date}</strong> has been saved.</p>
    <button class="btn-submit" onclick="window.location.reload()">Submit Another Request</button>
  </div>
`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  } catch (error) {
    console.error('Database insert failed:', error);

    return new Response(
      "<p class='error-msg'>⚠️ System Error: Unable to save your booking slot at this time. Please try again.</p>",
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}
