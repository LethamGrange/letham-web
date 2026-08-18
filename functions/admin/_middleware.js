// functions/admin/_middleware.js

export async function onRequest(context) {
  const request = context.request;
  const authHeader = request.headers.get('Authorization');

  // 1. Force the native browser login modal if credentials are missing
  if (!authHeader) {
    return new Response('Access Denied', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Westmuir Hall Admin"' },
    });
  }

  // 2. Extract and decode the browser's credentials
  const [type, credentials] = authHeader.split(' ');
  const [username, password] = atob(credentials).split(':');

  // Fallback to a development password if the Cloudflare Secret isn't bound yet
  const targetPassword = context.env.ADMIN_PASSWORD || 'local-test-pass';

  // 3. Validate credentials
  if (username !== 'admin' || password !== targetPassword) {
    return new Response('Invalid Credentials', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Westmuir Hall Admin"' },
    });
  }

  // 4. SUCCESS: Pass control to the actual endpoint they requested
  return await context.next();
}
