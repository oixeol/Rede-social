const { betterAuth } = require('better-auth');
const { postgresAdapter } = require('better-auth/adapters/postgres');
const { Pool } = require('pg');
const { env } = require('../env.js');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

const auth = betterAuth({
  database: postgresAdapter(pool, {
    provider: 'postgresql',
    schema: 'public',
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 100,
    requireEmailVerification: false,
    autoSignIn: true,
  },

  session: {
    expiresIn: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 1 day
    cookieName: 'vibra_session',
    cookieOptions: {
      httpOnly: true,
      secure: env.COOKIE_SECURE === '1',
      sameSite: 'lax',
      path: '/',
    },
  },

  user: {
    additionalFields: {
      username: {
        type: 'string',
        required: true,
        unique: true,
        input: true,
      },
      name: {
        type: 'string',
        required: true,
        input: true,
      },
      bio: {
        type: 'string',
        required: false,
        defaultValue: '',
        input: true,
      },
      avatar: {
        type: 'string',
        required: false,
        input: true,
      },
      banner: {
        type: 'string',
        required: false,
        input: true,
      },
      birthDate: {
        type: 'date',
        required: true,
        input: true,
      },
      gender: {
        type: 'string',
        required: false,
        input: true,
      },
      country: {
        type: 'string',
        required: false,
        input: true,
      },
      state: {
        type: 'string',
        required: false,
        input: true,
      },
      isPrivate: {
        type: 'boolean',
        required: false,
        defaultValue: false,
        input: true,
      },
      messagePolicy: {
        type: 'string',
        required: false,
        defaultValue: 'connections',
        input: true,
      },
      points: {
        type: 'number',
        required: false,
        defaultValue: 0,
        input: false,
      },
      subscriptionStatus: {
        type: 'string',
        required: false,
        defaultValue: 'none',
        input: false,
      },
      subscriptionEndsAt: {
        type: 'date',
        required: false,
        input: false,
      },
      themePalette: {
        type: 'string',
        required: false,
        defaultValue: 'default',
        input: false,
      },
      preferences: {
        type: 'object',
        required: false,
        defaultValue: {},
        input: false,
      },
      externalLink: {
        type: 'string',
        required: false,
        input: true,
      },
    },
  },

  advanced: {
    crossSubDomainCookies: {
      enabled: false,
    },
    defaultCookieAttributes: {
      httpOnly: true,
      secure: env.COOKIE_SECURE === '1',
      sameSite: 'lax',
      path: '/',
    },
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },

  hooks: {
    after: {
      signUp: async ({ user, request }) => {
        // Create initial stats for new user
        // This can be extended to create default spaces, etc.
      },
    },
  },

  plugins: [],
});

module.exports = { auth };