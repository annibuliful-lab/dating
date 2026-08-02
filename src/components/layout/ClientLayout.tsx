'use client';

import {
  BottomNavbar,
  BOTTOM_NAVBAR_HEIGHT_PX,
} from '@/components/element/BottomNavbar';
import { VerifyPrompt } from '@/components/layout/VerifyPrompt';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Box, Button, Container, Stack, Text } from '@mantine/core';

import { usePathname } from 'next/navigation';
import { useLocale } from '@/i18n/LocaleProvider';

const ROUTES_WITHOUT_NAVBAR = [
  '/signin',
  '/signup',
  '/auth/error',
  '/line-auth-test',
];
const UUID_LIKE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isBlankOrGeneratedProfileValue(
  value: string | null | undefined,
) {
  const normalized = value?.trim();
  return !normalized || UUID_LIKE_PATTERN.test(normalized);
}

export function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useLocale();
  const { status, userProfile, loading, error, refetch } =
    useUserProfile();

  console.debug('pathname', pathname);
  // Check if current route should not show navbar
  const shouldShowNavbar = !ROUTES_WITHOUT_NAVBAR.some((route) =>
    pathname?.startsWith(route),
  );

  if (!shouldShowNavbar) {
    return <>{children}</>;
  }

  if (status === 'loading' || loading) {
    return null;
  }

  if (status === 'authenticated' && error) {
    return (
      <Container size="xs" py="xl">
        <Stack align="center" gap="md">
          <Text c="red" ta="center">
            {t('failedToLoadProfile')}
          </Text>
          <Button variant="filled" onClick={() => refetch()}>
            {t('retry')}
          </Button>
        </Stack>
      </Container>
    );
  }

  const isProfileEditRoute = pathname?.startsWith('/profile/edit');
  const isIncompleteProfile =
    userProfile &&
    (isBlankOrGeneratedProfileValue(userProfile.fullName) ||
      isBlankOrGeneratedProfileValue(userProfile.username));

  if (
    status === 'authenticated' &&
    userProfile &&
    !userProfile.isVerified &&
    !(isProfileEditRoute && isIncompleteProfile)
  ) {
    return <VerifyPrompt />;
  }

  return (
    <>
      <Box pb={BOTTOM_NAVBAR_HEIGHT_PX}>{children}</Box>
      {status === 'authenticated' && pathname !== '/' && (
        <BottomNavbar />
      )}
    </>
  );
}
