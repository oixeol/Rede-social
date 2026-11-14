const { createClient } = require('@supabase/supabase-js');
const env = require('../env.js');

let supabaseAdmin = null;

function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;

  const supabaseUrl = env.SUPABASE_URL || env.supabase || env.DATABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  }

  supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { 'x-client-info': 'supa-auth-server' },
    },
  });

  return supabaseAdmin;
}

/** Sign up with email/password + custom fields */
async function signUpEmail({ email, password, name, username, country, ...extra }) {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      username,
      country,
      ...extra,
    },
  });

  if (error) throw error;

  // Sign in to get session
  const { data: sessionData, error: sessionError } = await admin.auth.signInWithPassword({
    email,
    password,
  });

  if (sessionError) throw sessionError;

  return { user: data.user, session: sessionData.session };
}

/** Sign in with email/password */
async function signInEmail({ email, password }) {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin.auth.signInWithPassword({ email, password });

  if (error) throw error;

  return { user: data.user, session: data.session };
}

/** Sign in with OAuth (Google) - returns redirect URL */
async function signInOAuth({ provider, redirectTo }) {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });

  if (error) throw error;

  return { url: data.url };
}

/** Sign out */
async function signOut(accessToken) {
  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.signOut(accessToken);
  if (error) throw error;
  return { success: true };
}

/** Get user by access token */
async function getUser(accessToken) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error) throw error;
  return data.user;
}

/** Refresh session */
async function refreshSession(refreshToken) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.refreshSession({ refresh_token: refreshToken });
  if (error) throw error;
  return data.session;
}

/** Update user metadata */
async function updateUser(accessToken, updates) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.updateUserById(
    (await admin.auth.getUser(accessToken)).data.user.id,
    { user_metadata: updates }
  );
  if (error) throw error;
  return data.user;
}

/** Request password reset */
async function resetPasswordRequest(email, redirectTo) {
  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
  return { success: true };
}

/** Update password */
async function updatePassword(accessToken, newPassword) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.updateUserById(
    (await admin.auth.getUser(accessToken)).data.user.id,
    { password: newPassword }
  );
  if (error) throw error;
  return data.user;
}

/** List users (admin) */
async function listUsers(page = 1, perPage = 50) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
  if (error) throw error;
  return data.users;
}

module.exports = {
  signUpEmail,
  signInEmail,
  signInOAuth,
  signOut,
  getUser,
  refreshSession,
  updateUser,
  resetPasswordRequest,
  updatePassword,
  listUsers,
  getSupabaseAdmin,
};