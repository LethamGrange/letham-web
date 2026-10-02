export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  // Define your simple linear role rankings
  const ROLES = {
    public: 0,
    member: 1,
    admin: 2,
  };

  // 1. Identify which folder is being accessed and assign its required role tier
  let requiredRole = 'public';

  if (url.pathname.startsWith('/pdfs/members/')) {
    requiredRole = 'member'; // Standard logged-in members (and admins) can see these
  }

  if (url.pathname.startsWith('/pdfs/admin-only/')) {
    requiredRole = 'admin'; // Restricted exclusively to the admin tier
  }

  // 2. Enforce rules if the target folder requires a logged-in account
  if (requiredRole !== 'public') {
    const cookieHeader = request.headers.get('Cookie') || '';
    const match = cookieHeader.match(/(?:^|; )session=([^;]*)/);
    const sessionToken = match ? match[1] : null;

    // No session token? Send them straight to your login form
    if (!sessionToken) {
      return Response.redirect(`${url.origin}/login?next=${encodeURIComponent(url.pathname)}`, 302);
    }

    const db = env.curling_league;
    const nowSeconds = Math.floor(Date.now() / 1000);

    // 3. Extract the active user's permissions directly from your D1 tables
    const userSession = await db
      .prepare(
        `
        SELECT s.user_id, u.role
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > ?
      `,
      )
      .bind(sessionToken, nowSeconds)
      .first();

    // Expired or forged session token check
    if (!userSession) {
      return Response.redirect(`${url.origin}/login?next=${encodeURIComponent(url.pathname)}`, 302);
    }

    // 4. Validate user hierarchy rank against the folder requirements
    const userRole = userSession.role || 'member'; // Fallback to safe default
    if (ROLES[userRole] < ROLES[requiredRole]) {
      return new Response('Forbidden: Insufficient Permissions', { status: 403 });
    }
  }

  // If the path is public, or permissions match, pass the request safely through
  return await next();
}
