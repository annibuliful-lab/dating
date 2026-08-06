'use client';

import { LineSignIn } from '@/components/social-button/LineSignIn';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  Container,
  Divider,
  Image,
  Stack,
  Text,
  rem,
} from '@mantine/core';

export default function LineAuthTestPage() {
  const { t } = useLocale();
  return (
    <Container
      px="md"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: rem(812),
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
          LINE auth test
        </Text>
        <Text size="sm" c="dimmed">
          Use this page to test the LINE OAuth flow without showing it on the
          main sign-in and signup pages.
        </Text>

        <LineSignIn label={t('testLineSignIn')} />

        <Divider color="gray" />

        <LineSignIn label={t('testLineSignUp')} />

        <Text size="xs" c="dimmed">
          Both buttons use the same LINE OAuth provider. New and returning user
          behavior is decided by the auth callback and existing account data.
        </Text>
      </Stack>
    </Container>
  );
}
