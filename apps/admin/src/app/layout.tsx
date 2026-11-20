import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Jonoshheba Admin — Control Room',
  description: 'Internal content governance, review queue, and intelligence dashboard.',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="night">
      <head>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
      </head>
      <body className="min-h-screen flex flex-col" style={{ background: 'var(--page)', color: 'var(--text)' }}>
        <main className="flex-1">{children}</main>
        <footer
          className="text-center py-3 text-xs"
          style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--hair)' }}
        >
          Jonoshheba AI — Internal Operations. Not for public use.
        </footer>
      </body>
    </html>
  );
}

