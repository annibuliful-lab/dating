'use client';

import { supabase } from '@/client/supabase';
import { Button, Container, Text } from '@mantine/core';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function FeedPage() {
  const router = useRouter();
  const { status, data } = useSession();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [router, status]);

  useEffect(() => {
    supabase.auth.getSession().then((data) => {
      console.log('data', data);
    });
  }, []);

  return (
    <Container>
      <Text ta="center">In-progress</Text>

      <Text>
        Information
        <br />
        {data && JSON.stringify(data)}
      </Text>
      <Button
        onClick={async () => {
          await signOut();
          await router.push('/');
        }}
        display="block"
        mx="auto"
      >
        Sign out
      </Button>
    </Container>
  );
}

export default FeedPage;
