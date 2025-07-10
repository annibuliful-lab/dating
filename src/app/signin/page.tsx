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
import Link from 'next/link';
import { useState } from 'react';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

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
          radius="md"
          size="md"
          bg="yellow"
          c="black"
          fw={600}
          styles={{
            root: {
              backgroundColor: '#FFD400',
              '&:hover': {
                backgroundColor: '#FFCF00',
              },
            },
          }}
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
