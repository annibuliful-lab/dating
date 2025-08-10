'use client';

import { supabase } from '@/client/supabase';
import { GoogleSignIn } from '@/components/social-button/GoogleSignIn';
import { LineSignIn } from '@/components/social-button/LineSignIn';
import {
  Button,
  PasswordInput,
  TextInput,
  Stack,
  Divider,
  Text,
  Group,
  Box,
  Container,
  rem,
} from '@mantine/core';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const handleClickSignIn = async () => {
    try {
      await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      await router.push('/');
    } catch (err) {
      console.error('[signin-error]: ', err);
      throw err;
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then((data) => {
      console.log('data', data);
    });
  }, []);

  return (
    <Container
      px="md"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: rem(812),
        maxWidth: rem(375),
        justifyContent: 'center',
      }}
    >
      <Stack gap="md">
        <Box bg="#3A3A3A" p="sm" w={rem(48)} h={rem(48)} />

        <Text size="xl" fw={700}>
          Log in for Amorisloki
        </Text>
        <Text size="sm" c="dimmed">
          Lorem
        </Text>

        <LineSignIn />
        <GoogleSignIn />

        <Group justify="center" gap="xs">
          <Divider w="40%" color="gray" />
          <Text size="xs" c="dimmed">
            or
          </Text>
          <Divider w="40%" color="gray" />
        </Group>

        <TextInput
          placeholder="Email"
          radius="md"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          styles={{
            input: {
              backgroundColor: '#131313',
              borderColor: '#333',
              color: 'white',
              height: '50px',
            },
          }}
        />

        <PasswordInput
          placeholder="Password"
          radius="md"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          visible={showPassword}
          onVisibilityChange={setShowPassword}
          styles={{
            input: {
              backgroundColor: '#131313',
              borderColor: '#333',
              color: 'white',
              height: '50px',
            },
          }}
        />

        <Button
          fullWidth
          variant="primary"
          onClick={handleClickSignIn}
        >
          Log in
        </Button>

        <Text size="sm" ta="center" mt="xs" fw={500}>
          <a
            href="#"
            style={{ color: 'white', textDecoration: 'none' }}
          >
            Forgot password
          </a>
        </Text>

        <Text size="sm" ta="center" c="dimmed">
          Don’t have an account?{' '}
          <Link
            href="/signup"
            style={{ color: 'white', fontWeight: 500 }}
          >
            Create one
          </Link>
        </Text>
      </Stack>
    </Container>
  );
}
