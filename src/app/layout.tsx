import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

import { ThemeProvider } from '@/components/ThemeProvider';
import { OfflineSyncManager } from '@/components/OfflineSyncManager';

export const metadata: Metadata = {
  title: 'Zeiterfassung Pro',
  description: 'Premium SaaS Zeiterfassung für moderne Unternehmen',
  manifest: '/manifest.json?v=2',
  icons: {
    apple: '/icon-192x192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Zeiterfassung Pro',
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
      </head>
      <body>
        <ThemeProvider>
          <div className="app-background">
            <div className="blob blob-1"></div>
            <div className="blob blob-2"></div>
            {children}
            <OfflineSyncManager />
          </div>
        </ThemeProvider>
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/sw.js').then(
                function(registration) {
                  console.log('ServiceWorker registration successful');
                },
                function(err) {
                  console.log('ServiceWorker registration failed: ', err);
                }
              );
            }
          `}
        </Script>
      </body>
    </html>
  );
}
