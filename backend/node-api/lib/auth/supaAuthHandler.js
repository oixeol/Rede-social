const { supaAuth } = require('./supaAuth');
const env = require('../env.js');

const COOKIE_NAME = 'vibra_session';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 30 * 24 * 60 * 60, // 30 days
};

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(c => {
    const [k, v] = c.trim().split('=');
    if (k && v) cookies[k] = decodeURIComponent(v);
  });
  return cookies;
}

function setSessionCookie(res, session) {
  if (!session) return;
  const cookie = `${COOKIE_NAME}=${session.access_token}; Max-Age=${COOKIE_OPTIONS.maxAge}; Path=${COOKIE_OPTIONS.path}; HttpOnly; Secure; SameSite=${COOKIE_OPTIONS.sameSite}`;
  res.setHeader('Set-Cookie', cookie);
}

function clearSessionCookie(res) {
  const cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=lax`;
  res.setHeader('Set-Cookie', cookie);
}

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function getAccessToken(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME];
}

async function supaAuthHandler(req, res) {
  const pathname = req.url.split('?')[0];
  const method = req.method;

  console.log('[SupaAuth] Request:', method, pathname);

  // Read body for non-GET/HEAD
  let body = null;
  if (!['GET', 'HEAD'].includes(method)) {
    body = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString()));
      req.on('error', reject);
    });
    try {
      body = body ? JSON.parse(body) : {};
    } catch {
      body = {};
    }
  }

  try {
    // POST /api/auth/sign-up/email
    if (method === 'POST' && pathname === '/api/auth/sign-up/email') {
      const { email, password, name, username, country, callbackURL, ...extra } = body || {};
      if (!email || !password || !name) {
        return json(res, 400, { error: 'Email, password, and name are required', code: 'MISSING_FIELD' });
      }
      const result = await supaAuth.signUpEmail({ email, password, name, username, country, ...extra });
      setSessionCookie(res, result.session);
      return json(res, 200, { user: result.user, session: result.session });
    }

    // POST /api/auth/sign-in/email
    if (method === 'POST' && pathname === '/api/auth/sign-in/email') {
      const { email, password, callbackURL } = body || {};
      if (!email || !password) {
        return json(res, 400, { error: 'Email and password required', code: 'MISSING_FIELD' });
      }
      const result = await supaAuth.signInEmail({ email, password });
      setSessionCookie(res, result.session);
      return json(res, 200, { user: result.user, session: result.session });
    }

    // POST /api/auth/sign-in/social (Google OAuth)
    if (method === 'POST' && pathname === '/api/auth/sign-in/social') {
      const { provider, callbackURL } = body || {};
      if (provider !== 'google') {
        return json(res, 400, { error: 'Only Google provider supported', code: 'INVALID_PROVIDER' });
      }
      const redirectTo = callbackURL || `${env.API_ORIGIN}/api/auth/callback`;
      const result = await supaAuth.signInOAuth({ provider: 'google', redirectTo });
      return json(res, 200, { url: result.url });
    }

    // GET /api/auth/callback (OAuth redirect)
    if (method === 'GET' && pathname === '/api/auth/callback') {
      // Supabase handles the callback on the frontend, this is just a fallback
      const html = `
        <html><body>
        <script>
          window.location.href = '${env.FRONTEND_ORIGIN || 'https://rede-social-rho-five.vercel.app'}/auth/callback?' + window.location.search.slice(1);
        </script>
        </body></html>
      `;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html');
      return res.end(html);
    }

    // POST /api/auth/sign-out
    if (method === 'POST' && pathname === '/api/auth/sign-out') {
      const accessToken = getAccessToken(req);
      if (accessToken) {
        await supaAuth.signOut(accessToken).catch(() => {});
      }
      clearSessionCookie(res);
      return json(res, 200, { success: true });
    }

    // GET /api/auth/session (get current session)
    if (method === 'GET' && pathname === '/api/auth/session') {
      const accessToken = getAccessToken(req);
      if (!accessToken) {
        return json(res, 200, { session: null, user: null });
      }
      try {
        const user = await supaAuth.getUser(accessToken);
        return json(res, 200, { session: { access_token: accessToken }, user });
      } catch {
        clearSessionCookie(res);
        return json(res, 200, { session: null, user: null });
      }
    }

    // POST /api/auth/forget-password
    if (method === 'POST' && pathname === '/api/auth/forget-password') {
      const { email, callbackURL } = body || {};
      if (!email) return json(res, 400, { error: 'Email required', code: 'MISSING_FIELD' });
      const redirectTo = callbackURL || `${env.FRONTEND_ORIGIN || 'https://rede-social-rho-five.vercel.app'}/redefinir-senha`;
      await supaAuth.resetPasswordRequest(email, redirectTo);
      return json(res, 200, { success: true });
    }

    // POST /api/auth/reset-password
    if (method === 'POST' && pathname === '/api/auth/reset-password') {
      const { password, token } = body || {};
      // Supabase handles reset via email link, token is in URL
      // This endpoint is called after user clicks link and sets new password
      const accessToken = getAccessToken(req); // or use token from body
      if (!accessToken) return json(res, 401, { error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
      await supaAuth.updatePassword(accessToken, password);
      return json(res, 200, { success: true });
    }

    // GET /api/auth/me (alias for session)
    if (method === 'GET' && pathname === '/api/auth/me') {
      const accessToken = getAccessToken(req);
      if (!accessToken) return json(res, 401, { error: 'Not authenticated', code: 'UNAUTHENTICATED' });
      try {
        const user = await supaAuth.getUser(accessToken);
        return json(res, 200, { user });
      } catch {
        clearSessionCookie(res);
        return json(res, 401, { error: 'Invalid session', code: 'INVALID_SESSION' });
      }
    }

    return json(res, 404, { error: 'Not found', code: 'NOT_FOUND' });

  } catch (err) {
    console.error('[SupaAuth] Error:', err.message);
    const status = err.message.includes('Invalid') || err.message.includes('Credentials') ? 401 : 500;
    return json(res, status, { error: err.message, code: 'AUTH_ERROR' });
  }
}

module.exports = { supaAuthHandler };