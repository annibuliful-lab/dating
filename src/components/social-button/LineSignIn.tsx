import { Button } from '@mantine/core';
import { signIn } from 'next-auth/react';
import { LineIcon } from '../icons/LineIcon';

export function LineSignIn() {
  return (
    <Button
      leftSection={<LineIcon />}
      variant="secondary"
      onClick={() => signIn('line')}
    >
      Continue with Line
    </Button>
  );
}
