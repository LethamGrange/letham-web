// Ensure you have Node compatibility enabled in wrangler.toml or via compatibility flags
import crypto from 'node:crypto';

export async function onRequestPost(context) {
  const formData = await context.request.formData();
  const username = formData.get('username');
  const password = formData.get('password');
  const nextPath = formData.get('next') || '/admin';
  const db = context.env.curling_league;

  // 1. Fetch the user row from D1
  const user = await db.prepare('SELECT id, password_hash, role FROM users WHERE username = ?').bind(username).first();
  console.log(user, password);
  // 2. Safely verify the scrypt hash
  if (!user || !verifyScrypt(password, user.password_hash)) {
    return new Response("<p style='color:red;'>Invalid username or password.</p>", {
      status: 200,
    });
  }

  // Inside functions/api/login.js (Right after a successful login verification)
  const nowSeconds = Math.floor(Date.now() / 1000);
  await db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(nowSeconds).run();

  // 3. Create a unique session token
  const sessionToken = crypto.randomUUID();
  const expiresAt = nowSeconds + 24 * 60 * 60; // 24 Hours

  // 4. Save session to D1
  await db
    .prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(sessionToken, user.id, expiresAt)
    .run();
  // 5. Build environment-aware cookie headers
  // Only enforce HTTPS/Secure if running in the live Cloudflare production environment
  const isProduction = context.env.CF_PAGES === '1';
  const secureFlag = isProduction ? ' Secure;' : '';

  return new Response('Success', {
    status: 200,
    headers: {
      'Set-Cookie': `session=${sessionToken}; Path=/; HttpOnly;${secureFlag} SameSite=Strict; Max-Age=86400`,
      'HX-Redirect': nextPath,
    },
  });
}

function verifyScrypt(password, storedHash) {
  try {
    // 1. Defensively clean up the incoming string/password
    const cleanPassword = String(password).trim();
    const cleanStoredHash = String(storedHash).trim();

    // 2. Destructure the hash parameters
    const parts = cleanStoredHash.split('$');
    if (parts.length !== 5) {
      console.error('Invalid hash format found in database.');
      return false;
    }

    const [N_str, r_str, p_str, saltHex, hashHex] = parts;

    // 3. Convert explicitly to Numbers and Buffers
    const N = Number(N_str);
    const r = Number(r_str);
    const p = Number(p_str);
    const salt = Buffer.from(saltHex, 'hex');
    const expectedKey = Buffer.from(hashHex, 'hex');

    // 4. Generate the key to match against
    // Ensure the length parameter (64) is exactly identical to hash.js
    const derivedKey = crypto.scryptSync(cleanPassword, salt, 64, { N, r, p });

    // 5. Secure timing-safe comparison
    return crypto.timingSafeEqual(derivedKey, expectedKey);
  } catch (error) {
    console.error('Scrypt verification failed entirely:', error);
    return false;
  }
}
