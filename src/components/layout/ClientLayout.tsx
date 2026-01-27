'use client';

import {
  BottomNavbar,
  BOTTOM_NAVBAR_HEIGHT_PX,
} from '@/components/element/BottomNavbar';
import { Box } from '@mantine/core';
import { stat } from 'fs';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';

const ROUTES_WITHOUT_NAVBAR = ['/signin', '/signup', '/auth/error'];

export function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { status } = useSession();
  console.debug('pathname', pathname);
  // Check if current route should not show navbar
  const shouldShowNavbar = !ROUTES_WITHOUT_NAVBAR.some((route) =>
    pathname?.startsWith(route),
  );

  if (!shouldShowNavbar) {
    return <>{children}</>;
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
