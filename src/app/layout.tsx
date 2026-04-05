import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";

import "@/app/globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { PwaRegistration } from "@/components/providers/pwa-registration";
import { env } from "@/lib/env";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"]
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"]
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`
  },
  description: APP_DESCRIPTION,
  metadataBase: new URL(env.appUrl),
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <AppProviders>
          <PwaRegistration />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
