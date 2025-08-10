import MantineAppProvider from "@/provider/MantineAppProvider";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import { SessionProvider } from "next-auth/react";
import { Inter } from "next/font/google";
const inter = Inter({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
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
