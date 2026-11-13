const { betterAuth } = require('better-auth');
const { kyselyAdapter } = require('@better-auth/kysely-adapter');
const { Pool } = require('pg');
const { Kysely, PostgresDialect } = require('kysely');
const { CamelCasePlugin } = require('kysely');
const env = require('../env.js');

let authInstance = null;
let initPromise = null;

function createAuth() {
  // Use Supabase pooler URL (has IPv4) for Render compatibility
  // Direct Supabase URL only resolves to IPv6 which Render can't reach
  const databaseUrl = env.supabase || env.DATABASE_URL || env.SUPABASE_URL || '';

  if (!databaseUrl) {
    throw new Error('DATABASE_URL or SUPABASE_URL/supabase env var is required');
  }

  console.log('[BetterAuth] Initializing with database:', databaseUrl.replace(/:[^:@]*@/, ':****@'));

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl?.includes('localhost') ? false : { rejectUnauthorized: false },
    // Force IPv4 for Render compatibility
    family: 4,
    // Connection pool settings for stability
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // Test connection immediately
  pool.on('error', (err) => {
    console.error('[BetterAuth] Pool error:', err.message);
  });

  const db = new Kysely({
    dialect: new PostgresDialect({
      pool,
    }),
    plugins: [new CamelCasePlugin()],
  });

  const isProduction = env.NODE_ENV === 'production';
  const apiOrigin = env.API_ORIGIN || (isProduction ? 'https://rede-social-attz.onrender.com' : 'http://localhost:4173');
  const authSecret = env.BETTER_AUTH_SECRET || (isProduction ? '' : 'dev-secret-change-in-production');

  if (isProduction && !env.BETTER_AUTH_SECRET) {
    throw new Error('BETTER_AUTH_SECRET env var is required in production');
  }

  return betterAuth({
    baseURL: apiOrigin,
    database: kyselyAdapter(db),
    secret: authSecret,

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 100,
      requireEmailVerification: false,
      autoSignIn: true,
    },

    session: {
      expiresIn: 30 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
      cookieName: 'vibra_session',
      cookieOptions: {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        domain: isProduction ? '.onrender.com' : undefined,
      },
    },

    user: {
      additionalFields: {
        username: { type: 'string', required: true, unique: true, input: true },
        name: { type: 'string', required: true, input: true },
        bio: { type: 'string', required: false, defaultValue: '', input: true },
        avatar: { type: 'string', required: false, input: true },
        banner: { type: 'string', required: false, input: true },
        birthDate: { type: 'date', required: true, input: true },
        gender: { type: 'string', required: false, input: true },
        country: { type: 'string', required: false, input: true },
        state: { type: 'string', required: false, input: true },
        isPrivate: { type: 'boolean', required: false, defaultValue: false, input: true },
        messagePolicy: { type: 'string', required: false, defaultValue: 'connections', input: true },
        points: { type: 'number', required: false, defaultValue: 0, input: false },
        subscriptionStatus: { type: 'string', required: false, defaultValue: 'none', input: false },
        subscriptionEndsAt: { type: 'date', required: false, input: false },
        themePalette: { type: 'string', required: false, defaultValue: 'default', input: false },
        preferences: { type: 'object', required: false, defaultValue: {}, input: false },
        externalLink: { type: 'string', required: false, input: true },
      },
    },

    advanced: {
      crossSubDomainCookies: { enabled: isProduction },
      defaultCookieAttributes: {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        domain: isProduction ? '.onrender.com' : undefined,
      },
      database: {
        generateId: () => crypto.randomUUID(),
      },
    },

    hooks: {
      after: {
        signUp: async ({ user, request }) => {
          // Create initial stats for new user
        },
      },
    },

    plugins: [],
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
  });
}

function getAuth() {
  if (authInstance) return authInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      authInstance = createAuth();
      console.log('[BetterAuth] Initialized successfully');
      return authInstance;
    } catch (err) {
      console.error('[BetterAuth] Initialization failed:', err.message);
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

// Export handler that lazily initializes auth
async function betterAuthHandler(req, res) {
  try {
    const auth = await getAuth();
    // Wrap Node.js req with proper URL for Better Auth
    const apiOrigin = env.API_ORIGIN || 'https://rede-social-attz.onrender.com';
    const fullUrl = `${apiOrigin}${req.url}`;
    const wrappedReq = {
      ...req,
      url: fullUrl,
      method: req.method,
      headers: req.headers,
    };
    console.log('[BetterAuth] Calling auth.handler for:', req.url);
    const response = await auth.handler(wrappedReq, res);
    console.log('[BetterAuth] Handler returned:', response ? 'Response object' : 'undefined');
    // Handle Response object returned by Better Auth
    if (response && typeof response === 'object' && 'status' in response) {
      console.log('[BetterAuth] Sending Response:', response.status);
      const body = await response.text();
      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      res.end(body);
    } else if (!res.headersSent) {
      console.log('[BetterAuth] No Response object, assuming handler sent response directly');
    }
  } catch (err) {
    console.error('[BetterAuth] Handler error:', err);
    console.error('[BetterAuth] Handler error stack:', err.stack);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        error: 'Authentication service unavailable', 
        details: err.message,
        stack: err.stack
      }));
    }
  }
}

module.exports = { auth: { handler: betterAuthHandler }, getAuth };