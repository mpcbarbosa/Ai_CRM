import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ai CRM',
  description: 'Intelligent CRM for Gobii agents',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
