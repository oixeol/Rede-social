const required = [
  'DATABASE_URL',
  'COOKIE_SECURE',
  'SESSION_TTL',
  'IDENTITY_PROVIDER',
  'IDENTITY_WEBHOOK_SECRET',
  'ADMIN_TOKEN',
];

for (const key of required) {
  if (!(key in process.env)) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required env var: ${key}`);
    }
  }
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/vibra',
  COOKIE_SECURE: process.env.COOKIE_SECURE || '0',
  SESSION_TTL: Number(process.env.SESSION_TTL) || 30 * 24 * 60 * 60 * 1000,
  IDENTITY_PROVIDER: process.env.IDENTITY_PROVIDER || 'webhook',
  IDENTITY_WEBHOOK_SECRET: process.env.IDENTITY_WEBHOOK_SECRET || '',
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || '',
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 4173,
  HOST: process.env.HOST || '0.0.0.0',
  VIBRA_DATA_DIR: process.env.VIBRA_DATA_DIR,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:3000',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  API_ORIGIN: process.env.API_ORIGIN || '',
};