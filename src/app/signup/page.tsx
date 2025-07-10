'use client';

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
import { notifications } from '@mantine/notifications';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignup = async () => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: email, password }),
      });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      // Process response here
      console.log('Registration Successful', response);

      await router.push('/signin');
      notifications.show({
        title: 'Sign up',
        message: 'Sign up successfully',
        autoClose: 2000,
      });
    } catch (error) {
      console.error('Registration Failed:', error);
      notifications.show({
        title: 'Sign up',
        message: 'Sign up failed please contact administrator',
        autoClose: 1000,
      });
    }
  };
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
        {/* Logo Placeholder */}
        <Box bg="#3A3A3A" p="sm" w={rem(48)} h={rem(48)} />

        <Text size="xl" fw={700}>
          Sign up for Amorisloki
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
          visible={showPassword}
          onVisibilityChange={setShowPassword}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          styles={{
            input: {
              backgroundColor: '#131313',
              borderColor: '#333',
              color: 'white',
              height: '50px',
            },
          }}
        />

        <Button fullWidth variant="primary" onClick={handleSignup}>
          Create account
        </Button>

        <Text size="sm" ta="center" c="dimmed">
          Already have an account?{' '}
          <Link
            href="/signin"
            style={{ color: '#FFD400', fontWeight: 500 }}
          >
            Log in
          </Link>
        </Text>
      </Stack>
    </Container>
  );
}
