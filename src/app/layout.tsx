import type { Metadata } from 'next';
import './globals.css';

import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'Zeiterfassung Pro',
  description: 'Premium SaaS Zeiterfassung für moderne Unternehmen',
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
      </body>
    </html>
  );
}
