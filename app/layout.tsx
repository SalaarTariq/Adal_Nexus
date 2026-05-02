import { AuthProvider } from './providers';

import type { Metadata } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import './globals.css';

// Adal Nexus – Pakistan Legal Community Platform
// Typography: serif headings (Playfair Display) + sans body (Inter).
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Adal Nexus – Pakistan\u2019s Legal Community Platform',
  description:
    'Connect, learn, and grow with fellow legal professionals across Pakistan. For law students, advocates, and judges.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
