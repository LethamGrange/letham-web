// functions/api/bookings.js

export async function onRequestGet(context) {
  try {
    // Fetch both approved and tentative bookings
    const { results } = await context.env.DB.prepare(
      "SELECT * FROM bookings WHERE status IN ('approved', 'tentative') ORDER BY is_recurring DESC, date ASC",
    ).all();

    if (!results || results.length === 0) {
      return new Response("<p class='no-bookings'>No events scheduled at the moment.</p>", {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    let html = "<ul class='bookings-list'>";

    results.forEach(b => {
      if (b.is_recurring) {
        const days = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

        // Inside your functions file loops, update the badge section of the string:
        html += `
  <li class="booking-item recurring status-${b.status}">
    <span class="booking-meta"><strong>Every ${days[b.day_of_week]}</strong> — ${b.name}</span>
    <span class="booking-badge"><span class="repeat-icon">↻</span> Weekly</span>
  </li>
`;
      } else {
        // We include status-${b.status} so WebC can style tentative vs approved slots differently
        const label = b.status === 'tentative' ? '⏳ Hold' : '✅ Booked';
        html += `
          <li class="booking-item single status-${b.status}">
            <span class="booking-meta"><strong>${b.date}</strong> — ${b.name}</span>
            <span class="booking-badge">${label}</span>
          </li>
        `;
      }
    });

    html += '</ul>';

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
    });
  } catch (error) {
    return new Response("<p class='error-text'>⚠️ Unable to load bookings right now.</p>", { status: 500 });
  }
}
