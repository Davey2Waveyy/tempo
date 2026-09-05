import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Tempo — Make time count',
  description:
    'Your consulting hours, projects, and billable work. Beautifully in sync.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
