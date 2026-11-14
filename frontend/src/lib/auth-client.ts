'use client';

import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export const authClient = {
  signIn: {
    email: async ({ email, password, callbackURL }: { email: string; password: string; callbackURL?: string }) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      return { user: data.user, session: data.session };
    },
    social: async ({ provider, callbackURL }: { provider: 'google'; callbackURL?: string }) => {
      const redirectTo = callbackURL || `${window.location.origin}/auth/callback`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) throw new Error(error.message);
      return { url: data.url };
    },
    passkey: async () => {
      // WebAuthn/Passkey not directly supported via supabase-js client yet
      // Would need to use supabase.auth.signInWithPasswordless or custom implementation
      throw new Error('Passkey not implemented yet');
    },
  },

  signUp: {
    email: async ({ email, password, name, username, country, callbackURL }: { 
      email: string; 
      password: string; 
      name: string; 
      username?: string; 
      country?: string; 
      callbackURL?: string;
    }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, username, country },
          emailRedirectTo: callbackURL || `${window.location.origin}/inicio`,
        },
      });
      if (error) throw new Error(error.message);
      return { user: data.user, session: data.session };
    },
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  },

  forgetPassword: async ({ email, callbackURL }: { email: string; callbackURL?: string }) => {
    const redirectTo = callbackURL || `${window.location.origin}/redefinir-senha`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw new Error(error.message);
  },

  resetPassword: async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  },

  updateUser: async (updates: { name?: string; username?: string; avatar?: string; [key: string]: any }) => {
    const { data, error } = await supabase.auth.updateUser({ data: updates });
    if (error) throw new Error(error.message);
    return data.user;
  },

  useSession: () => {
    // This is a placeholder - actual session management should use useSupabaseSession hook
    // or the SupabaseProvider context
    return { data: { session: null, user: null } };
  },

  getSession: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  getUser: async () => {
    const { data } = await supabase.auth.getUser();
    return data.user;
  },

  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback);
  },
};

export type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: User;
};

export type User = {
  id: string;
  email: string;
  user_metadata: {
    name?: string;
    username?: string;
    country?: string;
    avatar?: string;
    [key: string]: any;
  };
  app_metadata: any;
  created_at: string;
};