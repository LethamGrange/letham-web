// functions/helpers/auth.js
export async function getSessionRole(context) {
  // 1. Extract the session cookie
  const cookieHeader = context.request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/session=([^;]+)/);
  const token = match ? match[1] : null;

  if (!token) return 'user'; // Fallback if no cookie is present

  try {
    const now = Math.floor(Date.now() / 1000);

    // 2. Query D1 to verify the token is still active
    const session = await context.env.curling_league
      .prepare(
        `
      SELECT users.role
      FROM sessions
      JOIN users ON sessions.user_id = users.id
      WHERE sessions.token = ? AND sessions.expires_at > ?
    `,
      )
      .bind(token, now)
      .first();

    // 3. Return the verified role, or default to 'user'
    return session ? session.role : 'user';
  } catch (error) {
    console.error('Helper session lookup failed:', error);
    return 'user';
  }
}
