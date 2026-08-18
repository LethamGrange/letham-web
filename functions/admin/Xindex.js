// functions/admin/index.js

export async function onRequestGet(context) {
  try {
    // Authenticated state is guaranteed by the middleware!
    const { results } = await context.env.DB.prepare('SELECT * FROM bookings ORDER BY date ASC').all();

    let html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Dashboard - Westmuir Hall</title>
<script
  src="https://unpkg.com/htmx.org@1.9.12"
  integrity="sha384-ujb1lZYygJmzgSwoxRggbCHcjc0rB2XoQrxeTUQyRjrOnlCoYta87iKBWq3EsdM2"
  crossorigin="anonymous"
  webc:keep
></script>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; color: #1a202c; background: #f7fafc; }
          h1 { border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
          .booking-row { display: flex; align-items: center; justify-content: space-between; background: white; padding: 1rem; margin-bottom: 0.75rem; border-radius: 6px; border: 1px solid #e2e8f0; }
          .booking-info { flex-grow: 1; }
          .date { font-weight: bold; margin-right: 1rem; }
          .badge { padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem; font-weight: bold; }
          .badge-approved { background: #c6f6d5; color: #22543d; }
          .badge-tentative { background: #feebc8; color: #744210; }
          .btn-approve { background: #3182ce; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-weight: bold; }
          .btn-approve:hover { background: #2b6cb0; }
        </style>
      </head>
      <body>
        <h1>Westmuir Village Hall Admin Panel</h1>
        <p>Review and manage requested facility rental slots below.</p>

        <div class="dashboard-list">
    `;

    if (!results || results.length === 0) {
      html += '<p>No bookings found in the database.</p>';
    } else {
      results.forEach(b => {
        const isApproved = b.status === 'approved';

        html += `
          <div class="booking-row" id="booking-container-${b.id}">
            <div class="booking-info">
              <span class="date">${b.date}</span>
              <span class="name">${b.name} (${b.email})</span>
            </div>
            <div class="action-cell">
              ${
                isApproved
                  ? '<span class="badge badge-approved">Approved</span>'
                  : `<button
                     class="btn-approve"
                     hx-post="/admin/approve"
                     hx-vals='{"id": ${b.id}}'
                     hx-target="#booking-container-${b.id}"
                     hx-swap="outerHTML">
                     Approve Request
                   </button>`
              }
            </div>
          </div>
        `;
      });
    }

    html += `
        </div>
        <p style="margin-top: 2rem;"><a href="/">← Return to Public Website</a></p>
      </body>
      </html>
    `;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    return new Response('Database dashboard lookup error', { status: 500 });
  }
}
