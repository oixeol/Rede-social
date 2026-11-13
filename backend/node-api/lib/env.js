const required = [
  'DATABASE_URL',
];

for (const key of required) {
  if (!(key in process.env)) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required env var: ${key}`);
    }
  }
}

const optionalWithDefaults = {
  COOKIE_SECURE: '1',
  SESSION_TTL: String(30 * 24 * 60 * 60 * 1000),
  IDENTITY_PROVIDER: 'dev',
  IDENTITY_WEBHOOK_SECRET: '',
  ADMIN_TOKEN: '',
  NODE_ENV: 'production',
  PORT: '4173',
  HOST: '0.0.0.0',
  VIBRA_DATA_DIR: '',
  ALLOWED_ORIGINS: '',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  API_ORIGIN: '',
};

for (const [key, defaultValue] of Object.entries(optionalWithDefaults)) {
  if (!(key in process.env)) {
    process.env[key] = defaultValue;
  }
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL,
  COOKIE_SECURE: process.env.COOKIE_SECURE,
  SESSION_TTL: Number(process.env.SESSION_TTL),
  IDENTITY_PROVIDER: process.env.IDENTITY_PROVIDER,
  IDENTITY_WEBHOOK_SECRET: process.env.IDENTITY_WEBHOOK_SECRET,
  ADMIN_TOKEN: process.env.ADMIN_TOKEN,
  NODE_ENV: process.env.NODE_ENV,
  PORT: Number(process.env.PORT),
  HOST: process.env.HOST,
  VIBRA_DATA_DIR: process.env.VIBRA_DATA_DIR,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  API_ORIGIN: process.env.API_ORIGIN,
};