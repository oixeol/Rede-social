'use client';

import { createAuthClient } from 'better-auth/client';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_ORIGIN || 
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'),
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