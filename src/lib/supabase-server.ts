/**
 * Server-side Supabase client with JWT authentication
 * Use this in Server Components, Server Actions, and API routes
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '../../generated/supabase-database.types';
import { auth } from '@/auth';
import { generateSupabaseJWT } from './rls-jwt';

/**
 * Get an authenticated Supabase client for server-side operations
 * The client includes a JWT token from next-auth for RLS enforcement
 *
 * @returns Authenticated Supabase client or unauthenticated client if no session
 */
export async function getSupabaseServerClient() {
  const session = await auth();

  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  );

  if (session?.user?.id) {
    try {
      const token = generateSupabaseJWT(
        session.user.id,
        session.user.email || undefined,
      );

      // Set the authorization header with the JWT token
      client.auth.setSession({
        access_token: token,
        refresh_token: '',
        user: {
          id: session.user.id,
          email: session.user.email || '',
          user_metadata: {
            name: session.user.name,
          },
          aud: 'authenticated',
          created_at: new Date().toISOString(),
          confirmation_sent_at: null,
          email_confirmed_at: null,
          phone_confirmed_at: null,
          last_sign_in_at: new Date().toISOString(),
          role: 'authenticated',
          updated_at: new Date().toISOString(),
          identities: [],
          is_anonymous: false,
          app_metadata: {
            provider: 'next-auth',
            providers: ['next-auth'],
          },
        },
      });
    } catch (error) {
      console.error('Failed to set Supabase session:', error);
    }
  }

  return client;
}

/**
 * Get an authenticated Supabase client for API routes
 * Pass the JWT token from the request header
 *
 * @param token - JWT token from Authorization header
 * @returns Authenticated Supabase client
 */
export function getSupabaseClientWithToken(token: string) {
  const client = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  );

  if (token) {
    try {
      client.auth.setSession({
        access_token: token,
        refresh_token: '',
        user: {
          id: '',
          email: '',
          user_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
          confirmation_sent_at: null,
          email_confirmed_at: null,
          phone_confirmed_at: null,
          last_sign_in_at: new Date().toISOString(),
          role: 'authenticated',
          updated_at: new Date().toISOString(),
          identities: [],
          is_anonymous: false,
          app_metadata: {},
        },
      });
    } catch (error) {
      console.error(
        'Failed to set Supabase session with token:',
        error,
      );
    }
  }

  return client;
}
