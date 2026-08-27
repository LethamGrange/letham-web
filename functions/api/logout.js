export async function onRequestPost(context) {
  // 1. Extract the session cookie to identify what token to destroy
  const cookieHeader = context.request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/session=([^;]+)/);
  const token = match ? match[1] : null;

  const db = context.env.curling_league;

  if (token) {
    try {
      // 2. Remove the session from D1 so the token is immediately invalidated
      await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    } catch (error) {
      console.error('Failed to delete session from D1:', error);
    }
  }

  // // 3. Clear the cookie by setting an expired Max-Age, and issue an HX-Redirect
  // return new Response('Logged out', {
  //   status: 200,
  //   headers: {
  //     'Set-Cookie': 'session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
  //     'HX-Redirect': '/login',
  //   },
  // });onRequestPost
  //
  const headers = new Headers({ 'HX-Redirect': '/' });
  headers.append('Set-Cookie', `session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
  headers.append('Set-Cookie', `user_role=; Path=/; Max-Age=0`);

  return new Response('Logged Out', {
    status: 200,
    headers,
  });
}
