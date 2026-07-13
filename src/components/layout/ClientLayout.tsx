'use client';

import {
  BottomNavbar,
  BOTTOM_NAVBAR_HEIGHT_PX,
} from '@/components/element/BottomNavbar';
import { VerifyPrompt } from '@/components/layout/VerifyPrompt';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Box } from '@mantine/core';

import { usePathname } from 'next/navigation';

const ROUTES_WITHOUT_NAVBAR = ['/signin', '/signup', '/auth/error'];

export function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { status, userProfile, loading } = useUserProfile();

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
