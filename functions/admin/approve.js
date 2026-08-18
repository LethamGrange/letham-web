// functions/admin/approve.js

export async function onRequestPost(context) {
  try {
    const formData = await context.request.formData();
    const id = formData.get('id');
    const targetStatus = formData.get('status'); // 'approved', 'denied', 'tentative', or 'cancelled'

    if (!id || !targetStatus) {
      return new Response('Missing parameters', { status: 400 });
    }

    // 1. Update the database column dynamically
    await context.env.DB.prepare('UPDATE bookings SET status = ? WHERE id = ?').bind(targetStatus, id).run();

    // 2. Fetch the updated row record to reflect the new state
    const b = await context.env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first();

    // 3. Match the badge styling logic used in queue.js
    let badgeClass = 'badge-tentative';
    if (b.status === 'approved') badgeClass = 'badge-approved';
    if (b.status === 'denied') badgeClass = 'badge-denied';
    if (b.status === 'cancelled') badgeClass = 'badge-cancelled';

    let statusLabel = b.status.charAt(0).toUpperCase() + b.status.slice(1);
    const eventDetails = b.is_recurring ? `🔄 Weekly (Day ${b.day_of_week})` : b.date;

    // 4. Return the fresh row element matching the structure of queue.js
    return new Response(
      `
      <div class="booking-row status-${b.status}" id="booking-container-${b.id}" style="display: flex; align-items: center; justify-content: space-between; background: var(--surface-2); padding: var(--size-3); margin-bottom: var(--size-2); border-radius: var(--radius-2); border: var(--border-size-1) solid var(--surface-3);">
        <div class="booking-info">
          <span class="date" style="font-weight: bold; color: ${b.is_recurring ? 'var(--purple-6)' : 'var(--text-1)'};">${eventDetails}</span>
          <span class="name" style="color: var(--text-1);">— ${b.name} (${b.email})</span>
<span class="badge ${badgeClass}" style="padding: var(--size-1) var(--size-2); border-radius: var(--radius-1); font-size: var(--font-size-0); font-weight: bold;">${statusLabel}</span>

        </div>
        <div class="action-cell" style="display: flex; gap: var(--size-2); align-items: center;">

          ${
            b.status !== 'approved' && b.status !== 'cancelled'
              ? `
            <button class="btn-approve-action"
              hx-post="/admin/approve"
              hx-vals='{"id": ${b.id}, "status": "approved"}'
              hx-target="#booking-container-${b.id}"
              hx-swap="outerHTML">Approve</button>
          `
              : ''
          }

          ${
            b.status !== 'denied' && b.status !== 'cancelled'
              ? `
            <button  class="btn-deny-action"
              hx-post="/admin/approve"
              hx-vals='{"id": ${b.id}, "status": "denied"}'
              hx-target="#booking-container-${b.id}"
              hx-swap="outerHTML">Deny</button>
          `
              : ''
          }

          ${
            b.status !== 'tentative'
              ? `
            <button  class="btn-tentative-action"
              hx-post="/admin/approve"
              hx-vals='{"id": ${b.id}, "status": "tentative"}'
              hx-target="#booking-container-${b.id}"
              hx-swap="outerHTML">Reset</button>
          `
              : ''
          }

          ${
            b.status !== 'cancelled'
              ? `
            <button  class="btn-cancel-action"
              hx-post="/admin/approve"
              hx-vals='{"id": ${b.id}, "status": "cancelled"}'
              Zhx-confirm="Are you sure you want to flag this event as Cancelled?"
              hx-target="#booking-container-${b.id}"
              hx-swap="outerHTML">
              Cancel Booking
            </button>
          `
              : ''
          }

        </div>
      </div>
    `,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  } catch (error) {
    console.error('Dashboard button processing failure:', error);
    return new Response('Failed to complete administrative state update', { status: 500 });
  }
}
