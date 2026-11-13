function getEnv(key, defaultValue = '') {
  return process.env[key] ?? defaultValue;
}

function getEnvNumber(key, defaultValue = 0) {
  const val = process.env[key];
  return val ? Number(val) : defaultValue;
}

module.exports = {
  get DATABASE_URL() { return getEnv('DATABASE_URL'); },
  get SUPABASE_URL() { return getEnv('SUPABASE_URL'); },
  get COOKIE_SECURE() { return getEnv('COOKIE_SECURE', '1'); },
  get SESSION_TTL() { return getEnvNumber('SESSION_TTL', 30 * 24 * 60 * 60 * 1000); },
  get IDENTITY_PROVIDER() { return getEnv('IDENTITY_PROVIDER', 'dev'); },
  get IDENTITY_WEBHOOK_SECRET() { return getEnv('IDENTITY_WEBHOOK_SECRET', ''); },
  get ADMIN_TOKEN() { return getEnv('ADMIN_TOKEN', ''); },
  get NODE_ENV() { return getEnv('NODE_ENV', 'production'); },
  get PORT() { return getEnvNumber('PORT', 4173); },
  get HOST() { return getEnv('HOST', '0.0.0.0'); },
  get VIBRA_DATA_DIR() { return getEnv('VIBRA_DATA_DIR', ''); },
  get ALLOWED_ORIGINS() { return getEnv('ALLOWED_ORIGINS', ''); },
  get GOOGLE_CLIENT_ID() { return getEnv('GOOGLE_CLIENT_ID', ''); },
  get GOOGLE_CLIENT_SECRET() { return getEnv('GOOGLE_CLIENT_SECRET', ''); },
  get API_ORIGIN() { return getEnv('API_ORIGIN', ''); },
  get BETTER_AUTH_SECRET() { return getEnv('BETTER_AUTH_SECRET', ''); },
};