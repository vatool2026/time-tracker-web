import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="de">
      <body>
        <div className="app-background">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
          {children}
        </div>
      </body>
    </html>
  );
}
