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
import { useLocale } from '@/i18n/LocaleProvider';

const passwordValidations = [
  {
    label: 'passwordMin',
    validator: (pw: string) => pw.length >= 8,
  },
  {
    label: 'passwordNumber',
    validator: (pw: string) => /\d/.test(pw),
  },
  {
    label: 'passwordUppercase',
    validator: (pw: string) => /[A-Z]/.test(pw),
  },
  {
    label: 'passwordSpecial',
    validator: (pw: string) => /[!@#$%^&*(),.?":{}|<>]/.test(pw),
  },
];

export default function SignupPage() {
  const router = useRouter();
  const { t } = useLocale();
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
        title: t('signUp'),
        message: t('signUpSuccess'),
        autoClose: 5000,
      });

      // Redirect to post-registration screen
      const userId = data?.data?.user?.[0]?.id || '';
      await router.push(`/signup/verify?userId=${userId}`);
    },
    onError: (error) => {
      const message =
        error.message === 'INVALID_EMAIL_OR_USERNAME'
          ? t('signUpEmailInvalid')
          : error.message === 'EMAIL_OR_USERNAME_EXISTS'
            ? t('signUpEmailOrUsernameExists')
            : t('signUpFailed');
      notifications.show({
        title: t('signUp'),
        message,
        autoClose: 5000,
      });
    },
  });

  const handleSignup = () => {
    if (!isEmailValid) {
      notifications.show({
        title: t('signUp'),
        message: t('signUpEmailInvalid'),
        autoClose: 5000,
      });
      return;
    }

    mutate({ username: email, password });
  };

  const isEmailValid = isValidEmail(email);

  const isPasswordValid = passwordValidations.every((el) =>
    el.validator(password),
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
          {t('signUpFor')}
        </Text>
        <Text size="sm" c="dimmed">
          เลือกช่องทางสมัครสมาชิก
        </Text>

        <TextInput
          placeholder={t('email')}
          radius="md"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={email && !isEmailValid ? t('signUpEmailInvalid') : undefined}
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
          placeholder={t('password')}
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
            validations={passwordValidations.map((validation) => ({
              ...validation,
              label: t(
                validation.label as
                  | 'passwordMin'
                  | 'passwordNumber'
                  | 'passwordUppercase'
                  | 'passwordSpecial',
              ),
            }))}
          />
        )}

        <Button
          fullWidth
          variant="primary"
          onClick={handleSignup}
          loading={loading}
          disabled={!isEmailValid || !isPasswordValid}
        >
          {t('createAccount')}
        </Button>

        <Text size="sm" ta="center" c="dimmed">
          {t('alreadyAccount')}{' '}
          <Link
            href="/signin"
            style={{ color: '#FFD400', fontWeight: 500 }}
          >
            {t('login')}
          </Link>
        </Text>
      </Stack>
    </Container>
  );
}
