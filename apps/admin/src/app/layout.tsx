import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { DisclaimerFooter } from '@jonoshheba/ui';
import './globals.css';

export const metadata: Metadata = {
  title: 'Jonoshheba Admin & Content Operations',
  description: 'Internal content governance, review queue, and intelligence dashboard.',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <main className="flex-1">{children}</main>
        <DisclaimerFooter locale="en" />
      </body>
    </html>
  );
}
