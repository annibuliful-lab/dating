'use client';

import { Button } from '@mantine/core';
import { signIn } from 'next-auth/react';
import { GoogleIcon } from '../icons/GoogleIcon';

export function GoogleSignIn() {
  return (
    <Button
      leftSection={<GoogleIcon />}
      variant="secondary"
      onClick={() => signIn('google')}
    >
      Continue with Google
    </Button>
  );
}
