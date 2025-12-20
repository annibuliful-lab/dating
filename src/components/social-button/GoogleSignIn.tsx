'use client';

import { Button } from '@mantine/core';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { GoogleIcon } from '../icons/GoogleIcon';

export function GoogleSignIn() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      await signIn('google', {
        callbackUrl: '/feed',
        redirect: true,
      });
    } catch (error) {
      console.error('Google sign-in error:', error);
      setIsLoading(false);
    }
  };

  return (
    <Button
      leftSection={<GoogleIcon />}
      variant="secondary"
      onClick={handleGoogleSignIn}
      loading={isLoading}
      disabled={isLoading}
    >
      Continue with Google
    </Button>
  );
}
