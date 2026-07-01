import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'Zeiterfassung Pro',
  description: 'Premium SaaS Zeiterfassung für moderne Unternehmen',
  manifest: '/manifest.json?v=2',
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
