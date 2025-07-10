'use client';

import { ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import { theme } from '@/styles/theme';
import { Notifications } from '@mantine/notifications';

export default function MantineAppProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <MantineProvider
      theme={theme}
      defaultColorScheme="dark"
      withCssVariables
    >
      <Notifications />
      {children}
    </MantineProvider>
  );
}
