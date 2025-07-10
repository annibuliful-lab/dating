'use client';

import { useEffect } from 'react';
import { supabase } from '@/client/supabase';
import {
  Box,
  Button,
  Container,
  Image,
  rem,
  Text,
  Stack,
} from '@mantine/core';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const getTest = async () => {
      const result = await supabase
        .from('_prisma_migrations')
        .select();
      console.log('result', result);
    };
    getTest();
  }, []);

  const { data: session, status } = useSession();

  console.debug('sessions', session);

  const handleClickLogin = () => {
    router.push('/signin');
  };

  const handleClickSignup = () => {
    router.push('/signup');
  };

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/feed');
    }
  }, [router, status]);

  return (
    <Box>
      <Container
        size="xs"
        px="md"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: rem(812), // iPhone 11 size in your screenshot
          maxWidth: rem(375),
        }}
      >
        <Box
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            alt="logo"
            src="https://wcjxna7kg9rqnf7r.public.blob.vercel-storage.com/logo-2x-6vUw1zeoJsGT5rwcsDrOx81nk6NtHm.png"
            fit="contain"
            w={rem(250)}
            style={{ display: 'block', margin: 'auto' }}
          />
        </Box>

        <Stack gap="xs" pb="xl">
          <Button fullWidth onClick={handleClickLogin}>
            Log in to Amorisloki
          </Button>
          <Text
            style={{
              cursor: 'pointer',
            }}
            c="cloud.4"
            ta="center"
            fw={500}
            onClick={handleClickSignup}
          >
            Sign up
          </Text>
        </Stack>
      </Container>
    </Box>
  );
}
