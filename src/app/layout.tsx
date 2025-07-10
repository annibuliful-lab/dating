import '@mantine/core/styles.css';

import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core';
import MantineAppProvider from '@/provider/MantineAppProvider';
import { Inter } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';
const inter = Inter({
  weight: ['400', '500', '600', '700'],
});
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" {...mantineHtmlProps} className={inter.className}>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <SessionProvider>
          <MantineAppProvider>{children}</MantineAppProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
