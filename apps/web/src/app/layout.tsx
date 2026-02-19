import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ai CRM',
  description: 'Intelligent CRM for Gobii agents',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/_next/static/css/app.css" />
      </head>
      <body suppressHydrationWarning>
        <div className="container">
          <div className="header">
            <h1>Ai CRM</h1>
            <span className="badge">Gobii Intelligence</span>
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}
