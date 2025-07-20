'use client';

import {
  Button,
  Container,
  Image,
  Stack,
  Text,
  rem,
} from '@mantine/core';
import Link from 'next/link';

export default function VerifyPage() {
  const email = 'Saiparnbrave@gmail.com'; // You can make this dynamic via props or query param

  return (
    <Container
      px="md"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: rem(812), // iPhone 11
        maxWidth: rem(375),
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Stack align="center" gap="md" style={{ textAlign: 'center' }}>
        <Image
          alt="logo"
          src="https://wcjxna7kg9rqnf7r.public.blob.vercel-storage.com/logo-2x-6vUw1zeoJsGT5rwcsDrOx81nk6NtHm.png"
          fit="contain"
          w={rem(250)}
          style={{ display: 'block', margin: 'auto' }}
        />

        <Text size="xl" fw={700} mt="md">
          Check your email
        </Text>

        <Text size="sm" c="dimmed" px="sm">
          We’ve sent a reset link to{' '}
          <Text component="span" c="yellow" fw={600}>
            {email}
          </Text>{' '}
          (if it’s linked to an account).
        </Text>

        <Text size="sm" c="dimmed">
          Check spam or{' '}
          <Text
            component="button"
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: 0,
              fontSize: rem(14),
            }}
            onClick={() => {
              // TODO: handle resend logic
              alert('Resend link');
            }}
          >
            Click to resend
          </Text>
        </Text>

        <Button
          mt="md"
          radius="md"
          fullWidth
          component={Link}
          href="/signin"
          styles={{
            root: {
              backgroundColor: '#2B2B2B',
              color: 'white',
              justifyContent: 'center',
              border: `${rem(1)} solid #3A3A3A`,
              '&:hover': {
                backgroundColor: '#3A3A3A',
              },
            },
          }}
        >
          Back to login
        </Button>
      </Stack>
    </Container>
  );
}
