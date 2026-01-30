'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useUserProfile } from './useUserProfile';

export const useVerificationCheck = (options?: {
  enabled?: boolean;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { userProfile, loading, status } = useUserProfile();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    // Only check when enabled
    if (options?.enabled !== true) {
      return;
    }

    // Skip if still loading
    if (loading) {
      return;
    }

    // Skip if not authenticated
    if (status !== 'authenticated') {
      return;
    }

    // Skip check if already on verify page to avoid infinite redirects
    if (pathname === '/signup/verify') {
      return;
    }

    // Skip if already redirecting
    if (isRedirecting) {
      return;
    }

    // Redirect to verify page if user is not verified
    if (userProfile && userProfile.isVerified !== true) {
      console.debug(
        'User not verified, redirecting to /signup/verify',
        {
          isVerified: userProfile.isVerified,
          pathname,
        },
      );
      setIsRedirecting(true);
      router.push('/signup/verify');
    }
  }, [
    userProfile,
    loading,
    status,
    router,
    options?.enabled,
    pathname,
    isRedirecting,
  ]);

  return {
    isVerified: userProfile?.isVerified ?? false,
    loading,
    isRedirecting,
  };
};
