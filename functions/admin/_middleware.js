// functions/admin/_middleware.js
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const db = context.env.curling_league;
  console.log(context.env.curling_league);

  // Skip authentication checks on public assets or the login routes themselves
  if (
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/api/login') ||
    url.pathname.startsWith('/static')
  ) {
    return context.next();
  }

  // 1. Extract the session cookie
  const cookieHeader = context.request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/session=([^;]+)/);
  const token = match ? match[1] : null;

  let userRole = 'guest';
  let userId = null;

  if (token) {
    const now = Math.floor(Date.now() / 1000);

    // 2. Look up the session token in D1
    const session = await db
      .prepare(
        `
      SELECT sessions.user_id, users.role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > ?
    `,
      )
      .bind(token, now)
      .first();

    if (session) {
      userId = session.user_id;
      userRole = session.role;
    }
  }

  // 3. Save details to context.data for shared renderers/endpoints
  context.data.userId = userId;
  context.data.role = userRole;

  // 4. If they need to be an admin but aren't, bounce them using HX-Redirect or a 302
  const isAdminRoute = url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/admin');
  if (isAdminRoute && userRole !== 'admin') {
    const loginUrl = `/login?next=${encodeURIComponent(url.pathname)}`;
    const isHtmx = context.request.headers.get('HX-Request') === 'true';

    if (isHtmx) {
      return new Response('Unauthorized redirecting...', {
        headers: { 'HX-Redirect': loginUrl },
      });
    } else {
      return Response.redirect(new URL(loginUrl, context.request.url), 302);
    }
  }

  return context.next();
}
