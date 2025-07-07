'use client';

import { ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import { theme } from '@/styles/theme';

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
      {children}
    </MantineProvider>
  );
}
