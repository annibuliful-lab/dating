'use client';

import { supabase } from '@/client/supabase';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function NewUserRedirect() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id && !checked) {
      const checkNewUser = async () => {
        setChecked(true);
        try {
          // Check if user was created recently (within last 2 minutes)
          const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
          
          const { data: user, error } = await supabase
            .from('User')
            .select('id, createdAt')
            .eq('id', session.user.id)
            .gte('createdAt', twoMinutesAgo)
            .single();

          if (!error && user) {
            // This is a new user, redirect to verification page
            router.push(`/signup/verify?userId=${session.user.id}`);
          }
        } catch (err) {
          console.error('Error checking new user:', err);
        }
      };

      checkNewUser();
    }
  }, [status, session, router, checked]);

  return null;
}

