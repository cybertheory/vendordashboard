// vendor-dashboard/src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Import Inter font
import './globals.css';

const inter = Inter({ subsets: ['latin'] }); // Initialize Inter font

export const metadata: Metadata = {
  title: 'Vendor Dashboard', // Custom title for this app
  description: 'University Marketplace Vendor Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}