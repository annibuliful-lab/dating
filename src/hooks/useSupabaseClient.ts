/**
 * Client-side hook to get an authenticated Supabase client
 * Automatically fetches JWT token from the server
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../../generated/supabase-database.types';

export function useSupabaseClient() {
  const [client, setClient] = useState<ReturnType<
    typeof createClient<Database>
  > | null>(null);

  useEffect(() => {
    async function initializeClient() {
      try {
        // Fetch the JWT token from the API route
        const response = await fetch('/api/auth/jwt');

        if (!response.ok) {
          throw new Error('Failed to fetch JWT token');
        }

        const { token, userId } = await response.json();

        const newClient = createClient<Database>(
          process.env.NEXT_PUBLIC_SUPABASE_URL as string,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
        );

        if (token && userId) {
          newClient.auth.setSession({
            access_token: token,
            refresh_token: '',
            user: {
              id: userId,
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
        }

        setClient(newClient);
      } catch (error) {
        console.error('Failed to initialize Supabase client:', error);
        // Fall back to unauthenticated client
        const fallbackClient = createClient<Database>(
          process.env.NEXT_PUBLIC_SUPABASE_URL as string,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
        );
        setClient(fallbackClient);
      }
    }

    initializeClient();
  }, []);

  return client;
}
