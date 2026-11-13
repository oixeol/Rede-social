'use client';

import { createAuthClient } from 'better-auth/client';

const getBaseURL = () => {
  if (typeof window !== 'undefined') {
    // Use relative URL to go through Next.js rewrites (/api/* -> backend)
    return '';
  }
  // Server-side: use the actual API origin
  return process.env.NEXT_PUBLIC_API_ORIGIN || 'http://127.0.0.1:4173';
};

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  fetchOptions: {
    credentials: 'include',
  },
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