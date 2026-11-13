'use client';

import { createAuthClient } from 'better-auth/client';
import { passkeyClient } from '@better-auth/passkey/client';

const getBaseURL = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_API_ORIGIN || 'http://127.0.0.1:4173';
};

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [passkeyClient()]
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  forgetPassword,
  resetPassword,
  updateUser,
  changePassword,
} = authClient as any;

export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;