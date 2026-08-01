import MantineAppProvider from '@/provider/MantineAppProvider';
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import { SessionProvider } from 'next-auth/react';
import { Inter } from 'next/font/google';
import { ClientLayout } from '@/components/layout/ClientLayout';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { LocaleProvider } from '@/i18n/LocaleProvider';

const inter = Inter({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" {...mantineHtmlProps} className={inter.className}>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <SessionProvider>
          <MantineAppProvider>
            <LocaleProvider>
              <ClientLayout>{children}</ClientLayout>
            </LocaleProvider>
          </MantineAppProvider>
        </SessionProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
