export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  // 1. Parse the session cookie text securely
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/(?:^|; )session=([^;]*)/);
  const sessionToken = match ? match[1] : null;
  if (sessionToken) {
    const db = env.curling_league;
    const nowSeconds = Math.floor(Date.now() / 1000);

    // 2. Look up the session token string inside D1
    const activeSession = await db
      .prepare('SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?')
      .bind(sessionToken, nowSeconds)
      .first();

    if (activeSession) {
      // 3. Transparently serve the pre-rendered members page variant at the Edge
      // The browser URL remains exactly "/resources/" for the user
      return await env.ASSETS.fetch(new URL('/resources/private/', url.origin));
    }
  }

  // Otherwise, default to serving the standard public /resources/index.html layout
  return await next();
}
