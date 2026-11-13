const { betterAuth } = require('better-auth');
const { Pool } = require('pg');
const { Kysely, PostgresDialect } = require('kysely');
const env = require('../env.js');

// Prefer pooler connection for Supabase (more reliable for external connections)
const databaseUrl = env.DATABASE_URL || env.SUPABASE_URL || '';
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl?.includes('localhost') ? false : { rejectUnauthorized: false },
  // Connection pool settings for stability
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const db = new Kysely({
  dialect: new PostgresDialect({
    pool,
  }),
});

const isProduction = env.NODE_ENV === 'production';
const apiOrigin = env.API_ORIGIN || (isProduction ? 'https://rede-social-attz.onrender.com' : 'http://localhost:4173');

const auth = betterAuth({
  baseURL: apiOrigin,
  database: db,

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

module.exports = { auth };