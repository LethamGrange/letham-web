export async function onRequestPost(context) {
  const cookieHeader = context.request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/session=([^;]+)/);
  const token = match ? match[1] : null;

  const db = context.env.curling_league;
  const nowSeconds = Math.floor(Date.now() / 1000);

  // 1. Run a sweeping delete for ALL expired sessions across the site
  try {
    await db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(nowSeconds).run();
  } catch (error) {
    console.error('Failed to purge old sessions:', error);
  }

  // 2. Remove the current logging-out session from D1
  if (token) {
    try {
      await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    } catch (error) {
      console.error('Failed to delete session from D1:', error);
    }
  }

  // 3. Environment-aware cookie clearing (matching your login.js flags)
  const isProduction = context.env.CF_PAGES === '1';
  const secureFlag = isProduction ? ' Secure;' : '';

  const headers = new Headers({ 'HX-Redirect': '/' });
  headers.append('Set-Cookie', `session=; Path=/; HttpOnly;${secureFlag} SameSite=Strict; Max-Age=0`);
  headers.append('Set-Cookie', `user_role=; Path=/;${secureFlag} SameSite=Strict; Max-Age=0`);

  return new Response('Logged Out', {
    status: 200,
    headers,
  });
}
