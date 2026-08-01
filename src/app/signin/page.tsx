'use client';

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
import { signIn, useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useLocale } from '@/i18n/LocaleProvider';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { status, data } = useSession();
  const handleClickSignIn = async () => {
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        notifications.show({
          title: t('loginFailed'),
          message: t('invalidCredentials'),
          color: 'red',
          autoClose: 5000,
        });
        return;
      }

      await router.push('/feed');
    } catch (err) {
      console.error('[signin-error]: ', err);
      notifications.show({
        title: t('loginFailed'),
        message: t('tryAgain'),
        color: 'red',
        autoClose: 5000,
      });
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/feed');
    }
  }, [data, status, router]);

  if (status === 'loading') return null;

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
          h={rem(48)}
          style={{ display: 'block' }}
        />

        <Text size="xl" fw={700}>
          {t('loginFor')}
        </Text>
        <Text size="sm" c="dimmed">
          เข้าสู่ระบบด้วยช่องทางที่สมัครมาเท่านั้น
        </Text>

        <TextInput
          placeholder={t('email')}
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
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="text"
        />

        <PasswordInput
          placeholder={t('password')}
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
          {t('login')}
        </Button>

        <Text size="sm" ta="center" mt="xs" fw={500}>
          <a
            href="#"
            style={{ color: 'white', textDecoration: 'none' }}
          >
            {t('forgotPassword')}
          </a>
        </Text>

        <Text size="sm" ta="center" c="dimmed">
          {t('noAccount')}{' '}
          <Link
            href="/signup"
            style={{ color: 'white', fontWeight: 500 }}
          >
            {t('createOne')}
          </Link>
        </Text>
      </Stack>
    </Container>
  );
}
