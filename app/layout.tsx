import type { Metadata, Viewport } from 'next';
import './globals.css';
import './polish.css';
import { PwaInstall } from '@/components/pwa-install';

export const metadata: Metadata = {
  title: 'Tempo — Make time count',
  description:
    'Your consulting hours, projects, and billable work. Beautifully in sync.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Tempo',
  },
  other: { 'apple-mobile-web-app-capable': 'yes' },
};

export const viewport: Viewport = {
  themeColor: '#3b57d7',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaInstall />
      </body>
    </html>
  );
}
