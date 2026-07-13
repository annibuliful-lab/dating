'use client';

import {
  BottomNavbar,
  BOTTOM_NAVBAR_HEIGHT_PX,
} from '@/components/element/BottomNavbar';
import { VerifyPrompt } from '@/components/layout/VerifyPrompt';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Box, Button, Container, Stack, Text } from '@mantine/core';

import { usePathname } from 'next/navigation';

const ROUTES_WITHOUT_NAVBAR = ['/signin', '/signup', '/auth/error'];

export function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
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
            Failed to load your profile.
          </Text>
          <Button variant="filled" onClick={() => refetch()}>
            Retry
          </Button>
        </Stack>
      </Container>
    );
  }

  if (status === 'authenticated' && userProfile && !userProfile.isVerified) {
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
