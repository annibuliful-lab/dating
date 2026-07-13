'use client';

import { PasswordChecklist } from '@/components/element/PasswordChecklist';
import { ActiveCheckCircle } from '@/components/icons/CheckCircle';
import { useApiMutation } from '@/hooks/useApiMutation';
import { isValidEmail } from '@/shared/validation';
import {
  Button,
  Container,
  Image,
  PasswordInput,
  rem,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const passwordValidations = [
  {
    label: '8 characters minimum',
    validator: (pw: string) => pw.length >= 8,
  },
  {
    label: 'a number',
    validator: (pw: string) => /\d/.test(pw),
  },
  {
    label: 'an uppercase letter',
    validator: (pw: string) => /[A-Z]/.test(pw),
  },
  {
    label: 'a special character',
    validator: (pw: string) => /[!@#$%^&*(),.?":{}|<>]/.test(pw),
  },
];

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { mutate, loading } = useApiMutation<{
    message: string;
    data?: {
      user?: Array<{ id?: string }>;
      insertedOAuthAccount?: unknown;
    };
  }>('/api/auth/register', {
    onCompleted: async (data) => {
      notifications.show({
        title: 'Sign up',
        message: 'Sign up successfully',
        autoClose: 5000,
      });

      // Redirect to post-registration screen
      const userId = data?.data?.user?.[0]?.id || '';
      await router.push(`/signup/verify?userId=${userId}`);
    },
    onError: () => {
      notifications.show({
        title: 'Sign up',
        message: 'Sign up failed, please contact administrator',
        autoClose: 5000,
      });
    },
  });

  const handleSignup = () => {
    mutate({ username: email, password });
  };

  const isEmailValid = isValidEmail(email);

  const isPasswordValid = passwordValidations.every((el) =>
    el.validator(password)
  );

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
        <Image
          alt="logo"
          src="https://wcjxna7kg9rqnf7r.public.blob.vercel-storage.com/IMG_9165.PNG"
          fit="contain"
          w={rem(48)}
        />

        <Text size="xl" fw={700}>
          Sign up for Amorisloki
        </Text>
        <Text size="sm" c="dimmed">
          เลือกช่องทางสมัครสมาชิก
        </Text>

        <TextInput
          placeholder="Email"
          radius="md"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="off"
          rightSection={isEmailValid && <ActiveCheckCircle />}
          styles={{
            input: {
              backgroundColor: '#131313',
              borderColor: '#333',
              color: 'white',
              height: '50px',
            },
          }}
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="text"
        />

        <PasswordInput
          placeholder="Password"
          radius="md"
          visible={showPassword}
          onVisibilityChange={setShowPassword}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
          styles={{
            input: {
              backgroundColor: '#131313',
              borderColor: '#333',
              color: 'white',
              height: '50px',
            },
          }}
        />

        {isEmailValid && (
          <PasswordChecklist
            password={password}
            validations={passwordValidations}
          />
        )}

        <Button
          fullWidth
          variant="primary"
          onClick={handleSignup}
          loading={loading}
          disabled={!isPasswordValid}
        >
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
